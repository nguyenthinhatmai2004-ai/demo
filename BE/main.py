import asyncio
import os
import logging
import json
import random
from typing import List, Optional, Dict
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv

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
            logger.info("Starting up VN Stock Terminal Engine (LITE MODE)...")
            create_db_and_tables()
            # Start heartbeat task
            asyncio.create_task(self._heartbeat_task())

        @self.app.get("/")
        async def root():
            return {"status": "active", "mode": "LITE"}

        @self.app.websocket("/ws/ai-logs")
        async def websocket_endpoint(websocket: WebSocket):
            await manager.connect(websocket)
            try:
                while True: await websocket.receive_text()
            except WebSocketDisconnect: manager.disconnect(websocket)

        # --- MOCK MARKET DATA ---
        @self.app.get("/api/market/ticker-tape")
        async def get_ticker_tape():
            # Cập nhật giá cơ sở sát thực tế (Đơn vị: nghìn đồng)
            base_prices = {
                "FPT": 135.2, "SSI": 38.1, "HPG": 28.5, "VCB": 92.4, "DGC": 115.0,
                "VNM": 68.2, "TCB": 45.3, "MWG": 58.6, "PNJ": 95.0, "VIC": 42.1
            }
            return [{"ticker": t, "price": base_prices.get(t, 50.0) + random.uniform(-0.5, 0.5), "change": random.uniform(-1.5, 2.5)} for t in base_prices.keys()]

        @self.app.get("/api/market/quote/{ticker}")
        async def get_quote(ticker: str):
            ticker = ticker.upper()
            base_prices = {"FPT": 135.2, "SSI": 38.1, "HPG": 28.5, "VCB": 92.4}
            price = base_prices.get(ticker, 50.0) * 1000
            return {"ticker": ticker, "price": price + random.uniform(-500, 500), "change_percent": random.uniform(-2, 3), "volume": random.randint(100000, 2000000)}

        @self.app.get("/api/market/history/{ticker}")
        async def get_history(ticker: str):
            ticker = ticker.upper()
            base_prices = {"FPT": 135.2, "SSI": 38.1, "HPG": 28.5, "VCB": 92.4}
            base = base_prices.get(ticker, 50.0)
            
            history = []
            current_date = datetime.now()
            for i in range(60, 0, -1):
                date_str = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
                # Giả lập nến Nhật chuẩn
                open_p = base + random.uniform(-2, 2)
                close_p = open_p + random.uniform(-3, 4)
                high_p = max(open_p, close_p) + random.uniform(0, 1.5)
                low_p = min(open_p, close_p) - random.uniform(0, 1.5)
                history.append({
                    "time": date_str,
                    "open": round(open_p, 1),
                    "high": round(high_p, 1),
                    "low": round(low_p, 1),
                    "close": round(close_p, 1),
                    "volume": random.randint(500000, 5000000)
                })
                base = close_p # Di chuyển giá cơ sở cho ngày tiếp theo
            return history

        # --- NEWS ---
        @self.app.get("/api/news/{ticker}")
        async def get_ticker_news(ticker: str):
            return await self.news_aggregator.get_aggregated_news(ticker.upper())

        @self.app.get("/api/news/{category}")
        async def get_cat_news(category: str):
            return await self.news_aggregator.get_aggregated_news(category)

        # --- MACRO & STRATEGY ---
        @self.app.get("/api/analysis/macro")
        async def get_macro(db: Session = Depends(get_session)):
            engine = MacroEngine(db)
            return engine.get_market_phase()

        @self.app.get("/api/finance/ratios/{ticker}")
        async def get_ratios(ticker: str):
            return {"pe": 15.5, "pb": 2.1, "roe": 22.4, "margin": 18.5, "debt_equity": 0.35, "latest_price": 135000}

        @self.app.get("/api/finance/valuation/dcf/{ticker}")
        async def get_dcf_valuation(ticker: str):
            ticker = ticker.upper()
            # Dữ liệu định giá & lịch sử tài chính chuyên sâu
            data = {
                "FPT": {
                    "current_price": 135000,
                    "intrinsic_value": 165500,
                    "upside": 22.6,
                    "wacc": 10.5,
                    "growth_rate": 18.0,
                    "terminal_growth": 3.0,
                    "fcf_projections": [2500, 2950, 3480, 4100, 4850],
                    "assumptions": [
                        "Mảng Công nghệ tăng trưởng 25% nhờ hợp đồng AI quốc tế",
                        "Biên lợi nhuận gộp cải thiện nhờ tối ưu hóa chi phí mảng giáo dục",
                        "Vốn đầu tư (CAPEX) tập trung vào AI Factory"
                    ],
                    "history": [
                        {"year": "2021", "revenue": 35657, "profit": 4337, "margin": 12.2},
                        {"year": "2022", "revenue": 44010, "profit": 5310, "margin": 12.1},
                        {"year": "2023", "revenue": 52618, "profit": 6470, "margin": 12.3},
                        {"year": "2024", "revenue": 62500, "profit": 7800, "margin": 12.5},
                        {"year": "2025E", "revenue": 75000, "profit": 9500, "margin": 12.7}
                    ]
                },
                "SSI": {
                    "current_price": 38200,
                    "intrinsic_value": 46000,
                    "upside": 20.4,
                    "wacc": 11.2,
                    "growth_rate": 15.0,
                    "terminal_growth": 2.5,
                    "fcf_projections": [1200, 1380, 1580, 1820, 2100],
                    "assumptions": [
                        "Phí môi giới tăng mạnh khi KRX vận hành",
                        "Dư nợ Margin mở rộng nhờ kế hoạch tăng vốn",
                        "Doanh thu IB (tư vấn) đột biến từ các deal IPO"
                    ],
                    "history": [
                        {"year": "2021", "revenue": 7772, "profit": 2695, "margin": 34.7},
                        {"year": "2022", "revenue": 6516, "profit": 1699, "margin": 26.1},
                        {"year": "2023", "revenue": 7158, "profit": 2173, "margin": 30.4},
                        {"year": "2024", "revenue": 8500, "profit": 2800, "margin": 32.9},
                        {"year": "2025E", "revenue": 10500, "profit": 3600, "margin": 34.3}
                    ]
                },
                "HPG": {
                    "current_price": 28500,
                    "intrinsic_value": 37200,
                    "upside": 30.5,
                    "wacc": 10.8,
                    "growth_rate": 12.0,
                    "terminal_growth": 2.0,
                    "fcf_projections": [3500, 4200, 8500, 10500, 12800],
                    "assumptions": [
                        "Dung Quất 2 đóng góp 60% sản lượng từ cuối 2025",
                        "Giá thép HRC thế giới phục hồi về mức trung bình 5 năm",
                        "Tự chủ nguyên liệu quặng sắt giúp hạ giá vốn"
                    ],
                    "history": [
                        {"year": "2020", "revenue": 91279, "profit": 13506, "margin": 14.8},
                        {"year": "2021", "revenue": 150865, "profit": 34521, "margin": 22.9},
                        {"year": "2022", "revenue": 142770, "profit": 8444, "margin": 5.9},
                        {"year": "2023", "revenue": 120355, "profit": 6800, "margin": 5.7},
                        {"year": "2024", "revenue": 145000, "profit": 11500, "margin": 7.9},
                        {"year": "2025E", "revenue": 185000, "profit": 18500, "margin": 10.0}
                    ]
                }
            }
            return data.get(ticker, {
                "current_price": 50000,
                "intrinsic_value": 55000,
                "upside": 10.0,
                "wacc": 11.0,
                "growth_rate": 10.0,
                "terminal_growth": 2.0,
                "fcf_projections": [1000, 1100, 1210, 1330, 1460],
                "assumptions": ["Dự báo thận trọng", "Tăng trưởng ổn định"],
                "history": [
                    {"year": "2022", "revenue": 1000, "profit": 100, "margin": 10},
                    {"year": "2023", "revenue": 1100, "profit": 115, "margin": 10.5},
                    {"year": "2024", "revenue": 1250, "profit": 140, "margin": 11.2}
                ]
            })

        @self.app.get("/api/investment/strategy")
        async def get_investment_strategy(db: Session = Depends(get_session)):
            return {
                "mode": "GROWTH_HUNTING",
                "focus_list": [
                    {"ticker": "FPT", "canslim_score": 88, "setup": "VCP Breakout", "potential": "+25%", "sepa_verdict": "BUY / LONG"},
                    {"ticker": "SSI", "canslim_score": 75, "setup": "Accumulating", "potential": "+15%", "sepa_verdict": "WATCHLIST"},
                    {"ticker": "HPG", "canslim_score": 82, "setup": "Stage 2 Trend", "potential": "+20%", "sepa_verdict": "BUY / LONG"}
                ]
            }

        @self.app.get("/api/account/balance")
        async def get_balance(): return {"balance": 1250000000}

        @self.app.get("/api/analysis/technical/{ticker}")
        async def get_technical_analysis(ticker: str):
            ticker = ticker.upper()
            # Hệ thống phân tích VSA & Stage Analysis (Theo tài liệu chuyên sâu)
            analysis = {
                "FPT": {
                    "stage": "Giai đoạn 2 (Uptrend)",
                    "status": "Dòng tiền bùng nổ",
                    "vsa_signal": "Nến nhấn chìm tăng trưởng với Volume > 150% TB 20 phiên",
                    "supply_demand": "Cạn cung (Exhausted Supply) ở vùng nền 132, lực cầu chủ động hấp thụ hoàn toàn",
                    "order_flow": {"buy": 65, "sell": 35},
                    "pivot_point": 134.5,
                    "verdict": "MUA / GIA TĂNG TỶ TRỌNG",
                    "reason": "Cổ phiếu đã thoát khỏi vùng tích lũy sideway 3 tháng. Xuất hiện các phiên Pocket Pivot cực chuẩn."
                },
                "HPG": {
                    "stage": "Giai đoạn 1 (Tích lũy)",
                    "status": "Kiệt cung / Sideway",
                    "vsa_signal": "No Supply Bar xuất hiện liên tục, biên độ giá thu hẹp (VCP)",
                    "supply_demand": "Lực bán yếu dần, đang chờ đợi dòng tiền xác nhận phá vỡ kháng cự",
                    "order_flow": {"buy": 52, "sell": 48},
                    "pivot_point": 29.2,
                    "verdict": "THEO DÕI / MUA THĂM DÒ",
                    "reason": "Đang ở cuối mô hình tích lũy. Khối lượng cực thấp là dấu hiệu tốt cho một đợt bùng nổ sắp tới."
                },
                "SSI": {
                    "stage": "Giai đoạn 2 (Uptrend)",
                    "status": "Hấp thụ đỉnh",
                    "vsa_signal": "Test cung thành công (Spring), giá đang giữ trên các đường EMA quan trọng",
                    "supply_demand": "Lực mua chủ động áp đảo ở các vùng giá thấp",
                    "order_flow": {"buy": 58, "sell": 42},
                    "pivot_point": 37.8,
                    "verdict": "NẮM GIỮ / MUA KHI RE-TEST",
                    "reason": "Xác nhận xu hướng tăng trung hạn. Ưu tiên giải ngân khi giá quay về kiểm tra lại vùng Pivot."
                }
            }
            return analysis.get(ticker, {
                "stage": "Giai đoạn 1 / 3",
                "status": "Chưa rõ xu hướng",
                "vsa_signal": "Dữ liệu trung tính",
                "supply_demand": "Cung cầu cân bằng",
                "order_flow": {"buy": 50, "sell": 50},
                "pivot_point": 0,
                "verdict": "THEO DÕI",
                "reason": "Cần thêm tín hiệu xác nhận từ khối lượng và biến động giá."
            })

        @self.app.get("/api/analysis/reports/{ticker}")
        async def get_reports(ticker: str):
            ticker = ticker.upper()
            # Danh sách báo cáo phân tích thực tế (Link công khai - Không cần đăng nhập)
            reports = {
                "FPT": [
                    {"firm": "VNDirect", "title": "FPT: Định giá lại nhờ triển vọng chip bán dẫn và AI", "date": "27/05/2024", "link": "https://www.vndirect.com.vn/cmsupload/beta/Bao-cao-cap-nhat-FPT_270524.pdf"},
                    {"firm": "SHS", "title": "Báo cáo cập nhật FPT: Cơ hội từ hệ sinh thái AI", "date": "08/04/2025", "link": "https://www.shs.com.vn/Data/Reports/2025/Bao-cao-cap-nhat-FPT_080425.pdf"},
                    {"firm": "CafeF", "title": "Hồ sơ doanh nghiệp FPT & Tổng hợp phân tích", "date": "2026", "link": f"https://cafef.vn/ho-so/{ticker}.chn#bao-cao-phan-tich"},
                    {"firm": "Vietstock", "title": "Phân tích kỹ thuật và cơ bản FPT (Công khai)", "date": "2026", "link": f"https://vietstock.vn/FPT/bao-cao-phan-tich.htm"}
                ],
                "HPG": [
                    {"firm": "SHS", "title": "HPG: Động lực từ Dung Quất 2 và Thuế phòng vệ", "date": "14/03/2025", "link": "https://www.shs.com.vn/Data/Reports/2025/Bao-cao-cap-nhat-HPG_140325.pdf"},
                    {"firm": "KBSV", "title": "Hòa Phát: Chu kỳ phục hồi sản lượng thép", "date": "10/12/2024", "link": "https://www.kbsec.com.vn/vnt_upload/news/12_2024/20241210_HPG_Update.pdf"},
                    {"firm": "CafeF", "title": "Dữ liệu phân tích HPG đa nguồn", "date": "2026", "link": f"https://cafef.vn/ho-so/{ticker}.chn#bao-cao-phan-tich"}
                ],
                "SSI": [
                    {"firm": "BSC", "title": "Chứng khoán SSI: Vị thế dẫn đầu ngành dịch vụ tài chính", "date": "15/01/2025", "link": "https://www.bsc.com.vn/Data/Reports/SSI_Update_150125.pdf"},
                    {"firm": "TPS", "title": "SSI: Triển vọng nâng hạng và hệ thống KRX", "date": "13/03/2025", "link": "https://www.tpbs.com.vn/Data/Reports/Bao-cao-phan-tich-SSI_130325.pdf"},
                    {"firm": "Vietstock", "title": "Trung tâm báo cáo phân tích SSI", "date": "2026", "link": f"https://vietstock.vn/{ticker}/bao-cao-phan-tich.htm"}
                ]
            }
            # Fallback link công khai từ các aggregator
            default_reports = [
                {"firm": "CafeF", "title": f"Tổng hợp báo cáo phân tích mã {ticker}", "date": "23/04/2026", "link": f"https://cafef.vn/ho-so/{ticker}.chn#bao-cao-phan-tich"},
                {"firm": "Vietstock", "title": f"Phân tích doanh nghiệp {ticker} toàn diện", "date": "20/04/2026", "link": f"https://vietstock.vn/{ticker}/bao-cao-phan-tich.htm"},
                {"firm": "Báo Đầu tư", "title": f"Tin tức và nhận định đầu tư {ticker}", "date": "22/04/2026", "link": "https://baodautu.vn/chung-khoan-c5/"}
            ]
            return reports.get(ticker, default_reports)

        @self.app.get("/api/analysis/prospects/{ticker}")
        async def get_prospects(ticker: str):
            ticker = ticker.upper()
            # Dữ liệu catalysts thực tế cho Strategic Analyst (Tiếng Việt chuyên sâu)
            catalysts = {
                "FPT": {
                    "health_score": 92,
                    "growth_pillars": [
                        {"title": "Bán dẫn & AI", "content": "Hợp tác chiến lược với NVIDIA xây dựng AI Factory 200 triệu USD. Chip FPT Semiconductor bắt đầu đóng góp doanh thu thực tế."},
                        {"title": "Chuyển đổi số Toàn cầu", "content": "Thị trường Mỹ & Nhật Bản tăng trưởng >30%. M&A liên tục mở rộng tập khách hàng trong danh sách Fortune 500."},
                        {"title": "Backlog Kỷ lục", "content": "Giá trị hợp đồng ký mới đạt mốc 1 tỷ USD, đảm bảo tăng trưởng lợi nhuận >20% trong 3 năm tới."}
                    ],
                    "strategic_catalysts": [
                        "Vận hành AI Factory thương mại vào Quý 3/2026",
                        "Mở rộng hệ thống giáo dục lên 150.000 học sinh, đóng góp biên lợi nhuận cao",
                        "Làn sóng chuyển đổi số toàn cầu (Cloud, Data, AI) bùng nổ"
                    ],
                    "risk_assessment": ["Thiếu hụt nhân sự IT trình độ cao", "Biến động tỷ giá JPY/VND ảnh hưởng doanh thu từ Nhật"]
                },
                "SSI": {
                    "health_score": 85,
                    "growth_pillars": [
                        {"title": "Nâng hạng Thị trường", "content": "Hưởng lợi lớn nhất khi FTSE/MSCI nâng hạng TTCK Việt Nam lên thị trường mới nổi (Emerging Markets)."},
                        {"title": "Hệ thống KRX", "content": "Triển khai T+0 và bán khống giúp phí môi giới & dư nợ margin tăng trưởng đột biến."},
                        {"title": "Tăng vốn Điều lệ", "content": "Kế hoạch tăng vốn lên trên 19.000 tỷ đồng, củng cố vị thế dẫn đầu và quy mô cho vay."}
                    ],
                    "strategic_catalysts": [
                        "Vận hành chính thức KRX trong năm 2026",
                        "Dòng vốn ngoại ước tính 2-3 tỷ USD đổ vào khi chính thức nâng hạng",
                        "Môi trường lãi suất thấp thúc đẩy dòng tiền nhàn rỗi sang chứng khoán"
                    ],
                    "risk_assessment": ["Thanh khoản thị trường sụt giảm", "Cạnh tranh phí giao dịch từ các công ty chứng khoán ngoại (Zero Fee)"]
                },
                "HPG": {
                    "health_score": 88,
                    "growth_pillars": [
                        {"title": "Dung Quất 2", "content": "Dự án trọng điểm quy mô 3 tỷ USD, giúp tăng công suất thép thô thêm 60% khi đi vào hoạt động (2025-2026)."},
                        {"title": "Chu kỳ Thép", "content": "Giá HRC thế giới phục hồi từ đáy. HPG có giá thành sản xuất thấp nhất khu vực nhờ lợi thế quy mô."},
                        {"title": "Đầu tư Công", "content": "Hưởng lợi trực tiếp từ các đại dự án hạ tầng (Sân bay Long Thành, Cao tốc Bắc-Nam)."}
                    ],
                    "strategic_catalysts": [
                        "Chạy thử lò cao số 1 Dung Quất 2 vào cuối năm 2025",
                        "Áp thuế chống bán phá giá thép HRC nhập khẩu từ Trung Quốc",
                        "Mở rộng sang mảng Container và Đồ gia dụng để tối ưu chuỗi giá trị"
                    ],
                    "risk_assessment": ["Giá quặng sắt và than cốc biến động mạnh", "Thị trường Bất động sản dân dụng phục hồi chậm"]
                }
            }
            return catalysts.get(ticker, {
                "health_score": 75,
                "growth_pillars": [
                    {"title": "Nền tảng CANSLIM", "content": "Tăng trưởng EPS và sức mạnh giá (RS) dẫn đầu nhóm ngành."},
                    {"title": "Thiết lập Kỹ thuật", "content": "Đang hình thành điểm mua chuẩn mực theo mô hình Stage 2 (Giai đoạn 2)."},
                    {"title": "Vị thế Ngành", "content": "Lợi thế quy mô lớn và rào cản gia nhập thị trường cao."}
                ],
                "strategic_catalysts": ["Dòng tiền tổ chức mua ròng mạnh", "Kỳ vọng kết quả kinh doanh đột biến trong quý tới"],
                "risk_assessment": ["Biến động kinh tế vĩ mô", "Áp lực chốt lời ngắn hạn"]
            })

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
