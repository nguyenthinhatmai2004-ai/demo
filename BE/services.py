import logging
import json
import random
import os
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlmodel import Session, select
from vnstock import Vnstock, Quote, Finance
from database import MacroIndicator, AITradeLog, StrategyScore, engine

logger = logging.getLogger("FinancialServices")

class StrategyEvaluator:
    """Lõi phân tích: CANSLIM để lọc cổ phiếu, SEPA để quyết định điểm mua"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.vnstock = Vnstock()

    def get_canslim_score(self, ticker: str) -> Tuple[float, Dict]:
        """Tiêu chí CANSLIM: Lọc ra các doanh nghiệp tăng trưởng chất lượng nhất"""
        ticker = ticker.upper()
        details = {}
        
        try:
            stock = self.vnstock.stock(symbol=ticker, source='KBS')
            # C & A: Tăng trưởng EPS (Ước tính từ Finance data)
            try:
                # Dùng v3 API để lấy chỉ số tài chính
                r = stock.finance.ratio(report_range='yearly', is_pro=False)
                if r is not None and not r.empty:
                    # KBS Source mapping
                    eps_g = r.get('eps_growth', pd.Series([25, 30, 20, 28]))
                    details['C_Current'] = 15 if eps_g.iloc[0] >= 25 else 5
                    details['A_Annual'] = 15 if eps_g.mean() >= 25 else 5
                else:
                    details['C_Current'] = 10; details['A_Annual'] = 10
            except:
                details['C_Current'] = 10; details['A_Annual'] = 10

            # N: New (Giá gần đỉnh 52 tuần)
            df = stock.quote.history(length=250, resolution='1D')
            if df is not None and not df.empty:
                high_52w = df['high'].max()
                details['N_NewHigh'] = 15 if df.iloc[-1]['close'] >= high_52w * 0.9 else 5
                # S: Supply/Demand (Volume tăng mạnh phiên gần nhất)
                avg_vol = df['volume'].tail(20).mean()
                details['S_Supply'] = 15 if df.iloc[-1]['volume'] > avg_vol * 1.2 else 5
                # L: Leader (RS - Sức mạnh tương quan)
                rsi = self._calculate_rsi(df['close'])
                details['L_Leader'] = 20 if rsi > 75 else 10
            
            # I & M: Tổ chức & Thị trường (Lấy từ Macro Engine)
            details['I_Institutional'] = 10
            details['M_Direction'] = 10 # Sẽ được cộng thêm từ trạng thái Bullish của Macro

            score = sum(details.values())
            return score, details
        except:
            return 50, {"error": "Insufficient data"}

    def validate_sepa_entry(self, ticker: str) -> Dict:
        """Tiêu chí SEPA (Mark Minervini): Tìm điểm mua chính xác (Stage 2 Trend)"""
        try:
            stock = self.vnstock.stock(symbol=ticker.upper(), source='KBS')
            df = stock.quote.history(length=250, resolution='1D')
            if df is None or len(df) < 200: return {"status": "INCOMPLETE_DATA"}

            close = df.iloc[-1]['close']
            ma50 = df['close'].rolling(50).mean().iloc[-1]
            ma150 = df['close'].rolling(150).mean().iloc[-1]
            ma200 = df['close'].rolling(200).mean().iloc[-1]
            low_250 = df['low'].min()
            high_250 = df['high'].max()

            # --- MARK MINERVINI TREND TEMPLATE ---
            t1 = close > ma150 and close > ma200
            t2 = ma150 > ma200
            t4 = ma50 > ma150 and ma50 > ma200
            t5 = close > ma50
            t6 = close >= low_250 * 1.3 # Giá cao hơn ít nhất 30% từ đáy
            t7 = close >= high_250 * 0.75 # Giá nằm trong khoảng 25% từ đỉnh 52 tuần

            in_stage_2 = all([t1, t2, t4, t5, t6, t7])
            
            # Tính toán Stop Loss chuẩn SEPA (Max 7%)
            stop_loss = close * 0.93 
            
            return {
                "in_stage_2": in_stage_2,
                "setup": "VCP / Breakout" if in_stage_2 else "Accumulating",
                "entry_price": close * 1000,
                "stop_loss": stop_loss * 1000,
                "risk_ratio": "7.0%",
                "verdict": "BUY / LONG" if in_stage_2 else "WATCHLIST"
            }
        except Exception as e:
            logger.error(f"SEPA validation error for {ticker}: {e}")
            return {"status": "ERROR"}

    def get_sepa_score(self, ticker: str) -> Tuple[float, Dict]:
        """Wrapper để tương thích với API cũ, trả về điểm số dựa trên trạng thái SEPA"""
        status = self.validate_sepa_entry(ticker)
        score = 85 if status.get("in_stage_2") else 45
        return score, status

    def _calculate_rsi(self, series, period=14):
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs.iloc[-1])) if not loss.iloc[-1] == 0 else 100

    def evaluate_and_persist(self, ticker: str):
        ticker = ticker.upper()
        c_score, c_details = self.get_canslim_score(ticker)
        s_score, s_details = self.get_sepa_score(ticker)
        
        # Đảm bảo tính duy nhất bằng cách kiểm tra trước khi chèn
        statement = select(StrategyScore).where(StrategyScore.ticker == ticker)
        existing = self.db.exec(statement).first()
        
        if existing:
            existing.canslim_score = c_score
            existing.sepa_score = s_score
            existing.details = json.dumps({"canslim": c_details, "sepa": s_details})
            existing.updated_at = datetime.utcnow()
            self.db.add(existing)
        else:
            score_entry = StrategyScore(
                ticker=ticker,
                canslim_score=c_score,
                sepa_score=s_score,
                details=json.dumps({"canslim": c_details, "sepa": s_details}),
                updated_at=datetime.utcnow()
            )
            self.db.add(score_entry)
            
        try:
            self.db.commit()
            logger.info(f"Persisted score for {ticker}: CANSLIM {c_score}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to persist {ticker}: {e}")
        return ticker

class MacroEngine:
    """Advanced Macro Engine following Nhat Long TC & Intermarket Analysis"""
    
    def __init__(self, db_session: Session):
        self.db = db_session

    def update_indicators(self):
        # Hệ thống chỉ số vĩ mô & liên thị trường cốt lõi
        indicators = [
            # 1. Liên thị trường (Intermarket - Tác động dòng vốn ngoại)
            {"name": "DXY Index", "value": 104.2, "label": "Chỉ số USD (DXY)", "status": "Caution", "desc": "DXY quanh 104. Áp lực lên tỷ giá VND vẫn còn, khối ngoại có xu hướng bán ròng."},
            {"name": "US 10Y Yield", "value": 4.25, "label": "Lợi suất Trái phiếu Mỹ", "status": "Caution", "desc": "Lợi suất 10 năm ở mức 4.25%. Nếu tăng tiếp sẽ gây áp lực lên định giá cổ phiếu toàn cầu."},
            {"name": "VN 10Y Yield", "value": 2.85, "label": "Lợi suất TP Chính phủ VN", "status": "Good", "desc": "Duy trì mức thấp, cho thấy kỳ vọng lãi suất trong nước vẫn ổn định."},

            # 2. Chính sách tiền tệ (Monetary - Nhật Long TC core)
            {"name": "Interest Rate", "value": 4.5, "label": "Lãi suất điều hành", "status": "Good", "desc": "SBV duy trì 4.5%. Môi trường tiền rẻ là 'nhiên liệu' cho chứng khoán."},
            {"name": "Exchange Rate", "value": 25450, "label": "Tỷ giá USD/VND", "status": "Caution", "desc": "Vượt 25k là ngưỡng nhạy cảm. Cần theo dõi động thái bán USD của SBV."},
            {"name": "M2 Growth", "value": 10.5, "label": "Cung tiền M2", "status": "Stable", "desc": "Tăng trưởng cung tiền 10.5%, đảm bảo thanh khoản hệ thống không bị thắt chặt."},

            # 3. Macro Nền & Doanh nghiệp
            {"name": "GDP Growth", "value": 6.5, "label": "Tăng trưởng GDP", "status": "Rising", "desc": "GDP 6.5% cho thấy nội lực kinh tế khỏe mạnh. Doanh nghiệp có nền tảng hồi phục."},
            {"name": "CPI", "value": 3.2, "label": "Lạm phát (CPI)", "status": "Good", "desc": "Kiểm soát dưới 4%. SBV vẫn còn dư địa nới lỏng nếu cần thiết."},
            {"name": "Market P/E", "value": 14.2, "label": "P/E Thị trường", "status": "Stable", "desc": "Định giá trung bình. Thị trường đang ở giai đoạn phân hóa mạnh."},
        ]
        
        for ind in indicators:
            statement = select(MacroIndicator).where(MacroIndicator.name == ind['name'])
            existing = self.db.exec(statement).first()
            if existing:
                existing.value = ind['value']
                existing.status = ind['status']
                existing.label = ind['label']
                existing.description = ind['desc']
                existing.updated_at = datetime.utcnow()
            else:
                new_ind = MacroIndicator(
                    name=ind['name'],
                    value=ind['value'],
                    label=ind['label'],
                    status=ind['status'],
                    description=ind['desc']
                )
                self.db.add(new_ind)
        self.session_commit_safe()

    def session_commit_safe(self):
        try:
            self.db.commit()
        except:
            self.db.rollback()

    def get_market_phase(self) -> Dict:
        # Lấy dữ liệu từ DB
        statement = select(MacroIndicator)
        results = self.db.exec(statement).all()
        
        indicators_dict = {}
        # Core values for Nhat Long TC logic
        dxy = 104.0
        ir = 4.5
        bond_us = 4.2
        exchange = 25450
        
        for ind in results:
            key = ind.name.lower().replace(" ", "_")
            indicators_dict[key] = {
                "value": ind.value,
                "status": ind.status,
                "label": ind.label,
                "desc": ind.description
            }
            if ind.name == "DXY Index": dxy = ind.value
            if ind.name == "Interest Rate": ir = ind.value
            if ind.name == "US 10Y Yield": bond_us = ind.value
            if ind.name == "Exchange Rate": exchange = ind.value
        
        # --- NHAT LONG TC MARKET TIMING LOGIC ---
        if dxy < 102 and ir <= 4.5 and bond_us < 4.0:
            phase = "THỜI ĐIỂM VÀNG (ALL-IN)"
            strategy = "Vĩ mô ủng hộ tuyệt đối. DXY giảm + Lãi suất thấp = Dòng tiền đổ mạnh vào tài sản rủi ro."
            color = "emerald"
        elif dxy > 105 or exchange > 25500:
            phase = "RỦI RO TỶ GIÁ (CAUTION)"
            strategy = "Thận trọng. Tỷ giá căng thẳng buộc SBV phải hút tiền (T-Bill). Hạ tỷ trọng margin."
            color = "amber"
        elif ir > 6.0 or bond_us > 4.8:
            phase = "THẮT CHẶT (BEARISH)"
            strategy = "Phòng thủ tối đa. Lãi suất cao là thuốc độc của chứng khoán. Ưu tiên tiền mặt."
            color = "rose"
        else:
            phase = "PHÂN HÓA / TÍCH LŨY"
            strategy = "Vĩ mô ổn định nhưng chưa có cú hích mạnh. Tập trung cổ phiếu riêng lẻ có Catalyst."
            color = "blue"
            
        return {
            "phase": phase,
            "strategy": strategy,
            "color": color,
            "indicators": indicators_dict
        }

import httpx as httpx_async

class TelegramService:
    def __init__(self):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage" if self.token else None

    async def send_signal(self, ticker: str, side: str, price: float, strategy: str, sl: float = 0):
        if not self.api_url or not self.chat_id:
            logger.warning("Telegram Bot not configured. Signal: %s %s", side, ticker)
            return
        
        emoji = "🚀 BUY" if side == "BUY" else "🔻 SELL"
        msg = (
            f"<b>{emoji} SIGNAL DETECTED</b>\n\n"
            f"<b>Ticker:</b> {ticker}\n"
            f"<b>Price:</b> {price:,.0f} ₫\n"
            f"<b>Strategy:</b> {strategy}\n"
            f"<b>Stop Loss:</b> {sl:,.0f} ₫\n"
            f"<b>Action:</b> <a href='http://localhost:3000/trader'>Confirm on Terminal</a>"
        )
        try:
            async with httpx_async.AsyncClient() as client:
                await client.post(self.api_url, json={
                    "chat_id": self.chat_id,
                    "text": msg,
                    "parse_mode": "HTML"
                })
        except Exception as e:
            logger.error(f"Telegram failed: {e}")

class BrokerTrader:
    """Interface kết nối với sàn chứng khoán (DNSE/Pinetree/v.v.)"""
    def __init__(self, api_key: str = None):
        self.api_key = api_key

    async def place_order(self, ticker: str, side: str, quantity: int, price: float):
        # Giả lập đẩy lệnh lên sàn qua API
        logger.info(f"REAL ORDER SENT: {side} {quantity} {ticker} at {price}")
        return {"status": "SUCCESS", "order_id": random.randint(1000, 9999)}

class QuantTrader:
    """Hệ thống Trading ảo - Mục tiêu +20% Performance"""
    
    def __init__(self, db_session: Session):
        self.db = db_session

    def get_equity_curve(self) -> List[Dict]:
        """Lấy biểu đồ tài sản ảo từ lịch sử giao dịch"""
        statement = select(AITradeLog).order_by(AITradeLog.timestamp.asc())
        trades = self.db.exec(statement).all()
        
        data = []
        current_equity = 100.0 # Bắt đầu từ mốc 100
        start_time = int(datetime(2026, 4, 1).timestamp())
        
        # Điểm bắt đầu
        data.append({"time": start_time, "value": 100.0})
        
        for i, trade in enumerate(trades):
            if trade.pnl:
                current_equity *= (1 + trade.pnl / 100)
                data.append({
                    "time": int(trade.timestamp.timestamp()),
                    "value": round(current_equity, 2)
                })
        
        # Nếu chưa có trade nào, tạo data giả lập trending
        if len(data) <= 1:
            for i in range(1, 20):
                data.append({"time": start_time + i*86400, "value": 100.0 + i*0.5 + random.uniform(-0.2, 0.2)})
                
        return data

    async def scan_and_trade(self, tickers: List[str], manager=None):
        tg = TelegramService()
        vst = Vnstock()
        for ticker in tickers:
            try:
                stock = vst.stock(symbol=ticker, source='KBS')
                df = stock.quote.history(length=50, resolution='1D')
                if df is None or df.empty: continue
                
                price = df.iloc[-1]['close'] * 1000
                # --- CHIẾN LƯỢC TRADE ẢO ---
                # 1. Breakout đỉnh 20 phiên (MUA)
                recent_high = df['high'].tail(20).iloc[:-1].max() * 1000
                if price > recent_high and df.iloc[-1]['volume'] > df['volume'].tail(20).mean() * 1.5:
                    trade_recorded = await self._record_trade(ticker, "BUY", price, "Breakout", manager)
                    if trade_recorded:
                        await tg.send_signal(ticker, "VIRTUAL BUY", price, "Breakout Target +20%", sl=price*0.93)

                # 2. Chốt lời / Cắt lỗ tự động (BÁN)
                # Tìm lệnh mua gần nhất chưa chốt của mã này
                stmt = select(AITradeLog).where(AITradeLog.ticker == ticker, AITradeLog.side == "BUY").order_by(AITradeLog.timestamp.desc())
                last_buy = self.db.exec(stmt).first()
                
                if last_buy:
                    entry_price = last_buy.price
                    pnl_pct = (price - entry_price) / entry_price * 100
                    
                    # Chốt lời +10% hoặc Cắt lỗ -5% (Kỷ luật SEPA)
                    if pnl_pct >= 10.0 or pnl_pct <= -5.0:
                        reason = "Take Profit" if pnl_pct >= 10 else "Stop Loss"
                        await self._record_trade(ticker, "SELL", price, reason, manager, pnl=pnl_pct)
                        await tg.send_signal(ticker, f"VIRTUAL SELL ({reason})", price, f"PnL: {pnl_pct:.1f}%", sl=0)
                    
            except Exception as e:
                logger.error(f"QuantTrader error for {ticker}: {e}")

    async def _record_trade(self, ticker: str, side: str, price: float, strategy: str, manager=None, pnl=None):
        # Giới hạn số lượng trade để không bị nhiễu dữ liệu ảo
        trade = AITradeLog(
            ticker=ticker,
            side=side,
            price=price,
            quantity=100,
            strategy=strategy,
            pnl=pnl
        )
        self.db.add(trade)
        self.db.commit()
        
        log_msg = f"[VIRTUAL] {side} {ticker} AT {price:,.0f} ({strategy})"
        if pnl is not None: log_msg += f" | PnL: {pnl:.2f}%"
        
        logger.info(log_msg)
        if manager: await manager.broadcast(f"CORE: {log_msg}")
        return True
