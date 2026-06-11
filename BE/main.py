import asyncio
import os
import logging
import json
import random
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv
from pydantic import BaseModel
from vnstock import Quote

from config import settings
# Import database components
from database import create_db_and_tables, get_session, News, MacroIndicator, AITradeLog, Watchlist, StrategyScore, engine
from scraper import NewsAggregator
from gmail_news import GmailNewsClient
from services import StrategyEvaluator, MacroEngine, QuantTrader, TelegramService, BrokerTrader, OpenAICodexAdvisor, DnseMarketData
from live_dashboard import SYMBOL_META, get_quant_dashboard, get_strategic_dashboard, data_sources, get_research_model, build_research_pdf, get_live_ratios

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VNStockTerminal")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")

manager = ConnectionManager()

class VNStockTerminalApp:
    def __init__(self):
        self.app = FastAPI(
            title="VN Stock Terminal v3.0",
            description="High-performance Realtime Financial Engine",
            version="3.0.0",
            lifespan=self._lifespan,
        )
        self.news_aggregator = NewsAggregator()
        self.gmail_news = GmailNewsClient()
        self._setup_middleware()
        self._setup_routes()

    @asynccontextmanager
    async def _lifespan(self, app: FastAPI):
        logger.info("Starting up VN Stock Terminal Engine (LIVE MODE)...")
        create_db_and_tables()
        heartbeat_task = asyncio.create_task(self._heartbeat_task())
        try:
            yield
        finally:
            heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat_task

    def _setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _setup_routes(self):
        class TradeRequest(BaseModel):
            ticker: str
            side: str
            price: float
            quantity: int = 100

        class CodexRequest(BaseModel):
            ticker: str
            prompt: str
            context: Optional[Dict] = None

        @self.app.get("/")
        async def root():
            return {"status": "active", "mode": "LIVE_VNSTOCK"}

        @self.app.websocket("/ws/ai-logs")
        async def websocket_endpoint(websocket: WebSocket):
            await manager.connect(websocket)
            try:
                while True: await websocket.receive_text()
            except WebSocketDisconnect: manager.disconnect(websocket)

        # --- LIVE MARKET DATA ---
        @self.app.get("/api/market/ticker-tape")
        async def get_ticker_tape():
            tickers = settings.ticker_tape_symbols
            result = []
            try:
                for t in tickers:
                    try:
                        q = Quote(symbol=t, source=settings.vnstock_quote_sources[-1])
                        df = q.history(length='1M', interval='1D')
                        if not df.empty and len(df) >= 2:
                            latest = df.iloc[-1]
                            prev = df.iloc[-2]
                            result.append({
                                "ticker": t,
                                "price": float(latest['close']),
                                "change": round(((latest['close'] - prev['close']) / prev['close']) * 100, 2)
                            })
                        await asyncio.sleep(0.1)
                    except: continue
                return result
            except Exception as e:
                logger.error(f"Ticker Tape Error: {e}")
                return []

        @self.app.get("/api/market/history/{ticker}")
        async def get_history(ticker: str):
            ticker = ticker.upper()
            try:
                # 1. Thử lấy TOÀN BỘ dữ liệu thực từ vnstock (Nguồn VCI/KBS hỗ trợ Quote)
                for src in settings.vnstock_quote_sources:
                    try:
                        q = Quote(symbol=ticker, source=src)
                        # Lấy từ năm 2000 để có TOÀN BỘ lịch sử
                        df = q.history(start='2000-01-01', end=datetime.now().strftime('%Y-%m-%d'), interval='1D')
                        if df is not None and not df.empty:
                            df = df.sort_values(by='time', ascending=True)
                            history = []
                            for _, r in df.iterrows():
                                history.append({
                                    "time": str(r['time']).split(' ')[0],
                                    "open": float(r['open']), "high": float(r['high']),
                                    "low": float(r['low']), "close": float(r['close']),
                                    "volume": int(r['volume'])
                                })
                            logger.info(f"Successfully fetched FULL history for {ticker} from {src}: {len(history)} bars")
                            return history
                    except Exception as inner_e: 
                        logger.warning(f"Source {src} failed for {ticker}: {inner_e}")
                        continue
            except Exception as e:
                logger.error(f"Full History Fetch Error: {e}")
                
            logger.warning(f"No vnstock history available for {ticker}")
            return []

        @self.app.get("/api/market/intraday/{ticker}")
        async def get_intraday(ticker: str):
            ticker = ticker.upper()
            try:
                q = Quote(symbol=ticker, source=settings.vnstock_quote_sources[-1])
                df = q.history(length='10D', interval='1D')
                if df is None or df.empty:
                    return []
                df = df.sort_values(by='time', ascending=True).tail(30)
                return [
                    {
                        "time": str(row["time"]).split(" ")[0],
                        "open": float(row["open"]),
                        "high": float(row["high"]),
                        "low": float(row["low"]),
                        "close": float(row["close"]),
                        "volume": int(row["volume"])
                    }
                    for _, row in df.iterrows()
                ]
            except Exception as e:
                logger.error(f"Intraday fetch error for {ticker}: {e}")
                return []

        @self.app.get("/api/market/quote/{ticker}")
        async def get_realtime_quote(ticker: str):
            ticker = ticker.upper()
            try:
                for src in settings.vnstock_quote_sources:
                    try:
                        q = Quote(symbol=ticker, source=src)
                        # Lấy 2 phiên gần nhất để tính change %
                        df = q.history(length='2M', interval='1D') 
                        if not df.empty and len(df) >= 2:
                            df = df.sort_values(by='time', ascending=True)
                            latest = df.iloc[-1]
                            prev = df.iloc[-2]
                            price = float(latest['close'])
                            change = float(latest['close'] - prev['close'])
                            pct_change = round((change / prev['close']) * 100, 2)
                            return {
                                "ticker": ticker,
                                "price": price,
                                "change": pct_change,
                                "abs_change": round(change * 1000, 0), # Quy đổi ra đồng
                                "volume": int(latest['volume']),
                                "time": str(latest['time'])
                            }
                    except: continue
                return {"ticker": ticker, "price": 0.0, "change": 0.0, "volume": 0}
            except Exception as e:
                logger.error(f"Quote Error: {e}")
                return {"ticker": ticker, "price": 0.0, "change": 0.0, "volume": 0}

        # --- NEWS ---
        @self.app.get("/api/news/gmail/status")
        async def get_gmail_news_status():
            return self.gmail_news.status()

        @self.app.get("/api/news/gmail")
        async def get_gmail_news(limit: int = 15):
            return await self.gmail_news.fetch_news(limit=limit)

        @self.app.get("/api/news/gmail/brief/{ticker}")
        async def get_gmail_news_brief(ticker: str, limit: int = 20):
            return await self.gmail_news.fetch_brief(ticker=ticker, limit=limit)

        @self.app.get("/api/news/gmail/{ticker}")
        async def get_gmail_news_by_ticker(ticker: str, limit: int = 15):
            return await self.gmail_news.fetch_news(ticker=ticker, limit=limit)

        @self.app.get("/api/news/{ticker_or_cat}")
        async def get_news(ticker_or_cat: str):
            return await self.news_aggregator.get_aggregated_news(ticker_or_cat.upper())

        @self.app.get("/api/data/sources")
        async def get_data_sources():
            return data_sources()

        @self.app.get("/api/universe")
        async def get_universe():
            return {
                "symbols": [
                    {"ticker": ticker, **meta}
                    for ticker, meta in SYMBOL_META.items()
                ],
                "ticker_tape": settings.ticker_tape_symbols,
                "scan_symbols": settings.scan_symbols,
                "sources": data_sources(),
            }

        @self.app.get("/api/quant/dashboard")
        async def get_quant_dashboard_api():
            return get_quant_dashboard()

        @self.app.get("/api/strategic/dashboard")
        async def get_strategic_dashboard_api():
            return get_strategic_dashboard()

        @self.app.get("/api/research/{ticker}")
        async def get_research_snapshot(ticker: str):
            return get_research_model(ticker)

        @self.app.get("/api/research/{ticker}/pdf")
        async def download_research_pdf(ticker: str):
            ticker = ticker.upper().strip()
            pdf = build_research_pdf(ticker)
            return Response(
                content=pdf,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{ticker}_research_report.pdf"'},
            )

        # --- MACRO ---
        @self.app.get("/api/analysis/macro")
        async def get_macro(db: Session = Depends(get_session)):
            engine = MacroEngine(db)
            return engine.get_market_phase()

        @self.app.post("/api/ai/codex")
        async def ask_codex(payload: CodexRequest, db: Session = Depends(get_session)):
            ticker = payload.ticker.upper().strip()
            prompt = payload.prompt.strip()
            if not ticker:
                raise HTTPException(status_code=400, detail="Ticker is required")
            if not prompt:
                raise HTTPException(status_code=400, detail="Prompt is required")

            market_context = payload.context or {}
            try:
                quote = Quote(symbol=ticker, source=settings.vnstock_quote_sources[-1])
                df = quote.history(length='3M', interval='1D')
                if df is not None and not df.empty:
                    df = df.sort_values(by='time', ascending=True)
                    latest = df.iloc[-1]
                    prev = df.iloc[-2] if len(df) >= 2 else latest
                    market_context["quote"] = {
                        "price": float(latest["close"]),
                        "change_pct": round(((latest["close"] - prev["close"]) / prev["close"]) * 100, 2) if prev["close"] else 0,
                        "volume": int(latest["volume"]),
                        "date": str(latest["time"]).split(" ")[0],
                    }
                    market_context["technicals"] = {
                        "ma20": round(float(df["close"].tail(20).mean()), 2),
                        "ma50": round(float(df["close"].tail(50).mean()), 2) if len(df) >= 50 else None,
                        "high_3m": round(float(df["high"].max()), 2),
                        "low_3m": round(float(df["low"].min()), 2),
                    }
            except Exception as e:
                logger.warning(f"Codex context quote fetch failed for {ticker}: {e}")

            try:
                evaluator = StrategyEvaluator(db)
                sepa_score, sepa_details = evaluator.get_sepa_score(ticker)
                market_context["strategy_score"] = {
                    "sepa_score": sepa_score,
                    "sepa": sepa_details,
                }
            except Exception as e:
                logger.warning(f"Codex context strategy fetch failed for {ticker}: {e}")

            try:
                market_context["macro"] = MacroEngine(db).get_market_phase()
            except Exception as e:
                logger.warning(f"Codex context macro fetch failed: {e}")

            advisor = OpenAICodexAdvisor()
            return await advisor.ask(prompt=prompt, ticker=ticker, context=market_context)

        @self.app.get("/api/ai/equity-report/{ticker}")
        async def get_ai_equity_report(ticker: str, db: Session = Depends(get_session)):
            ticker = ticker.upper().strip()
            if not ticker:
                raise HTTPException(status_code=400, detail="Ticker is required")

            research = get_research_model(ticker)
            ratios = get_live_ratios(ticker)
            valuation = {
                "current_price": research.get("current_price"),
                "intrinsic_value": research.get("target_price"),
                "weighted_target": research.get("weighted_target"),
                "upside": research.get("upside"),
                "wacc": research.get("wacc"),
                "growth_rate": research.get("growth_rate"),
                "terminal_growth": research.get("terminal_growth"),
                "target_pe": research.get("target_pe"),
                "forward_eps": research.get("forward_eps"),
                "valuation_bridge": research.get("valuation_bridge", []),
                "scenario": research.get("scenario", {}),
                "assumptions": research.get("assumptions", []),
                "history": research.get("history", []),
            }

            daily_brief = await self.gmail_news.fetch_brief(ticker=ticker, limit=20)
            news = await self.news_aggregator.get_aggregated_news(ticker, limit=12)

            technical_context = {}
            try:
                quote = Quote(symbol=ticker, source=settings.vnstock_quote_sources[-1])
                df = quote.history(length='6M', interval='1D')
                if df is not None and not df.empty:
                    df = df.sort_values(by='time', ascending=True)
                    close = float(df.iloc[-1]["close"])
                    prev_close = float(df.iloc[-2]["close"]) if len(df) >= 2 else close
                    technical_context = {
                        "last_close": close,
                        "change_pct": round(((close - prev_close) / prev_close) * 100, 2) if prev_close else 0,
                        "ma20": round(float(df["close"].tail(20).mean()), 2),
                        "ma50": round(float(df["close"].tail(50).mean()), 2) if len(df) >= 50 else None,
                        "high_6m": round(float(df["high"].max()), 2),
                        "low_6m": round(float(df["low"].min()), 2),
                        "volume_ratio_20d": round(float(df.iloc[-1]["volume"] / max(1, df["volume"].tail(20).mean())), 2),
                    }
            except Exception as e:
                logger.warning(f"Equity report technical context failed for {ticker}: {e}")

            try:
                macro_context = MacroEngine(db).get_market_phase()
            except Exception as e:
                logger.warning(f"Equity report macro context failed: {e}")
                macro_context = {}

            context = {
                "research": research,
                "ratios": ratios,
                "valuation": valuation,
                "technical": technical_context,
                "macro": macro_context,
                "daily_brief": daily_brief,
                "news": news[:12],
                "data_sources": data_sources(),
            }
            advisor = OpenAICodexAdvisor()
            return await advisor.equity_report(ticker=ticker, context=context)

        # --- FINANCE & VALUATION ---
        @self.app.get("/api/finance/ratios/{ticker}")
        async def get_ratios(ticker: str):
            ticker = ticker.upper()
            return get_live_ratios(ticker)

        @self.app.get("/api/market/scanner")
        async def get_market_scanner():
            dashboard = get_strategic_dashboard()
            rows = sorted(
                dashboard.get("strategicStocks", []),
                key=lambda item: item.get("relativeStrengthScore", 0) + item.get("liquidityScore", 0),
                reverse=True,
            )
            return [
                {
                    "ticker": item["ticker"],
                    "reason": f"Quét dữ liệu live từ backend: {item['setupStatus']}, biến động {item['changePct']}%, ngành {item['sector']}.",
                    "entry_zone": item["buyZone"],
                    "target": item["target1"],
                    "risk": item["creditSensitivity"],
                }
                for item in rows[:5]
            ]

        @self.app.get("/api/finance/valuation/dcf/{ticker}")
        async def get_dcf_valuation(ticker: str):
            ticker = ticker.upper()
            research = get_research_model(ticker)
            if research:
                return {
                    "current_price": research["current_price"],
                    "intrinsic_value": research["target_price"],
                    "weighted_target": research["weighted_target"],
                    "upside": research["upside"],
                    "wacc": research["wacc"],
                    "growth_rate": research["growth_rate"],
                    "terminal_growth": research["terminal_growth"],
                    "target_pe": research["target_pe"],
                    "forward_eps": research["forward_eps"],
                    "valuation_bridge": research["valuation_bridge"],
                    "scenario": research["scenario"],
                    "assumptions": research["assumptions"],
                    "history": research["history"],
                    "forecast_period_years": research.get("forecast_period_years", len(research.get("history", []))),
                }

        # --- STRATEGY & ANALYSIS ---
        @self.app.get("/api/investment/strategy")
        async def get_investment_strategy(db: Session = Depends(get_session)):
            strategic = get_strategic_dashboard().get("strategicStocks", [])
            focus_list = [
                {
                    "ticker": item["ticker"],
                    "canslim_score": round(sum(item["canslim"].values()) / len(item["canslim"])),
                    "tech_status": item["setupStatus"],
                    "vsa_signal": "Live volume scan",
                    "entry": item["pivotPrice"],
                    "potential": f"+{round((item['target1'] / item['price'] - 1) * 100, 1)}%",
                    "sepa_verdict": "MUA" if item["setupStatus"] == "Ready to Buy" else "THEO DÕI",
                }
                for item in strategic[:5]
            ]
            return {
                "mode": "GROWTH_HUNTING",
                "market_timing": "Quét dữ liệu live từ backend qua vnstock",
                "ui": {
                    "table_title": "Bộ lọc CANSLIM & SEPA từ backend",
                    "search_mode_label": "Chế độ API backend",
                },
                "focus_list": focus_list,
                "tactical_alerts": [],
            }
        @self.app.get("/api/account/balance")
        async def get_balance():
            return {"balance": settings.paper_account_balance}

        @self.app.get("/api/account/positions")
        async def get_positions(db: Session = Depends(get_session)):
            try:
                statement = select(AITradeLog).order_by(AITradeLog.timestamp.asc())
                trades = db.exec(statement).all()

                positions: Dict[str, int] = {}
                avg_cost: Dict[str, float] = {}
                latest_prices: Dict[str, float] = {}

                for trade in trades:
                    ticker = trade.ticker.upper()
                    current_qty = positions.get(ticker, 0)
                    current_cost = avg_cost.get(ticker, 0.0)

                    if trade.side.upper() == "BUY":
                        total_cost = (current_cost * current_qty) + (trade.price * trade.quantity)
                        new_qty = current_qty + trade.quantity
                        positions[ticker] = new_qty
                        avg_cost[ticker] = total_cost / new_qty if new_qty > 0 else 0.0
                    elif trade.side.upper() == "SELL":
                        positions[ticker] = max(0, current_qty - trade.quantity)
                        if positions[ticker] == 0:
                            avg_cost[ticker] = 0.0

                    latest_prices[ticker] = trade.price

                clean_positions = {k: v for k, v in positions.items() if v > 0}
                position_metrics: Dict[str, Dict[str, float]] = {}
                for ticker, qty in clean_positions.items():
                    entry_price = avg_cost.get(ticker, 0.0)
                    mark_price = latest_prices.get(ticker, entry_price)
                    pnl_pct = ((mark_price - entry_price) / entry_price * 100) if entry_price > 0 else 0.0
                    position_metrics[ticker] = {
                        "entry_price": round(entry_price, 2),
                        "mark_price": round(mark_price, 2),
                        "pnl_pct": round(pnl_pct, 2)
                    }

                return {"positions": clean_positions, "position_metrics": position_metrics}
            except Exception as e:
                logger.error(f"Failed to build positions: {e}")
                return {"positions": {}, "position_metrics": {}}

        @self.app.get("/api/bot/trades")
        async def get_bot_trades(db: Session = Depends(get_session)):
            try:
                statement = select(AITradeLog).order_by(AITradeLog.timestamp.desc())
                trades = db.exec(statement).all()
                return [
                    {
                        "id": t.id,
                        "ticker": t.ticker,
                        "side": t.side,
                        "price": t.price,
                        "quantity": t.quantity,
                        "strategy": t.strategy,
                        "pnl": t.pnl,
                        "timestamp": t.timestamp.isoformat()
                    }
                    for t in trades[:100]
                ]
            except Exception as e:
                logger.error(f"Failed to fetch bot trades: {e}")
                return []

        @self.app.get("/api/bot/status")
        async def get_bot_status():
            dnse_market = DnseMarketData()
            return {
                "running": True,
                "mode": "LIVE_SIMULATION",
                "strategy_label": "Multi-Strategy AI Hunter",
                "baseline_capital": settings.paper_account_balance,
                "market_data_source": "DNSE" if dnse_market.configured else "vnstock fallback",
                "real_order_execution": False,
            }

        @self.app.post("/api/bot/demo-scan")
        async def run_demo_scan(db: Session = Depends(get_session)):
            tickers = settings.scan_symbols
            trader = QuantTrader(db)
            await trader.scan_and_trade(tickers, manager)
            return {
                "status": "completed",
                "mode": "DEMO_ONLY",
                "tickers": tickers,
                "market_data_source": "DNSE" if DnseMarketData().configured else "vnstock fallback",
                "real_order_execution": False,
            }

        @self.app.get("/api/market/dnse/{ticker}")
        async def get_dnse_quote(ticker: str):
            quote = DnseMarketData().latest_trade(ticker)
            if quote:
                return quote
            return {
                "ticker": ticker.upper(),
                "source": "DNSE",
                "configured": DnseMarketData().configured,
                "error": "DNSE market data unavailable; set DNSE_API_KEY and DNSE_API_SECRET or use fallback data.",
            }

        @self.app.get("/api/analysis/trading-signals/{ticker}")
        async def get_trading_signals(ticker: str):
            ticker = ticker.upper()
            try:
                q = Quote(symbol=ticker, source=settings.vnstock_quote_sources[-1])
                df = q.history(length='3M', interval='1D')
                if df is None or df.empty or len(df) < 20:
                    raise ValueError("Insufficient signal data")

                df = df.sort_values(by='time', ascending=True)
                latest = df.iloc[-1]
                prev = df.iloc[-2]
                change_pct = float((latest["close"] - prev["close"]) / prev["close"] * 100)
                volume_ratio = float(latest["volume"] / max(1, df["volume"].tail(20).mean()))

                ma20 = float(df["close"].rolling(20).mean().iloc[-1])
                ma50 = float(df["close"].rolling(50).mean().iloc[-1]) if len(df) >= 50 else ma20
                trend_up = latest["close"] > ma20 > ma50

                short_signal = "MUA" if change_pct > 0 and volume_ratio >= 1 else "GIá»®"
                long_signal = "MUA" if trend_up else "THEO DÕI"

                return {
                    "short_term": {
                        "label": "Short-term Momentum",
                        "signal": short_signal,
                        "strength": int(min(95, max(40, abs(change_pct) * 20 + volume_ratio * 20))),
                        "indicators": {
                            "price_change": f"{change_pct:.2f}%",
                            "volume_ratio": f"{volume_ratio:.2f}x",
                            "trend": "up" if change_pct >= 0 else "down"
                        }
                    },
                    "long_term": {
                        "label": "Long-term Structure",
                        "signal": long_signal,
                        "strength": int(80 if trend_up else 55),
                        "indicators": {
                            "ma20": round(ma20, 2),
                            "ma50": round(ma50, 2),
                            "bias": "bullish" if trend_up else "neutral"
                        }
                    }
                }
            except Exception as e:
                logger.error(f"Failed to compute trading signals for {ticker}: {e}")
                return {
                    "short_term": {"label": "Short-term Momentum", "signal": "GIá»®", "strength": 50, "indicators": {}},
                    "long_term": {"label": "Long-term Structure", "signal": "THEO DÕI", "strength": 50, "indicators": {}}
                }

        @self.app.post("/api/trader/execute")
        async def execute_trade(payload: TradeRequest, db: Session = Depends(get_session)):
            ticker = payload.ticker.upper()
            side = payload.side.upper()
            if side not in {"BUY", "SELL"}:
                raise HTTPException(status_code=400, detail="side must be BUY or SELL")
            if payload.price <= 0 or payload.quantity <= 0:
                raise HTTPException(status_code=400, detail="price and quantity must be > 0")

            try:
                broker = BrokerTrader()
                result = await broker.place_order(
                    ticker=ticker,
                    side=side,
                    quantity=payload.quantity,
                    price=payload.price
                )

                trade = AITradeLog(
                    ticker=ticker,
                    side=side,
                    price=payload.price,
                    quantity=payload.quantity,
                    strategy="MANUAL_EXECUTION",
                    pnl=None
                )
                db.add(trade)
                db.commit()

                await manager.broadcast(f"CORE: [MANUAL] {side} {payload.quantity} {ticker} @ {payload.price:,.0f}")
                return result
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to execute trade: {e}")
                raise HTTPException(status_code=500, detail="failed to execute trade")

        @self.app.get("/api/analysis/technical/{ticker}")
        async def get_technical_analysis(ticker: str):
            ticker = ticker.upper()
            try:
                # Lấy dữ liệu 1 năm để tính toán các đường MA dài hạn
                q = Quote(symbol=ticker, source=settings.vnstock_quote_sources[-1])
                df = q.history(length='1Y', interval='1D')
                if df is None or df.empty or len(df) < 50:
                    raise Exception("Insufficient data")
                
                df = df.sort_values(by='time', ascending=True)
                latest = df.iloc[-1]
                prev = df.iloc[-2]
                
                # 1. TÍNH TOÁN CÁC CHỈ BÁO KỸ THUẬT NỀN TẢNG
                close_prices = df['close'].values
                ma50 = df['close'].rolling(window=50).mean().iloc[-1]
                ma150 = df['close'].rolling(window=150).mean().iloc[-1]
                ma200 = df['close'].rolling(window=200).mean().iloc[-1]
                
                # 2. XÁC ĐỊNH GIAI ĐOẠN (STAGE ANALYSIS BY STAN WEINSTEIN)
                stage = "Giai đoạn 1 (Tích lũy)"
                verdict = "THEO DÕI"
                color = "blue"
                
                if latest['close'] > ma50 > ma150 > ma200:
                    stage = "Giai đoạn 2 (Đẩy giá - Uptrend)"
                    verdict = "MUA / NẮM GIỮ"
                    color = "emerald"
                elif latest['close'] < ma50 < ma150 < ma200:
                    stage = "Giai đoạn 4 (Giảm giá - Downtrend)"
                    verdict = "BÁN / TRÁNH XA"
                    color = "rose"
                elif ma200 > ma150 and latest['close'] < ma150:
                    stage = "Giai đoạn 3 (Phân phối)"
                    verdict = "HẠ TỶ TRỌNG"
                    color = "orange"

                # 3. PHÂN TÍCH VSA (VOLUME SPREAD ANALYSIS)
                avg_vol = df['volume'].tail(20).mean()
                vol_ratio = latest['volume'] / avg_vol
                price_change = (latest['close'] - prev['close']) / prev['close']
                
                vsa_signal = "Neutral"
                supply_demand = "Cân bằng"
                
                if price_change > 0.02 and vol_ratio > 1.5:
                    vsa_signal = "Demand Bar (Cầu áp đảo)"
                    supply_demand = "Dòng tiền lớn nhập cuộc"
                elif price_change < -0.02 and vol_ratio > 1.5:
                    vsa_signal = "Supply Bar (Áp lực bán tháo)"
                    supply_demand = "Tổ chức thoát hàng"
                elif abs(price_change) < 0.005 and vol_ratio < 0.6:
                    vsa_signal = "No Supply Bar"
                    supply_demand = "Kiệt cung - Cực kỳ tích cực"

                # 4. TÍNH TOÁN ĐIỂM PIVOT & TÍN HIỆU SEPA
                current_price = latest['close']
                high_52w = df['high'].max()
                low_52w = df['low'].min()
                dist_from_high = (high_52w - current_price) / high_52w
                
                reason = "Cổ phiếu đang tích lũy trong nền giá chặt chẽ."
                if dist_from_high < 0.05 and vol_ratio > 1.2:
                    reason = "Đang áp sát đỉnh 52 tuần với khối lượng tăng dần. Dấu hiệu Breakout."
                elif current_price > ma50 and price_change > 0:
                    reason = "Vận động tích cực trên đường MA50 dốc lên."

                return {
                    "ticker": ticker,
                    "stage": stage,
                    "status": "Tích cực" if verdict in ["MUA", "NẮM GIỮ"] else "Cần quan sát",
                    "vsa_signal": vsa_signal,
                    "supply_demand": supply_demand,
                    "order_flow": {
                        "buy": int(60 if price_change > 0 else 40),
                        "sell": int(40 if price_change > 0 else 60)
                    },
                    "pivot_point": round(high_52w, 1),
                    "verdict": verdict,
                    "reason": reason,
                    "metrics": {
                        "ma50": round(ma50, 1),
                        "ma200": round(ma200, 1),
                        "vol_ratio": round(vol_ratio, 2),
                        "dist_high_52w": round(dist_from_high * 100, 1)
                    }
                }
            except Exception as e:
                logger.error(f"Analysis Engine Error: {e}")
                return {
                    "stage": "Đang quét dữ liệu...",
                    "status": "N/A",
                    "vsa_signal": "Analyzing...",
                    "supply_demand": "Calculating...",
                    "order_flow": {"buy": 50, "sell": 50},
                    "pivot_point": 0,
                    "verdict": "CHỜ DỮ LIỆU",
                    "reason": f"Đang đồng bộ hóa dữ liệu từ Vnstock: {str(e)}"
                }

        @self.app.get("/api/analysis/reports/{ticker}")
        async def get_reports(ticker: str):
            ticker = ticker.upper()
            news = await self.news_aggregator.get_aggregated_news(ticker, limit=10)
            reports = []
            for item in news:
                link = item.get("link") or item.get("url") or ""
                title = item.get("title", "")
                reports.append({
                    "firm": item.get("source", "Public source"),
                    "title": title,
                    "date": item.get("time") or item.get("publishedAt") or datetime.now().strftime("%d/%m/%Y"),
                    "link": link,
                    "recommendation": item.get("category", "NEWS"),
                    "target_price": 0,
                    "upside": 0,
                })
            return reports

        @self.app.get("/api/analysis/prospects/{ticker}")
        async def get_prospects(ticker: str):
            ticker = ticker.upper()
            research = get_research_model(ticker)
            if research:
                return {
                    "company_name": research["company_name"],
                    "exchange": research["exchange"],
                    "industry": research["industry"],
                    "health_score": research["scores"]["fundamental"],
                    "recommendation": research["recommendation"],
                    "target_price": research["target_price"],
                    "weighted_target": research["weighted_target"],
                    "upside": research["upside"],
                    "risk_level": research["risk_level"],
                    "confidence_score": research["confidence_score"],
                    "holding_period": research["holding_period"],
                    "scores": research["scores"],
                    "executive_summary": research["executive_summary"],
                    "ratio_notes": research.get("ratio_notes", {}),
                    "forecast_period_years": research.get("forecast_period_years", 0),
                    "final_opinion": research.get("final_opinion", ""),
                    "growth_pillars": [
                        {"title": item["title"], "content": item["detail"]}
                        for item in research["catalysts"]
                    ],
                    "strategic_catalysts": research["catalysts"],
                    "risk_assessment": research["risks"],
                    "consensus": {
                        "buy": 8 if research["recommendation"] in {"MUA", "KHẢ QUAN"} else 3,
                        "hold": 2,
                        "sell": 0 if research["recommendation"] in {"MUA", "KHẢ QUAN"} else 1,
                        "avg_target": research["weighted_target"],
                        "max_target": research["scenario"]["bull"]["target"],
                        "min_target": research["scenario"]["bear"]["target"],
                    },
                    "updated_at": datetime.now().strftime("%d/%m/%Y"),
                    "research_id": f"{ticker}-{datetime.now().year}-RESEARCH",
                }
            return {}

    async def _heartbeat_task(self):
        msgs = ["AI Engine Online", "Scanning Patterns...", "Monitoring Liquidity..."]
        while True:
            await manager.broadcast(f"CORE: {random.choice(msgs)}")
            await asyncio.sleep(5)

terminal = VNStockTerminalApp()
app = terminal.app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        reload_excludes=["venv/*", "__pycache__/*", "*.log"],
    )
