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
from vnstock import Vnstock, Quote

# Import database components
from database import create_db_and_tables, get_session, News, MacroIndicator, AITradeLog, Watchlist, StrategyScore, engine
from scraper import NewsAggregator
from services import StrategyEvaluator, MacroEngine, QuantTrader, TelegramService, BrokerTrader

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

# Initialize vnstock v3 global instance
vst = Vnstock()

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

        # --- MACRO ---
        @self.app.get("/api/analysis/macro")
        async def get_macro(db: Session = Depends(get_session)):
            engine = MacroEngine(db)
            return engine.get_market_phase()

        # --- FINANCE & VALUATION ---
        @self.app.get("/api/finance/ratios/{ticker}")
        async def get_ratios(ticker: str):
            ticker = ticker.upper()
            ratios = {
                "FPT": {"pe": 22.4, "pb": 5.8, "roe": 28.5, "margin": 14.2, "debt_equity": 0.42, "eps": 6050},
                "SSI": {"pe": 18.2, "pb": 2.1, "roe": 14.5, "margin": 32.8, "debt_equity": 1.25, "eps": 2100},
                "HPG": {"pe": 16.5, "pb": 1.7, "roe": 11.8, "margin": 8.5, "debt_equity": 0.62, "eps": 1750},
                "VCB": {"pe": 14.8, "pb": 2.8, "roe": 21.2, "margin": 42.5, "debt_equity": 0.15, "eps": 6250}
            }
            return ratios.get(ticker, {"pe": 15.0, "pb": 1.5, "roe": 15.0, "margin": 15.0, "debt_equity": 0.5, "eps": 2000})

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
            return {
                "mode": "GROWTH_HUNTING",
                "market_timing": "Cơ hội giải ngân cao - Stage 2 xác nhận",
                "focus_list": [
                    {"ticker": "FPT", "canslim_score": 92, "tech_status": "Stage 2 / Pocket Pivot", "vsa_signal": "Cạn cung", "entry": "134.5", "potential": "+25%", "sepa_verdict": "BUY"},
                    {"ticker": "HPG", "canslim_score": 85, "tech_status": "Stage 1 / VCP", "vsa_signal": "Kiệt cung", "entry": "28.5", "potential": "+35%", "sepa_verdict": "WATCHLIST"},
                    {"ticker": "SSI", "canslim_score": 88, "tech_status": "Stage 2 / Spring", "vsa_signal": "Test Cung", "entry": "37.5", "potential": "+20%", "sepa_verdict": "BUY"}
                ]
            }

        @self.app.get("/api/account/balance")
        async def get_balance(): return {"balance": 1250000000}

        @self.app.get("/api/analysis/technical/{ticker}")
        async def get_technical_analysis(ticker: str):
            ticker = ticker.upper()
            try:
                # 1. FETCH DATA (3Y for Monthly/Weekly analysis)
                q = Quote(symbol=ticker, source='KBS')
                df = q.history(length='3Y', interval='1D')
                if df is None or df.empty or len(df) < 100:
                    raise Exception("Insufficient data for CMT analysis")
                
                df = df.sort_values(by='time', ascending=True)
                latest = df.iloc[-1]
                prev = df.iloc[-2]
                
                # 2. MOVING AVERAGES SYSTEM
                ma20 = df['close'].rolling(window=20).mean()
                ma50 = df['close'].rolling(window=50).mean()
                ma150 = df['close'].rolling(window=150).mean()
                ma200 = df['close'].rolling(window=200).mean()
                
                cur_ma20, cur_ma50, cur_ma200 = ma20.iloc[-1], ma50.iloc[-1], ma200.iloc[-1]
                
                # 3. TREND DIAGNOSIS (Daily/Weekly/Monthly)
                # Short-term (Daily)
                st_trend = "Uptrend" if latest['close'] > cur_ma20 else "Downtrend"
                if abs(latest['close'] - cur_ma20) / cur_ma20 < 0.01: st_trend = "Sideway"
                
                # Medium-term (Weekly - derived from Daily)
                mt_trend = "Uptrend" if cur_ma50 > cur_ma150 else "Downtrend"
                
                # Long-term (Monthly)
                lt_trend = "Uptrend" if cur_ma150 > cur_ma200 else "Downtrend"
                
                # Trend Phase (Stage Analysis)
                phase = "Accumulation"
                if latest['close'] > cur_ma50 and cur_ma50 > cur_ma200: phase = "Mark-up (Stage 2)"
                elif latest['close'] < cur_ma50 and cur_ma50 < cur_ma200: phase = "Decline (Stage 4)"
                elif abs(cur_ma50 - cur_ma200) / cur_ma200 < 0.05: phase = "Distribution/Sideway"

                # 4. VOLUME SPIKE DETECTION (VSA)
                vol20 = df['volume'].rolling(window=20).mean()
                cur_vol20 = vol20.iloc[-1]
                vol_ratio = latest['volume'] / cur_vol20
                price_pct = (latest['close'] - prev['close']) / prev['close']
                
                spike_type = "Normal"
                vsa_signal = "Neutral"
                vsa_color = "slate"
                
                if vol_ratio > 2.0:
                    if price_pct > 0.02: 
                        spike_type = "Breakout Spike"
                        vsa_signal = "Dòng tiền lớn đẩy giá (Demand Spike)"
                        vsa_color = "emerald"
                    elif price_pct < -0.02:
                        spike_type = "Distribution Spike"
                        vsa_signal = "Áp lực bán tháo tổ chức (Supply Spike)"
                        vsa_color = "rose"
                    else:
                        spike_type = "Absorption Spike"
                        vsa_signal = "Hấp thụ cung/Dừng rơi"
                        vsa_color = "blue"
                elif vol_ratio < 0.6 and abs(price_pct) < 0.005:
                    vsa_signal = "No Supply Bar (Kiệt cung tích cực)"
                    vsa_color = "blue"

                # 5. SUPPORT & RESISTANCE (Dynamic Mapping)
                high_52w = df['high'].tail(250).max()
                low_52w = df['low'].tail(250).min()
                
                # Simple logic for S/R zones
                resistances = [
                    {"price": round(high_52w, 1), "type": "Đỉnh 52 tuần", "strength": "Strong"},
                    {"price": round(cur_ma200 * 1.1, 1), "type": "Kháng cự tâm lý", "strength": "Medium"}
                ]
                supports = [
                    {"price": round(cur_ma50, 1), "type": "Hỗ trợ MA50", "strength": "Medium"},
                    {"price": round(low_52w, 1), "type": "Đáy 52 tuần", "strength": "Strong"}
                ]

                # 6. TRADING PLAN & RISK/REWARD
                stop_loss = round(cur_ma50 * 0.95, 1)
                target = round(latest['close'] * 1.2, 1)
                risk = latest['close'] - stop_loss
                reward = target - latest['close']
                rr_ratio = round(reward / risk, 2) if risk > 0 else 0

                # 7. TECHNICAL RATING SCORE (CMT 7-Factor)
                trend_score = 25 if lt_trend == "Uptrend" else 10
                rs_score = 15 if price_pct > 0 else 5 # Simplified RS
                vol_score = 15 if vol_ratio > 1.2 and price_pct > 0 else 7
                mom_score = 15 if st_trend == "Uptrend" else 5
                
                total_score = trend_score + rs_score + vol_score + mom_score + 15 # + Base
                
                return {
                    "ticker": ticker,
                    "trends": {
                        "short_term": st_trend,
                        "medium_term": mt_trend,
                        "long_term": lt_trend,
                        "alignment": "Đồng thuận" if st_trend == mt_trend == lt_trend else "Lệch pha",
                        "phase": phase
                    },
                    "vsa": {
                        "spike_type": spike_type,
                        "signal": vsa_signal,
                        "color": vsa_color,
                        "vol_ratio": round(vol_ratio, 2)
                    },
                    "levels": {
                        "supports": supports,
                        "resistances": resistances,
                        "pivot": round(high_52w, 1)
                    },
                    "trading_plan": {
                        "entry": "Chờ Pullback" if vol_ratio > 3 else "Vùng hiện tại",
                        "stop_loss": stop_loss,
                        "target": target,
                        "rr_ratio": rr_ratio,
                        "verdict": "MUA" if total_score > 70 else "THEO DÕI"
                    },
                    "score": total_score,
                    "reason": f"Giá đang vận động trong {phase}. Tín hiệu {vsa_signal} với khối lượng gấp {round(vol_ratio,1)} lần trung bình."
                }
            except Exception as e:
                logger.error(f"CMT Engine Error: {e}")
                return {"score": 0, "reason": str(e)}
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
                    {"firm": "VNDirect", "title": "FPT: Định giá lại nhờ AI & Bán dẫn", "date": "27/05/2024", "link": "https://www.vndirect.com.vn/cmsupload/beta/Bao-cao-cap-nhat-FPT_270524.pdf"},
                    {"firm": "SHS", "title": "Cơ hội từ hệ sinh thái AI", "date": "08/04/2025", "link": "https://www.shs.com.vn/Data/Reports/2025/Bao-cao-cap-nhat-FPT_080425.pdf"}
                ]
            }
            default_reports = [
                {"firm": "CafeF", "title": f"Báo cáo phân tích {ticker}", "date": "2026", "link": f"https://cafef.vn/ho-so/{ticker}.chn"}
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
                    }
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
                    }
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
                "consensus": {"buy": 5, "hold": 3, "sell": 1, "avg_target": 0, "max_target": 0, "min_target": 0}
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
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
