import asyncio
import os
import logging
import json
import random
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv
from pydantic import BaseModel
from vnstock import Quote

# Import database components
from database import create_db_and_tables, get_session, News, MacroIndicator, AITradeLog, Watchlist, StrategyScore, engine
from scraper import NewsAggregator
from services import StrategyEvaluator, MacroEngine, QuantTrader, TelegramService, BrokerTrader, OpenAICodexAdvisor
from live_dashboard import get_quant_dashboard, get_strategic_dashboard, data_sources

# Load environment variables
load_dotenv()

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
            version="3.0.0"
        )
        self.news_aggregator = NewsAggregator()
        self._setup_middleware()
        self._setup_routes()

    def _setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
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

        @self.app.on_event("startup")
        def on_startup():
            logger.info("Starting up VN Stock Terminal Engine (LIVE MODE)...")
            create_db_and_tables()
            asyncio.create_task(self._heartbeat_task())

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
            tickers = ["FPT", "SSI", "HPG", "VCB", "DGC", "VNM", "TCB", "MWG", "PNJ", "VIC"]
            result = []
            try:
                for t in tickers:
                    try:
                        q = Quote(symbol=t, source='KBS')
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
                return result if result else [{"ticker": "FPT", "price": 135.2, "change": 0.5}]
            except Exception as e:
                logger.error(f"Ticker Tape Error: {e}")
                return []

        @self.app.get("/api/market/history/{ticker}")
        async def get_history(ticker: str):
            ticker = ticker.upper()
            try:
                # 1. Thử lấy TOÀN BỘ dữ liệu thực từ vnstock (Nguồn VCI/KBS hỗ trợ Quote)
                for src in ['VCI', 'KBS']:
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
                
            # 2. Fallback: Dữ liệu "toàn vòng đời" Synthetic (5000 phiên ~ 20 năm)
            logger.warning(f"Using ultra-long synthetic fallback for {ticker}")
            base_prices = {"FPT": 135.2, "SSI": 38.1, "HPG": 28.5, "VCB": 92.4}
            base = base_prices.get(ticker, 50.0) / 10 
            history = []
            current_date = datetime.now()
            for i in range(5000, 0, -1):
                date_str = (current_date - timedelta(days=int(i * 1.4))).strftime("%Y-%m-%d")
                growth_bias = 0.0005 
                change = base * (0.015 * random.uniform(-1.0, 1.2) + growth_bias)
                open_p = base
                close_p = open_p + change
                history.append({
                    "time": date_str, "open": round(open_p, 1), 
                    "high": round(max(open_p, close_p) + (base * 0.008), 1),
                    "low": round(min(open_p, close_p) - (base * 0.008), 1), 
                    "close": round(close_p, 1),
                    "volume": random.randint(500000, 15000000)
                })
                base = max(close_p, 0.1)
            return history

        @self.app.get("/api/market/intraday/{ticker}")
        async def get_intraday(ticker: str):
            ticker = ticker.upper()
            try:
                q = Quote(symbol=ticker, source='KBS')
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
                for src in ['KBS', 'VCI']:
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
        @self.app.get("/api/news/{ticker_or_cat}")
        async def get_news(ticker_or_cat: str):
            return await self.news_aggregator.get_aggregated_news(ticker_or_cat.upper())

        @self.app.get("/api/data/sources")
        async def get_data_sources():
            return data_sources()

        @self.app.get("/api/quant/dashboard")
        async def get_quant_dashboard_api():
            return get_quant_dashboard()

        @self.app.get("/api/strategic/dashboard")
        async def get_strategic_dashboard_api():
            return get_strategic_dashboard()

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
                quote = Quote(symbol=ticker, source='KBS')
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

        # --- FINANCE & VALUATION ---
        @self.app.get("/api/finance/ratios/{ticker}")
        async def get_ratios(ticker: str):
            ticker = ticker.upper()
            ratios = {
                "FPT": {
                    "pe": 22.4, "pb": 5.8, "roe": 28.5, "margin": 14.2, "debt_equity": 0.42, "eps": 6050,
                    "status": {"pe": "warning", "roe": "good", "margin": "good", "debt_equity": "good"},
                    "notes": {
                        "pe": "Trung bình ngành: 14.2x",
                        "roe": "Khả năng sinh lời vượt trội",
                        "margin": "Biên lợi nhuận gộp cải thiện",
                        "debt_equity": "Đòn bẩy an toàn"
                    }
                },
                "SSI": {
                    "pe": 18.2, "pb": 2.1, "roe": 14.5, "margin": 32.8, "debt_equity": 1.25, "eps": 2100,
                    "status": {"pe": "neutral", "roe": "good", "margin": "good", "debt_equity": "warning"},
                    "notes": {
                        "pe": "Định giá trung tính theo chu kỳ",
                        "roe": "ROE ổn định theo chu kỳ thị trường",
                        "margin": "Biên lợi nhuận môi giới cải thiện",
                        "debt_equity": "Đòn bẩy cao, cần quản trị rủi ro"
                    }
                },
                "HPG": {
                    "pe": 16.5, "pb": 1.7, "roe": 11.8, "margin": 8.5, "debt_equity": 0.62, "eps": 1750,
                    "status": {"pe": "good", "roe": "neutral", "margin": "warning", "debt_equity": "good"},
                    "notes": {
                        "pe": "Định giá hấp dẫn so với lịch sử",
                        "roe": "ROE cần xác nhận khi chu kỳ hồi phục",
                        "margin": "Biên lợi nhuận còn chịu áp lực đầu vào",
                        "debt_equity": "Cấu trúc vốn trong vùng an toàn"
                    }
                },
                "VCB": {
                    "pe": 14.8, "pb": 2.8, "roe": 21.2, "margin": 42.5, "debt_equity": 0.15, "eps": 6250,
                    "status": {"pe": "good", "roe": "good", "margin": "good", "debt_equity": "good"},
                    "notes": {
                        "pe": "Định giá hợp lý cho ngân hàng đầu ngành",
                        "roe": "Hiệu quả sinh lời thuộc nhóm dẫn đầu",
                        "margin": "NIM ổn định với chất lượng tài sản tốt",
                        "debt_equity": "Đòn bẩy thấp, bộ đệm rủi ro tốt"
                    }
                }
            }
            default_ratio = {
                "pe": 15.0, "pb": 1.5, "roe": 15.0, "margin": 15.0, "debt_equity": 0.5, "eps": 2000,
                "status": {"pe": "neutral", "roe": "neutral", "margin": "neutral", "debt_equity": "good"},
                "notes": {
                    "pe": "Đang cập nhật theo ngành",
                    "roe": "Đang cập nhật theo chu kỳ",
                    "margin": "Đang cập nhật biên lợi nhuận",
                    "debt_equity": "Đang cập nhật cơ cấu vốn"
                }
            }
            return ratios.get(ticker, default_ratio)

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
                    "reason": f"Backend live scan: {item['setupStatus']}, change {item['changePct']}%, sector {item['sector']}.",
                    "entry_zone": item["buyZone"],
                    "target": item["target1"],
                    "risk": item["creditSensitivity"],
                }
                for item in rows[:5]
            ]
            # Trả về danh sách cổ phiếu tiềm năng dựa trên tăng trưởng cơ bản và phân tích kỹ thuật (đầu trend tăng)
            return [
                {
                    "ticker": "FPT",
                    "reason": "Dẫn sóng ngành Công nghệ. Tăng trưởng EPS >20%. Technical: Giai đoạn 2 (Đẩy giá) xác nhận dòng tiền.",
                    "entry_zone": "132.0 - 135.0",
                    "target": "168.0",
                    "risk": "Thấp"
                },
                {
                    "ticker": "SSI",
                    "reason": "Hưởng lợi KRX & Nâng hạng. Định giá P/B hợp lý. Technical: Pocket Pivot từ nền tảng chặt chẽ.",
                    "entry_zone": "37.0 - 38.0",
                    "target": "45.0",
                    "risk": "Trung bình"
                },
                {
                    "ticker": "DGC",
                    "reason": "Hưởng lợi giá Phốt pho vàng phục hồi. Hàng tồn kho giá rẻ. Technical: Mới bứt phá khỏi vùng MA50.",
                    "entry_zone": "115.0 - 118.0",
                    "target": "140.0",
                    "risk": "Trung bình"
                }
            ]

        @self.app.get("/api/finance/valuation/dcf/{ticker}")
        async def get_dcf_valuation(ticker: str):
            ticker = ticker.upper()
            data = {
                "FPT": {
                    "current_price": 135200, "intrinsic_value": 168000, "upside": 24.3,
                    "wacc": 10.2, "growth_rate": 20.0, "terminal_growth": 3.0,
                    "fcf_projections": [6450, 7850, 9500, 11400, 13700],
                    "assumptions": ["Doanh thu Công nghệ tăng trưởng >25%/năm", "Lợi nhuận AI Factory từ cuối 2025", "Biên lợi nhuận gộp ~40%"],
                    "history": [
                        {"year": "2021", "revenue": 35657, "profit": 4337, "margin": 12.2},
                        {"year": "2022", "revenue": 44010, "profit": 5310, "margin": 12.1},
                        {"year": "2023", "revenue": 52618, "profit": 6470, "margin": 12.3},
                        {"year": "2024", "revenue": 62500, "profit": 7800, "margin": 12.5},
                        {"year": "2025E", "revenue": 76000, "profit": 9800, "margin": 12.9}
                    ]
                },
                "HPG": {
                    "current_price": 28500, "intrinsic_value": 38500, "upside": 35.1,
                    "wacc": 10.8, "growth_rate": 15.0, "terminal_growth": 2.0,
                    "fcf_projections": [4500, 5200, 12500, 15800, 18500],
                    "assumptions": ["Dung Quất 2 chạy thử Quý 1/2025", "Sản lượng tăng 60%", "Giá thép HRC ổn định"],
                    "history": [
                        {"year": "2020", "revenue": 91279, "profit": 13506, "margin": 14.8},
                        {"year": "2021", "revenue": 150865, "profit": 34521, "margin": 22.9},
                        {"year": "2022", "revenue": 142770, "profit": 8444, "margin": 5.9},
                        {"year": "2023", "revenue": 120355, "profit": 6800, "margin": 5.7},
                        {"year": "2024", "revenue": 148000, "profit": 12500, "margin": 8.4},
                        {"year": "2025E", "revenue": 195000, "profit": 21000, "margin": 10.8}
                    ]
                }
            }
            return data.get(ticker, data["FPT"])

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
                    "sepa_verdict": "BUY" if item["setupStatus"] == "Ready to Buy" else "WATCHLIST",
                }
                for item in strategic[:5]
            ]
            return {
                "mode": "GROWTH_HUNTING",
                "market_timing": "Backend live scan from vnstock",
                "ui": {
                    "table_title": "CANSLIM & SEPA live backend scanner",
                    "search_mode_label": "Backend API mode",
                },
                "focus_list": focus_list,
                "tactical_alerts": [],
            }
            return {
                "mode": "GROWTH_HUNTING",
                "market_timing": "Cơ hội giải ngân cao - Stage 2 xác nhận",
                "ui": {
                    "table_title": "Bộ lọc Siêu cổ phiếu CANSLIM & SEPA",
                    "search_mode_label": "Chế độ Tìm kiếm Chủ động"
                },
                "focus_list": [
                    {"ticker": "FPT", "canslim_score": 92, "tech_status": "Stage 2 / Pocket Pivot", "vsa_signal": "Cạn cung", "entry": "134.5", "potential": "+25%", "sepa_verdict": "BUY"},
                    {"ticker": "HPG", "canslim_score": 85, "tech_status": "Stage 1 / VCP", "vsa_signal": "Kiệt cung", "entry": "28.5", "potential": "+35%", "sepa_verdict": "WATCHLIST"},
                    {"ticker": "SSI", "canslim_score": 88, "tech_status": "Stage 2 / Spring", "vsa_signal": "Test Cung", "entry": "37.5", "potential": "+20%", "sepa_verdict": "BUY"}
                ],
                "tactical_alerts": [
                    {
                        "title": "Xác nhận Pocket Pivot",
                        "message": "FPT đã vượt qua vùng cung 134.5 với khối lượng lớn. Điểm mua Pocket Pivot cực chuẩn trong nền giá Stage 2.",
                        "level": "info"
                    },
                    {
                        "title": "Kiệt cung Xác nhận",
                        "message": "HPG xuất hiện 3 phiên No Supply Bar liên tiếp. Khối lượng cạn kiệt cho thấy lực bán đã hoàn toàn biến mất.",
                        "level": "positive"
                    },
                    {
                        "title": "VCP Setup",
                        "message": "Dòng thép và chứng khoán đang hình thành mô hình thu hẹp biên độ VCP chặt chẽ. Chờ đợi nhịp Breakout để mở vị thế.",
                        "level": "warning"
                    }
                ]
            }

        @self.app.get("/api/account/balance")
        async def get_balance(): return {"balance": 1250000000}

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
            return {
                "running": True,
                "mode": "LIVE_SIMULATION",
                "strategy_label": "Multi-Strategy AI Hunter",
                "baseline_capital": 1000000000
            }

        @self.app.get("/api/analysis/trading-signals/{ticker}")
        async def get_trading_signals(ticker: str):
            ticker = ticker.upper()
            try:
                q = Quote(symbol=ticker, source='KBS')
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

                short_signal = "MUA" if change_pct > 0 and volume_ratio >= 1 else "GIỮ"
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
                    "short_term": {"label": "Short-term Momentum", "signal": "GIỮ", "strength": 50, "indicators": {}},
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
                q = Quote(symbol=ticker, source='KBS')
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
            reports = {
                "FPT": [
                    {"firm": "VNDirect", "title": "FPT: Định giá lại nhờ AI & Bán dẫn", "date": "27/05/2024", "link": "https://www.vndirect.com.vn/cmsupload/beta/Bao-cao-cap-nhat-FPT_270524.pdf", "recommendation": "MUA", "target_price": 172000, "upside": 27.2},
                    {"firm": "SHS", "title": "Cơ hội từ hệ sinh thái AI", "date": "08/04/2025", "link": "https://www.shs.com.vn/Data/Reports/2025/Bao-cao-cap-nhat-FPT_080425.pdf", "recommendation": "KHẢ QUAN", "target_price": 165500, "upside": 22.4}
                ]
            }
            default_reports = [
                {"firm": "CafeF", "title": f"Báo cáo phân tích {ticker}", "date": "2026", "link": f"https://cafef.vn/ho-so/{ticker}.chn", "recommendation": "TRUNG LẬP", "target_price": 0, "upside": 0}
            ]
            return reports.get(ticker, default_reports)

        @self.app.get("/api/analysis/prospects/{ticker}")
        async def get_prospects(ticker: str):
            ticker = ticker.upper()
            
            # Giả lập dữ liệu Consensus & Target Price chuyên nghiệp
            # Trong thực tế, dữ liệu này sẽ được cào hoặc tính toán từ các báo cáo CTCK
            catalysts = {
                "FPT": {
                    "company_name": "Công ty Cổ phần FPT",
                    "exchange": "HOSE",
                    "industry": "Công nghệ thông tin",
                    "health_score": 92,
                    "recommendation": "MUA",
                    "target_price": 168000,
                    "upside": 24.3,
                    "risk_level": "Thấp",
                    "confidence_score": 85,
                    "holding_period": "12 Tháng",
                    "scores": {
                        "fundamental": 95,
                        "technical": 82,
                        "momentum": 88,
                        "risk": 90
                    },
                    "executive_summary": [
                        "Dẫn đầu làn sóng AI và Bán dẫn tại Việt Nam thông qua hợp tác chiến lược với NVIDIA.",
                        "Doanh thu chuyển đổi số duy trì đà tăng trưởng mạnh mẽ trên 30% tại thị trường Nhật Bản và Mỹ.",
                        "Biên lợi nhuận cải thiện nhờ tối ưu hóa chi phí và tăng tỷ trọng mảng dịch vụ phần mềm.",
                        "Nền tảng tài chính cực kỳ lành mạnh với lượng tiền mặt lớn và nợ vay thấp.",
                        "Catalyst chính: Khai trương AI Factory vào Q3/2026 và các hợp đồng tỷ đô mới."
                    ],
                    "growth_pillars": [
                        {"title": "Bán dẫn & AI", "content": "Xây dựng hệ sinh thái AI toàn diện từ hạ tầng đến ứng dụng."},
                        {"title": "Thị trường Toàn cầu", "content": "Mở rộng dấu ấn tại thị trường EU và Singapore."},
                        {"title": "Giáo dục FPT", "content": "Tăng trưởng số lượng người học đảm bảo nguồn nhân lực dài hạn."}
                    ],
                    "strategic_catalysts": ["AI Factory 2026", "Nâng hạng thị trường", "Cổ tức tiền mặt"],
                    "risk_assessment": [
                        {"title": "Tỷ giá JPY/VND", "impact": "Medium", "content": "Biến động tỷ giá ảnh hưởng doanh thu từ thị trường Nhật."},
                        {"title": "Nhân lực IT", "impact": "High", "content": "Cạnh tranh gay gắt về nguồn cung nhân sự chất lượng cao."}
                    ],
                    "consensus": {
                        "buy": 12, "hold": 2, "sell": 0,
                        "avg_target": 165500,
                        "max_target": 180000,
                        "min_target": 155000
                    },
                    "updated_at": "27/05/2024",
                    "research_id": "FPT-2026-AUTO"
                },
                "HPG": {
                    "company_name": "Tập đoàn Hòa Phát",
                    "exchange": "HOSE",
                    "industry": "Thép & Vật liệu xây dựng",
                    "health_score": 88,
                    "recommendation": "KHẢ QUAN",
                    "target_price": 38500,
                    "upside": 35.1,
                    "risk_level": "Trung bình",
                    "confidence_score": 78,
                    "holding_period": "6-12 Tháng",
                    "scores": {"fundamental": 85, "technical": 75, "momentum": 70, "risk": 80},
                    "executive_summary": [
                        "Dự án Dung Quất 2 là động lực tăng trưởng chính trong giai đoạn 2025-2027.",
                        "Chi phí sản xuất tối ưu nhất khu vực nhờ quy trình khép kín hiện đại.",
                        "Hưởng lợi từ chu kỳ phục hồi của thị trường Bất động sản và Đầu tư công.",
                        "Rủi ro chính đến từ biến động giá nguyên liệu đầu vào và nhu cầu thép thế giới."
                    ],
                    "growth_pillars": [
                        {"title": "Dung Quất 2", "content": "Tăng 60% công suất HRC khi đi vào hoạt động."},
                        {"title": "Thép Xanh", "content": "Đáp ứng tiêu chuẩn CBAM để xuất khẩu vào EU."},
                        {"title": "Container", "content": "Tối ưu hóa hệ sinh thái sản xuất thép."}
                    ],
                    "strategic_catalysts": ["Vận hành DQ2", "Giá HRC phục hồi", "Lãi suất giảm"],
                    "risk_assessment": [
                        {"title": "Giá Quặng sắt", "impact": "High", "content": "Nguyên liệu chiếm tỷ trọng lớn trong giá thành."},
                        {"title": "BĐS đóng băng", "impact": "Medium", "content": "Nhu cầu tiêu thụ thép xây dựng nội địa giảm."}
                    ],
                    "consensus": {
                        "buy": 15, "hold": 4, "sell": 1,
                        "avg_target": 36800,
                        "max_target": 42000,
                        "min_target": 29500
                    },
                    "updated_at": "08/04/2025",
                    "research_id": "HPG-2026-AUTO"
                }
            }
            
            # Default response
            default_data = {
                "company_name": f"Doanh nghiệp {ticker}",
                "exchange": "HOSE",
                "industry": "Đang cập nhật",
                "health_score": 75,
                "recommendation": "TRUNG LẬP",
                "target_price": 0,
                "upside": 0,
                "risk_level": "Trung bình",
                "confidence_score": 70,
                "holding_period": "Theo dõi",
                "scores": {"fundamental": 70, "technical": 70, "momentum": 65, "risk": 75},
                "executive_summary": [
                    f"Cổ phiếu {ticker} đang trong giai đoạn tích lũy và chờ đợi tín hiệu dòng tiền.",
                    "Vận động giá tương đối ổn định so với chỉ số chung VN-Index.",
                    "Cần quan sát thêm kết quả kinh doanh quý tới để xác nhận luận điểm tăng trưởng."
                ],
                "growth_pillars": [
                    {"title": "Vị thế Ngành", "content": "Duy trì thị phần trong bối cảnh cạnh tranh."},
                    {"title": "Tối ưu vận hành", "content": "Áp dụng công nghệ giảm chi phí quản lý."}
                ],
                "strategic_catalysts": ["KQKD Quý tới", "Dòng tiền ngoại"],
                "risk_assessment": [
                    {"title": "Kinh tế vĩ mô", "impact": "Medium", "content": "Lạm phát và lãi suất ảnh hưởng chi phí vốn."}
                ],
                "consensus": {"buy": 5, "hold": 3, "sell": 1, "avg_target": 0, "max_target": 0, "min_target": 0},
                "updated_at": datetime.now().strftime("%d/%m/%Y"),
                "research_id": f"{ticker}-AUTO"
            }
            
            return catalysts.get(ticker, default_data)

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
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_excludes=["venv/*", "__pycache__/*", "*.log"],
    )
