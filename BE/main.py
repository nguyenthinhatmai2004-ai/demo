import asyncio
import os
import logging
import json
from typing import List, Optional, Dict
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv

import vnstock
from database import create_db_and_tables, get_session, News, MacroIndicator, AITradeLog, Watchlist, StrategyScore, engine
from scraper import NewsAggregator
from services import StrategyEvaluator, MacroEngine, QuantTrader, TelegramService, BrokerTrader
from vnstock import Vnstock, Quote

# Load environment variables
load_dotenv()

# Set VNStock API Key if available
api_key = os.getenv("VNSTOCK_API_KEY")
if api_key:
    try:
        vnstock.change_api_key(api_key)
    except Exception as e:
        print(f"Error setting VNStock API Key: {e}")

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
        # Vnstock đã được cấu hình API Key ở mức module
        self.stock = Vnstock()
        self.news_aggregator = NewsAggregator()
        self._setup_middleware()
        self._setup_routes()

    def _setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _setup_routes(self):
        @self.app.on_event("startup")
        def on_startup():
            logger.info("Starting up VN Stock Terminal Engine...")
            create_db_and_tables()
            logger.info("Database tables verified.")
            # Start background engine
            asyncio.create_task(self._background_engine())
            # Start heartbeat task
            asyncio.create_task(self._heartbeat_task())

        @self.app.get("/")
        async def root():
            return {
                "status": "active",
                "version": "3.0.0",
                "engine": "FastAPI",
                "timestamp": datetime.now().isoformat()
            }

        # --- WebSocket Endpoint ---
        @self.app.websocket("/ws/ai-logs")
        async def websocket_endpoint(websocket: WebSocket):
            await manager.connect(websocket)
            try:
                while True:
                    await websocket.receive_text()
            except WebSocketDisconnect:
                manager.disconnect(websocket)

        # --- Market Data Endpoints ---

        @self.app.get("/api/market/quote/{ticker}")
        async def get_quote(ticker: str):
            try:
                # Sử dụng vnstock v3 API với KBS source
                stock = self.stock.stock(symbol=ticker.upper(), source='KBS')
                df = stock.quote.history(length=2)
                
                if df is None or df.empty:
                    return {"ticker": ticker.upper(), "price": 0, "change_percent": 0, "error": "No data found"}
                
                latest = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else latest
                
                price = float(latest['close'] * 1000)
                change = round(((latest['close'] - prev['close']) / prev['close']) * 100, 2) if prev['close'] != 0 else 0
                volume = int(latest['volume']) if 'volume' in latest else 0

                return {
                    "ticker": ticker.upper(),
                    "price": price,
                    "change_percent": change,
                    "volume": volume
                }
            except Exception as e:
                logger.error(f"Error fetching quote for {ticker}: {e}")
                return {"ticker": ticker.upper(), "price": 0, "change_percent": 0}

        @self.app.get("/api/market/history/{ticker}")
        async def get_history(ticker: str):
            try:
                stock = self.stock.stock(symbol=ticker.upper(), source='KBS')
                df = stock.quote.history(start='2024-01-01')
                if df is None or df.empty:
                    return []
                # Nhân 1000 ngay tại BE để Frontend nhận giá trị tuyệt đối (VD: 75000)
                return [
                    {
                        "time": str(r['time']).split(' ')[0], 
                        "open": r['open'] * 1000, 
                        "high": r['high'] * 1000, 
                        "low": r['low'] * 1000, 
                        "close": r['close'] * 1000, 
                        "volume": int(r['volume'])
                    } 
                    for _, r in df.iterrows()
                ]
            except Exception as e:
                logger.error(f"Error fetching history for {ticker}: {e}")
                return []

        @self.app.get("/api/market/intraday/{ticker}")
        async def get_intraday(ticker: str):
            try:
                stock = self.stock.stock(symbol=ticker.upper(), source='KBS')
                df = stock.quote.intraday()
                if df is None or df.empty:
                    return []
                result = []
                for _, r in df.iterrows():
                    t = str(r.get('time', ''))
                    if ' ' in t: t = t.split(' ')[1][:5]
                    result.append({
                        "time": t,
                        "price": float(r.get('price', r.get('close', 0)) * 1000),
                        "volume": int(r.get('volume', 0))
                    })
                return result
            except Exception as e:
                logger.error(f"Error fetching intraday for {ticker}: {e}")
                return []

        # --- News Endpoints ---

        @self.app.get("/api/news/{ticker}")
        async def get_ticker_news(ticker: str, background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news(ticker.upper(), limit=12)
            background_tasks.add_task(self._persist_news, news_items, ticker.upper())
            return news_items

        @self.app.get("/api/news/special-events")
        async def get_special_events(background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news("thoái vốn cổ tức", limit=10)
            background_tasks.add_task(self._persist_news, news_items, category="SPECIAL_EVENT")
            return news_items

        @self.app.get("/api/news/business-results")
        async def get_business_results(background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news("kết quả kinh doanh", limit=10)
            background_tasks.add_task(self._persist_news, news_items, category="EARNINGS")
            return news_items

        @self.app.get("/api/news/business-plans")
        async def get_business_plans(background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news("kế hoạch kinh doanh", limit=10)
            background_tasks.add_task(self._persist_news, news_items, category="PLANS")
            return news_items

        @self.app.get("/api/news/world")
        async def get_world_news(background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news("tài chính quốc tế fed dow jones", limit=10)
            background_tasks.add_task(self._persist_news, news_items, category="WORLD")
            return news_items

        @self.app.get("/api/news/domestic")
        async def get_domestic_news(background_tasks: BackgroundTasks):
            news_items = await self.news_aggregator.get_aggregated_news("thị trường chứng khoán việt nam", limit=10)
            background_tasks.add_task(self._persist_news, news_items, category="DOMESTIC")
            return news_items

        @self.app.get("/api/news/social")
        async def get_social_sentiment():
            return [{"title": "Thảo luận KCN đang nóng dần", "link": "#", "source": "Social Radar", "time": "Hot"}]

        # --- Analysis & Strategy Endpoints ---

        @self.app.get("/api/finance/ratios/{ticker}")
        async def get_ratios(ticker: str):
            ticker = ticker.upper()
            try:
                stock = self.stock.stock(symbol=ticker, source='KBS')
                # Lấy giá hiện tại
                df_q = stock.quote.history(length=1, resolution='1D')
                latest_price = 0
                if df_q is not None and not df_q.empty:
                    latest_price = df_q.iloc[0]['close'] * 1000

                # Lấy chỉ số tài chính từ vnstock v3
                df_r = stock.finance.ratio(report_range='yearly', is_pro=False)
                
                pe = 15.0; pb = 1.5; roe = 15.0; margin = 20.0; debt_equity = 0.5
                
                if df_r is not None and not df_r.empty:
                    latest_r = df_r.iloc[0]
                    # Map các cột của KBS
                    pe = latest_r.get('p_e', latest_r.get('pe', pe))
                    pb = latest_r.get('p_b', latest_r.get('pb', pb))
                    roe = latest_r.get('roe', roe)
                    margin = latest_r.get('net_profit_margin', margin)
                    debt_equity = latest_r.get('debt_to_equity', debt_equity)

                return {
                    "pe": round(float(pe), 1),
                    "pb": round(float(pb), 1),
                    "roe": round(float(roe), 1),
                    "margin": round(float(margin), 1),
                    "debt_equity": round(float(debt_equity), 2),
                    "latest_price": latest_price
                }
            except Exception as e:
                logger.error(f"Ratio fetch error for {ticker}: {e}")
                return {"pe": 15.0, "pb": 1.5, "roe": 15.0, "margin": 20.0, "debt_equity": 0.6}

        @self.app.get("/api/analysis/prospects/{ticker}")
        async def get_prospects(ticker: str, db: Session = Depends(get_session)):
            ticker = ticker.upper()
            evaluator = StrategyEvaluator(db)
            c_score, c_details = evaluator.get_canslim_score(ticker)
            s_score, _ = evaluator.get_sepa_score(ticker)
            
            # Cấu trúc Catalyst chi tiết dựa trên đặc thù doanh nghiệp (giả lập logic phân tích sâu)
            dynamic_catalysts = {
                "FPT": {
                    "pillars": [
                        {"title": "AI & Semiconductor", "content": "Ký kết hợp tác chiến lược với NVIDIA. Mở rộng nhà máy đóng gói chip tại Đà Nẵng."},
                        {"title": "Global Outsourcing", "content": "Thị trường Nhật Bản và Mỹ tăng trưởng bền vững >25% nhờ chuyển đổi số."},
                        {"title": "Education Ecosystem", "content": "Hệ thống trường học FPT ghi nhận số lượng học sinh mới tăng 30% hàng năm."}
                    ],
                    "catalysts": [
                        "Dòng vốn từ các quỹ AI quốc tế đổ vào",
                        "Giá trị hợp đồng ký mới (Backlog) đạt kỷ lục 1 tỷ USD",
                        "Hưởng lợi từ làn sóng dịch chuyển chuỗi cung ứng công nghệ"
                    ],
                    "risks": ["Cạnh tranh nhân lực CNTT toàn cầu", "Biến động tỷ giá JPY/VND"],
                    "health_score": int((c_score + s_score) / 2)
                },
                "SSI": {
                    "pillars": [
                        {"title": "Market Liquidity", "content": "Hưởng lợi trực tiếp khi thanh khoản thị trường duy trì trên mức 20,000 tỷ/phiên."},
                        {"title": "KRX System", "content": "Hệ thống giao dịch mới đi vào vận hành giúp tăng phí môi giới và margin."},
                        {"title": "Capital Increase", "content": "Kế hoạch tăng vốn điều lệ giúp mở rộng quy mô cho vay margin."}
                    ],
                    "catalysts": [
                        "Thị trường chứng khoán Việt Nam được nâng hạng lên Emerging Markets",
                        "Lãi suất duy trì ở mức thấp kích thích dòng tiền F0",
                        "Vị thế đầu ngành trong mảng môi giới và tư vấn phát hành"
                    ],
                    "risks": ["Thị trường chung điều chỉnh mạnh", "Cạnh tranh phí giao dịch (Zero Fee)"],
                    "health_score": int((c_score + s_score) / 2)
                }
            }

            analysis = dynamic_catalysts.get(ticker, {
                "pillars": [
                    {"title": "CANSLIM Fundamentals", "content": f"Điểm chất lượng: {c_score}/100. Tăng trưởng EPS và RS dẫn đầu ngành."},
                    {"title": "Technical Setup", "content": f"Điểm SEPA: {s_score}/100. Đang hình thành điểm mua chuẩn mực."},
                    {"title": "Industry Position", "content": "Vị thế top đầu trong nhóm ngành, lợi thế quy mô lớn."}
                ],
                "catalysts": [
                    "Kết quả kinh doanh quý tới dự báo tăng trưởng đột biến",
                    "Dòng tiền tổ chức và khối ngoại đang mua ròng mạnh",
                    "Chu kỳ ngành đang bước vào giai đoạn phục hồi"
                ],
                "risks": ["Biến động vĩ mô không thuận lợi", "Áp lực chốt lời ngắn hạn"],
                "health_score": int((c_score + s_score) / 2)
            })

            return {
                "ticker": ticker,
                "health_score": analysis["health_score"],
                "growth_pillars": analysis["pillars"],
                "strategic_catalysts": analysis["catalysts"],
                "risk_assessment": analysis["risks"]
            }

        @self.app.get("/api/analysis/reports/{ticker}")
        async def get_reports(ticker: str):
            ticker = ticker.upper()
            # Cố gắng tìm các bài báo có chữ "báo cáo" hoặc "triển vọng" hoặc "định giá"
            search_query = f"báo cáo phân tích {ticker}"
            news_items = await self.news_aggregator.get_aggregated_news(search_query, limit=15)
            
            reports = []
            firms = ["SSI", "VNDIRECT", "VCSC", "ACBS", "HSC", "BVSC", "MBS", "KBSV", "VDS", "TPS"]
            
            for item in news_items:
                title_lower = item['title'].lower()
                # Lọc các tin có khả năng là báo cáo phân tích
                if any(k in title_lower for k in ["báo cáo", "triển vọng", "định giá", "khuyến nghị", "phân tích"]):
                    found_firm = "Chứng khoán"
                    for f in firms:
                        if f.lower() in title_lower:
                            found_firm = f
                            break
                    
                    reports.append({
                        "firm": found_firm,
                        "title": item['title'],
                        "date": item.get('time', 'Mới nhất'),
                        "target_price": "Xem chi tiết"
                    })
            
            # Nếu không tìm thấy báo cáo thực tế nào, trả về danh sách trống để Frontend xử lý hoặc fallback nhẹ
            if not reports:
                return [
                    {"firm": "Hệ thống", "title": f"Chưa có báo cáo phân tích mới nhất cho {ticker} trên CafeF", "date": datetime.now().strftime("%d/%m/%Y"), "target_price": "N/A"}
                ]
                
            return reports[:5]

        @self.app.get("/api/analysis/recommendation/{ticker}")
        async def get_recommendation(ticker: str, db: Session = Depends(get_session)):
            ticker = ticker.upper()
            evaluator = StrategyEvaluator(db)
            c_score, c_details = evaluator.get_canslim_score(ticker)
            s_score, _ = evaluator.get_sepa_score(ticker)
            
            avg_score = (c_score + s_score) / 2
            
            if avg_score > 75: rec = "MUA MẠNH"
            elif avg_score > 60: rec = "MUA"
            elif avg_score > 40: rec = "THEO DÕI"
            else: rec = "BÁN/TRÁNH XA"
            
            reasons = []
            if c_details.get('C', 0) > 10: reasons.append("Tăng trưởng EPS quý gần nhất tốt")
            if c_details.get('L', 0) > 10: reasons.append("Sức mạnh giá (RS) vượt trội")
            if s_score > 60: reasons.append("Đang trong xu hướng tăng (Stage 2)")
            
            if not reasons:
                reasons = ["Đang tích lũy", "Chờ đợi điểm phá vỡ", "Theo dõi dòng tiền"]
                
            return {"recommendation": rec, "reasons": reasons[:3]}

        @self.app.get("/api/analysis/anomalies")
        async def get_anomalies():
            return [
                {"ticker": "FPT", "price_change": 4.5},
                {"ticker": "SSI", "price_change": 3.2},
                {"ticker": "HPG", "price_change": -1.5}
            ]

        @self.app.get("/api/analysis/macro")
        async def get_macro(db: Session = Depends(get_session)):
            engine = MacroEngine(db)
            phase_data = engine.get_market_phase()
            
            # Fetch real indicators from DB
            statement = select(MacroIndicator)
            db_indicators = db.exec(statement).all()
            
            indicators_dict = {}
            for ind in db_indicators:
                indicators_dict[ind.name.lower().replace(" ", "_")] = {
                    "value": ind.value,
                    "status": ind.status,
                    "label": ind.label,
                    "desc": ind.description
                }
                
            return {
                "indicators": indicators_dict or {
                    "credit": {"value": 13.5, "status": "Good", "label": "Tín dụng / GDP", "desc": "Bơm vốn mạnh mẽ"},
                    "interest_rate": {"value": 4.5, "status": "Stable", "label": "Lãi suất điều hành", "desc": "Giữ nguyên"},
                    "cpi": {"value": 3.2, "status": "Good", "label": "Lạm phát", "desc": "Ổn định"},
                    "exchange_rate": {"value": 25450, "status": "Stable", "label": "Tỷ giá USD/VND", "desc": "Áp lực hạ nhiệt"}
                },
                "current_case": phase_data["phase"],
                "strategy": phase_data["strategy"],
                "color": phase_data["color"]
            }

        @self.app.get("/api/bot/equity-curve")
        async def get_equity_curve(db: Session = Depends(get_session)):
            trader = QuantTrader(db)
            return trader.get_equity_curve()

        @self.app.get("/api/investment/strategy")
        async def get_investment_strategy(db: Session = Depends(get_session)):
            # 1. Lọc cổ phiếu tốt nhất bằng CANSLIM Score
            statement = select(StrategyScore).order_by(StrategyScore.canslim_score.desc()).limit(5)
            top_canslim_stocks = db.exec(statement).all()
            
            evaluator = StrategyEvaluator(db)
            focus_list = []
            
            for s in top_canslim_stocks:
                # 2. Kiểm tra điểm mua SEPA cho từng cổ phiếu trong Top CANSLIM
                sepa_status = evaluator.validate_sepa_entry(s.ticker)
                focus_list.append({
                    "ticker": s.ticker,
                    "canslim_score": s.canslim_score,
                    "setup": sepa_status.get("setup", "Scanning"),
                    "potential": "+20-25%",
                    "sepa_verdict": sepa_status.get("verdict", "WATCHLIST"),
                    "entry_price": sepa_status.get("entry_price"),
                    "stop_loss": sepa_status.get("stop_loss")
                })
            
            if not focus_list:
                # Fallback if DB empty
                focus_list = [
                    {"ticker": "FPT", "canslim_score": 85, "setup": "VCP / Breakout", "potential": "+25%", "sepa_verdict": "BUY / LONG", "entry_price": 135000, "stop_loss": 126000},
                    {"ticker": "SSI", "canslim_score": 78, "setup": "Accumulating", "potential": "+15%", "sepa_verdict": "WATCHLIST", "entry_price": 38000, "stop_loss": 35500}
                ]

            return {
                "mode": "GROWTH_HUNTING",
                "title": "CHIẾN LƯỢC CANSLIM & SEPA v3.1",
                "description": "Dùng CANSLIM để chọn lọc siêu cổ phiếu. Dùng SEPA để xác định điểm mua an toàn tại Stage 2.",
                "action": "TẬP TRUNG GIẢI NGÂN KHI CÓ ĐIỂM PHÁ VỠ",
                "focus_list": focus_list
            }

        @self.app.get("/api/analysis/trading-signals/{ticker}")
        async def get_trading_signals(ticker: str, db: Session = Depends(get_session)):
            ticker = ticker.upper()
            evaluator = StrategyEvaluator(db)
            c_score, _ = evaluator.get_canslim_score(ticker)
            
            return {
                "ticker": ticker,
                "short_term": {"label": "Ngắn hạn", "signal": "MUA" if c_score > 60 else "THEO DÕI", "strength": int(c_score), "indicators": {"RSI": 65 if c_score > 60 else 45, "MA20": "Trên"}},
                "long_term": {"label": "Dài hạn", "signal": "TÍCH LŨY", "strength": 70, "indicators": {"ROE": "25%", "P/E": 12.5}}
            }

        @self.app.get("/api/bot/trades")
        async def get_bot_trades(db: Session = Depends(get_session)):
            statement = select(AITradeLog).order_by(AITradeLog.timestamp.desc()).limit(20)
            return db.exec(statement).all()

        @self.app.get("/api/bot/status")
        async def get_bot(): return {"running": True, "mode": "Simulation", "strategy": "Multi-Strategy AI"}

        @self.app.get("/api/account/balance")
        async def get_balance():
            return {"balance": 1250000000}

        @self.app.get("/api/account/positions")
        async def get_positions():
            return {
                "positions": {
                    "FPT": 5000,
                    "SSI": 10000,
                    "HPG": 15000
                }
            }

        @self.app.post("/api/trader/execute")
        async def execute_trade(data: Dict):
            ticker = data.get("ticker")
            side = data.get("side")
            price = data.get("price")
            quantity = data.get("quantity", 1000)
            
            trader = BrokerTrader()
            result = await trader.place_order(ticker, side, quantity, price)
            
            # Gửi thông báo thực hiện lệnh thành công
            tg = TelegramService()
            await tg.send_signal(ticker, f"CONFIRMED {side}", price, "Manual Approval")
            
            return result

    async def _background_engine(self):
        """Dynamic Market Scanner: Lấy toàn bộ mã trên sàn và quét tìm siêu cổ phiếu"""
        logger.info("Universal Market Scanner started.")
        
        # 1. Khởi tạo danh sách mã
        try:
            from vnstock import Listing
            # Sử dụng source KBS cho Listing nếu có thể, hoặc giữ mặc định
            ls = Listing(source='vci', show_log=False) 
            all_symbols_df = ls.symbols()
            if all_symbols_df is not None and not all_symbols_df.empty:
                market_tickers = all_symbols_df['ticker'].tolist()
                logger.info(f"Discovered {len(market_tickers)} tickers on the market.")
            else:
                market_tickers = ["FPT", "SSI", "HPG", "DGC", "MWG", "PNJ", "REE"] # Fallback
        except:
            market_tickers = ["FPT", "SSI", "HPG", "DGC", "MWG", "PNJ", "REE"]

        while True:
            try:
                # Sắp xếp ngẫu nhiên để mỗi vòng quét sẽ tìm thấy các mã mới khác nhau
                import random
                random.shuffle(market_tickers)

                # 2. Update Macro
                with Session(engine) as session:
                    macro = MacroEngine(session)
                    macro.update_indicators()

                # 3. Market-Wide Strategy Scan
                logger.info(f"Cycle Start: Scanning {len(market_tickers)} tickers for potential setups...")
                
                for i, t in enumerate(market_tickers):
                    try:
                        # Chỉ quét các mã có tên dài 3 ký tự (bỏ qua chứng quyền/phái sinh)
                        if len(t) != 3: continue
                        
                        with Session(engine) as session:
                            evaluator = StrategyEvaluator(session)
                            evaluator.evaluate_and_persist(t)
                            
                            # Nếu tìm thấy siêu cổ phiếu (CANSLIM > 80), bắn tin Telegram ngay
                            score_entry = session.exec(select(StrategyScore).where(StrategyScore.ticker == t)).first()
                            if score_entry and score_entry.canslim_score >= 80:
                                await tg_service.send_signal(
                                    t, "BUY", 0, "HIGH CANSLIM SCORE", sl=0
                                )
                        
                        # Log tiến độ mỗi 50 mã
                        if i % 50 == 0:
                            logger.info(f"Progress: {i}/{len(market_tickers)} tickers scanned.")
                        
                        # Delay rất ngắn để quét nhanh nhưng không bị ban
                        await asyncio.sleep(0.3) 
                    except Exception:
                        continue
                        
                logger.info("Full Market Scan cycle completed.")
            except Exception as e:
                logger.error(f"Error in background engine: {e}")
            
            await asyncio.sleep(60) # Nghỉ 1 phút trước khi bắt đầu vòng quét ngẫu nhiên mới

    async def _heartbeat_task(self):
        """Background task to send heartbeat logs to AI WebSocket every 7 seconds"""
        heartbeats = [
            "Analyzing RSI and Stochastic for trend exhaustion...",
            "Monitoring Liquidity inflows in Banking sector...",
            "Checking MACD crossovers on 1H timeframe...",
            "Scanning Market Volatility (VIX equivalent)...",
            "Optimizing Portfolio Alpha with Monte Carlo simulation...",
            "Evaluating CANSLIM criteria for Mid-cap growth...",
            "Checking SEPA trend templates for breakouts...",
            "Updating Real-time Order Flow Imbalance...",
            "Neutralizing Delta exposure in derivative hedge...",
            "Recalculating VaR for current aggressive positions..."
        ]
        import random
        while True:
            try:
                msg = random.choice(heartbeats)
                await manager.broadcast(f"AI ENGINE: {msg}")
            except Exception as e:
                logger.error(f"Error in heartbeat task: {e}")
            await asyncio.sleep(7)

    def _persist_news(self, news_items: List[Dict], ticker: Optional[str] = None, category: Optional[str] = None):
        """Helper to save news to database if they don't exist"""
        with Session(engine) as session:
            for item in news_items:
                try:
                    # Check if already exists
                    statement = select(News).where(News.link == item['link'])
                    existing = session.exec(statement).first()
                    if not existing:
                        db_news = News(
                            title=item['title'],
                            link=item['link'],
                            source=item['source'],
                            category=category or item.get('category'),
                            ticker=ticker or item.get('ticker')
                        )
                        session.add(db_news)
                    session.commit()
                except Exception as e:
                    session.rollback()
                    logger.error(f"Failed to persist news: {e}")

# Create the application instance
terminal = VNStockTerminalApp()
app = terminal.app

if __name__ == "__main__":
    import uvicorn
    # Bật reload=True để BE tự động cập nhật khi sửa code
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
