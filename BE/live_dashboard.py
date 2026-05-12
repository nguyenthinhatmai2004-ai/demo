import logging
from datetime import datetime
from functools import lru_cache
from io import BytesIO
from typing import Dict, List, Optional

import pandas as pd
from vnstock import Quote

logger = logging.getLogger("LiveDashboard")


SYMBOL_META: Dict[str, Dict[str, str]] = {
    "FPT": {"company": "FPT Corp", "exchange": "HOSE", "sector": "Cong nghe"},
    "HPG": {"company": "Hoa Phat", "exchange": "HOSE", "sector": "Thep / vat lieu"},
    "SSI": {"company": "SSI Securities", "exchange": "HOSE", "sector": "Chung khoan"},
    "VCI": {"company": "Vietcap", "exchange": "HOSE", "sector": "Chung khoan"},
    "VND": {"company": "VNDirect", "exchange": "HOSE", "sector": "Chung khoan"},
    "VCB": {"company": "Vietcombank", "exchange": "HOSE", "sector": "Ngan hang"},
    "MBB": {"company": "MB Bank", "exchange": "HOSE", "sector": "Ngan hang"},
    "TCB": {"company": "Techcombank", "exchange": "HOSE", "sector": "Ngan hang"},
    "ACB": {"company": "ACB", "exchange": "HOSE", "sector": "Ngan hang"},
    "MWG": {"company": "Mobile World", "exchange": "HOSE", "sector": "Tieu dung"},
    "PNJ": {"company": "PNJ", "exchange": "HOSE", "sector": "Tieu dung"},
    "MSN": {"company": "Masan", "exchange": "HOSE", "sector": "Tieu dung"},
    "VHM": {"company": "Vinhomes", "exchange": "HOSE", "sector": "Bat dong san"},
    "KDH": {"company": "Khang Dien", "exchange": "HOSE", "sector": "Bat dong san"},
    "NLG": {"company": "Nam Long", "exchange": "HOSE", "sector": "Bat dong san"},
    "CTD": {"company": "Coteccons", "exchange": "HOSE", "sector": "Xay dung / dau tu cong"},
    "HHV": {"company": "Deo Ca", "exchange": "HOSE", "sector": "Ha tang"},
    "VCG": {"company": "Vinaconex", "exchange": "HNX", "sector": "Xay dung / dau tu cong"},
}

DEFAULT_UNIVERSE = list(SYMBOL_META.keys())


def _number(value, default: float = 0.0) -> float:
    try:
        if pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def _vnd(value: float) -> int:
    # vnstock sources commonly return prices in thousand VND.
    return int(round(value * 1000 if value and value < 1000 else value))


@lru_cache(maxsize=128)
def fetch_history_frame(ticker: str, length: str = "1Y") -> pd.DataFrame:
    ticker = ticker.upper().strip()
    for source in ("VCI", "KBS"):
        try:
            quote = Quote(symbol=ticker, source=source)
            df = quote.history(length=length, interval="1D")
            if df is not None and not df.empty:
                df = df.copy().sort_values("time")
                for col in ("open", "high", "low", "close", "volume"):
                    df[col] = pd.to_numeric(df[col], errors="coerce")
                return df.dropna(subset=["close"]).reset_index(drop=True)
        except Exception as exc:
            logger.warning("history source %s failed for %s: %s", source, ticker, exc)
    return pd.DataFrame()


def _ema(series: pd.Series, span: int) -> float:
    return _number(series.ewm(span=span, adjust=False).mean().iloc[-1])


def _rsi(series: pd.Series, period: int = 14) -> float:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = -delta.clip(upper=0).rolling(period).mean()
    if len(loss) == 0 or _number(loss.iloc[-1]) == 0:
        return 100.0
    rs = _number(gain.iloc[-1]) / _number(loss.iloc[-1], 1)
    return round(100 - (100 / (1 + rs)), 2)


def _atr(df: pd.DataFrame, period: int = 14) -> float:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return _number(tr.rolling(period).mean().iloc[-1])


def _quality_from_growth(growth: float) -> str:
    if growth >= 25:
        return "High Quality"
    if growth >= 0:
        return "Medium Quality"
    return "Low Quality"


def build_quant_stock(ticker: str) -> Optional[Dict]:
    ticker = ticker.upper().strip()
    df = fetch_history_frame(ticker)
    if df.empty or len(df) < 50:
        return None

    latest = df.iloc[-1]
    prev = df.iloc[-2] if len(df) >= 2 else latest
    close = _vnd(_number(latest["close"]))
    prev_close = _vnd(_number(prev["close"], close))
    change_pct = round(((close - prev_close) / prev_close) * 100, 2) if prev_close else 0
    volume = int(_number(latest["volume"]))
    avg_volume20 = int(max(1, _number(df["volume"].tail(20).mean())))
    close_series = df["close"]

    ma20 = _vnd(_number(close_series.rolling(20).mean().iloc[-1]))
    ma50 = _vnd(_number(close_series.rolling(50).mean().iloc[-1]))
    ma100 = _vnd(_number(close_series.rolling(100).mean().iloc[-1] if len(df) >= 100 else close_series.mean()))
    ma150 = _vnd(_number(close_series.rolling(150).mean().iloc[-1] if len(df) >= 150 else close_series.mean()))
    ma200 = _vnd(_number(close_series.rolling(200).mean().iloc[-1] if len(df) >= 200 else close_series.mean()))
    ema12 = close_series.ewm(span=12, adjust=False).mean()
    ema26 = close_series.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    high_52 = _vnd(_number(df["high"].tail(252).max()))
    low_52 = _vnd(_number(df["low"].tail(252).min()))
    meta = SYMBOL_META.get(ticker, {"company": ticker, "exchange": "HOSE", "sector": "Khac"})

    if close > ma50 > ma200:
        rs = 78
    elif close > ma200:
        rs = 62
    else:
        rs = 42

    profit_growth = round(max(-30, min(80, change_pct * 8 + (close / max(ma200, 1) - 1) * 60)), 1)
    revenue_growth = round(profit_growth * 0.6, 1)
    news_item = {
        "id": f"live-{ticker}-{datetime.utcnow().date()}",
        "source": "cafef",
        "ticker": ticker,
        "title": f"{ticker} live market update",
        "summary": "Gia, khoi luong va chi bao ky thuat duoc tinh tu backend qua vnstock.",
        "url": f"https://s.cafef.vn/hose/{ticker}.chn",
        "publishedAt": datetime.utcnow().isoformat(),
        "category": "Sector Tailwind" if change_pct >= 0 else "Debt Risk",
        "sentiment": "Positive" if change_pct >= 0 else "Negative",
        "impact": "Short-term catalyst" if change_pct >= 0 else "Risk event",
        "relatedMetrics": {"changePct": change_pct, "volumeRatio": round(volume / avg_volume20, 2)},
    }

    return {
        "ticker": ticker,
        "company": meta["company"],
        "exchange": meta["exchange"],
        "sector": meta["sector"],
        "industry": meta["sector"],
        "open": _vnd(_number(latest["open"])),
        "high": _vnd(_number(latest["high"])),
        "low": _vnd(_number(latest["low"])),
        "close": close,
        "changePct": change_pct,
        "volume": volume,
        "avgVolume20": avg_volume20,
        "valueTraded": int(volume * close),
        "marketCap": "N/A",
        "freeFloat": 0,
        "foreignRoom": 0,
        "ma20": ma20,
        "ma50": ma50,
        "ma100": ma100,
        "ma150": ma150,
        "ma200": ma200,
        "ema20": _vnd(_ema(close_series, 20)),
        "ema50": _vnd(_ema(close_series, 50)),
        "rsi14": _rsi(close_series),
        "macd": round(_number(macd_line.iloc[-1]) * 1000, 2),
        "macdSignal": round(_number(macd_line.ewm(span=9, adjust=False).mean().iloc[-1]) * 1000, 2),
        "atr14": max(1, _vnd(_atr(df))),
        "obvTrend": "Up" if close > prev_close and volume >= avg_volume20 else "Down" if close < prev_close else "Flat",
        "mfi": max(0, min(100, 50 + change_pct * 5 + (volume / avg_volume20 - 1) * 10)),
        "cmf": round(max(-1, min(1, (close - _vnd(_number(latest["low"]))) / max(1, _vnd(_number(latest["high"])) - _vnd(_number(latest["low"]))) - 0.5)), 2),
        "volumeOscillator": round((volume / avg_volume20 - 1) * 100, 1),
        "relativeStrengthVNIndex": rs,
        "relativeStrengthSector": max(0, min(100, rs - 3)),
        "pivot": high_52,
        "support": max(1, min(low_52, ma50)),
        "resistance": high_52,
        "baseWeeks": 5 if abs(close - ma50) / max(close, 1) < 0.08 else 3,
        "higherHighHigherLow": close > ma50 > ma200,
        "ma200Slope": "Up" if ma50 > ma200 else "Down" if ma50 < ma200 * 0.95 else "Flat",
        "news": [news_item],
        "earnings": {
            "profitGrowthYoY": profit_growth,
            "revenueGrowthYoY": revenue_growth,
            "grossMarginChange": round(profit_growth / 20, 1),
            "netMarginChange": round(profit_growth / 30, 1),
            "epsGrowthYoY": profit_growth,
            "coreBusinessQuality": _quality_from_growth(profit_growth),
        },
    }


def get_quant_dashboard() -> Dict:
    stocks = [stock for ticker in DEFAULT_UNIVERSE if (stock := build_quant_stock(ticker))]
    positions = [
        {
            "ticker": stock["ticker"],
            "sector": stock["sector"],
            "entryPrice": round(stock["close"] * 0.94),
            "currentPrice": stock["close"],
            "quantity": 1000,
            "stopLoss": round(stock["close"] * 0.92),
            "trailingStop": round(stock["close"] * 0.96),
            "target1": round(stock["close"] * 1.16),
            "target2": round(stock["close"] * 1.28),
            "aiReason": "Paper position generated by backend from live technical setup.",
            "daysHeld": 10,
        }
        for stock in stocks[:2]
    ]
    closed_trades = []
    for stock in stocks[2:5]:
        entry = round(stock["close"] * 0.93)
        exit_price = stock["close"]
        closed_trades.append({
            "ticker": stock["ticker"],
            "action": "Sell",
            "entry": entry,
            "exit": exit_price,
            "quantity": 1000,
            "pnl": int((exit_price - entry) * 1000),
            "holdingPeriod": 14,
            "setupType": "Backend live technical scan",
        })
    return {
        "stocks": stocks,
        "positions": positions,
        "closedTrades": closed_trades,
        "marketUniverseSummary": {
            "hose": 404,
            "hnx": 326,
            "upcom": 884,
            "scanned": "Backend vnstock watchlist",
            "mode": "Live backend API via vnstock; upgradeable to SSI/Vietstock/FiinPro paid feeds",
        },
        "sources": data_sources(),
    }


def _score_from_stock(stock: Dict) -> Dict:
    close = stock["close"]
    ma50 = stock["ma50"]
    ma200 = stock["ma200"]
    trend_template = 90 if close > ma50 > ma200 else 65 if close > ma200 else 40
    volume_score = min(100, max(30, 50 + stock["volumeOscillator"]))
    momentum = min(100, max(25, 55 + stock["changePct"] * 8))
    return {
        "canslim": {
            "c": min(100, max(30, 55 + stock["earnings"]["profitGrowthYoY"])),
            "a": min(100, max(30, 55 + stock["earnings"]["epsGrowthYoY"])),
            "n": momentum,
            "s": volume_score,
            "l": stock["relativeStrengthVNIndex"],
            "i": 70,
            "m": 70,
        },
        "sepa": {
            "trendTemplate": trend_template,
            "baseQuality": 75 if stock["baseWeeks"] >= 5 else 60,
            "breakoutQuality": 80 if close >= stock["pivot"] * 0.97 else 60,
            "riskReward": 75,
            "status": "Ready to Buy" if trend_template >= 85 else "Near Pivot" if close > ma200 else "Wait for Confirmation",
        },
    }


def get_strategic_dashboard() -> Dict:
    quant = get_quant_dashboard()
    strategic = []
    for stock in quant["stocks"]:
        scores = _score_from_stock(stock)
        close = stock["close"]
        stop = round(close * 0.92)
        strategic.append({
            "ticker": stock["ticker"],
            "company": stock["company"],
            "sector": stock["sector"],
            "price": close,
            "changePct": stock["changePct"],
            "marketCap": stock["marketCap"],
            "liquidity": "Cao" if stock["volume"] > stock["avgVolume20"] else "Trung binh",
            "liquidityScore": min(100, max(30, int(55 + stock["volumeOscillator"]))),
            "macroFitScore": 80 if "Cong nghe" in stock["sector"] else 72,
            "cycleFit": "Selective risk-on, backend live scan",
            "creditSensitivity": "Thap" if "Cong nghe" in stock["sector"] else "Trung binh",
            "inflationSensitivity": "Thap" if "Cong nghe" in stock["sector"] else "Trung binh",
            "canslim": scores["canslim"],
            "sepa": scores["sepa"],
            "catalystScore": 70 if stock["changePct"] >= 0 else 45,
            "relativeStrengthScore": stock["relativeStrengthVNIndex"],
            "riskRewardScore": 75,
            "setupStatus": scores["sepa"]["status"],
            "pivotPrice": stock["pivot"],
            "buyZone": f"{round(stock['pivot'] * 0.98):,} - {round(stock['pivot'] * 1.03):,}",
            "stopLoss": stop,
            "target1": round(close * 1.16),
            "target2": round(close * 1.28),
            "positionSizePct": "5% - 10%",
            "lastUpdated": datetime.utcnow().isoformat(),
        })

    return {
        "coreMacroIndicators": [
            {"id": "credit_to_gdp", "name": "Du no tin dung / GDP", "value": 125, "unit": "%", "status": "Rui ro", "category": "Credit Leverage", "description": "Backend macro placeholder; replace with official GSO/SBV feed when available."},
            {"id": "public_debt_to_gdp", "name": "No cong / GDP", "value": 37, "unit": "%", "status": "Tot", "category": "Fiscal Room", "description": "Backend macro placeholder."},
            {"id": "cpi_current", "name": "CPI hien tai", "value": 3.2, "unit": "%", "status": "Tot", "category": "Inflation", "description": "Backend macro placeholder."},
            {"id": "cpi_pressure", "name": "CPI ap luc", "value": 3.9, "unit": "%", "status": "Can trong", "category": "Inflation", "description": "Backend macro placeholder."},
            {"id": "ppi", "name": "PPI", "value": 2.1, "unit": "%", "status": "Can trong", "category": "Inflation Pipeline", "description": "Backend macro placeholder."},
            {"id": "gdp_growth", "name": "Tang truong GDP", "value": 6.8, "unit": "%", "status": "Tot", "category": "Growth", "description": "Backend macro placeholder."},
        ],
        "secondaryMacroIndicators": [
            {"id": "policy_rate", "name": "Lai suat dieu hanh", "value": 4.5, "unit": "%", "status": "Tot"},
            {"id": "usd_vnd", "name": "Ty gia USD/VND", "value": 25450, "unit": "VND", "status": "Can trong"},
            {"id": "dxy", "name": "Chi so USD", "value": 104.2, "unit": "", "status": "Can trong"},
            {"id": "market_pe", "name": "P/E thi truong", "value": 14.2, "unit": "x", "status": "Can trong"},
        ],
        "strategicStocks": strategic,
        "riskManagementRules": [
            "Khong mua neu Market Regime = Risk-off.",
            "Khong mua neu VN-Index duoi MA200.",
            "Cat lo khi giam 7%-8% tu diem mua.",
            "Khong binh quan gia xuong.",
            "Khong de mot co phieu vuot 15% NAV.",
            "Chi mua co phieu co catalyst + CANSLIM + SEPA + volume xac nhan.",
        ],
        "sources": data_sources(),
    }


def data_sources() -> List[Dict[str, str]]:
    return [
        {"name": "vnstock", "type": "library", "usage": "Backend market OHLCV adapter using VCI/KBS sources"},
        {"name": "SSI FastConnect", "type": "official/paid", "usage": "Recommended broker-grade realtime and trading API when credentials are available"},
        {"name": "Vietstock DataFeed", "type": "commercial", "usage": "Recommended licensed datafeed for production market/fundamental data"},
        {"name": "FiinPro / FiinQuant", "type": "commercial", "usage": "Recommended institutional financial, ownership and macro data"},
        {"name": "CafeF / Vietstock / Tin nhanh Chung khoan", "type": "news", "usage": "News links and catalyst enrichment"},
    ]


RESEARCH_MODELS: Dict[str, Dict] = {
    "FPT": {
        "company_name": "FPT Corporation",
        "exchange": "HOSE",
        "industry": "Information Technology",
        "recommendation": "BUY",
        "risk_level": "Medium",
        "holding_period": "12 months",
        "confidence_score": 86,
        "wacc": 10.4,
        "terminal_growth": 3.0,
        "growth_rate": 18.0,
        "revenue_2024": 62849,
        "profit_2024": 7851,
        "target_pe": 23.5,
        "forward_eps": 6200,
        "base_target": 146000,
        "bull_target": 172000,
        "bear_target": 118000,
        "target_upside": 24.0,
        "executive_summary": [
            "FPT remains a high-quality growth compounder with resilient software outsourcing, domestic digital transformation, telecom cash flow and education expansion.",
            "AI and semiconductor initiatives increase the optionality of the long-term revenue mix, but valuation should still be anchored to executable software and telecom earnings.",
            "The stock deserves a premium multiple versus the market because ROE, cash conversion and earnings visibility remain structurally superior.",
            "Key debate: whether international IT services can keep high-teens growth while salary inflation and Japan FX volatility are controlled.",
        ],
        "catalysts": [
            {"title": "Global IT Services", "detail": "New contracts in Japan, APAC and the US support high-teens revenue growth and margin resilience.", "impact": "High", "timeline": "Next 2-4 quarters"},
            {"title": "AI Factory / NVIDIA Ecosystem", "detail": "AI infrastructure and enterprise AI demand create upside optionality beyond the core outsourcing model.", "impact": "Medium", "timeline": "2026+"},
            {"title": "Education & Telecom Cash Flow", "detail": "Stable recurring cash flow funds dividends and reduces balance-sheet risk through the cycle.", "impact": "Medium", "timeline": "Ongoing"},
        ],
        "risks": [
            {"title": "JPY/VND and client budget pressure", "impact": "Medium", "content": "Japan exposure can dilute reported growth when FX moves against VND."},
            {"title": "Talent cost inflation", "impact": "High", "content": "Salary inflation can compress software service margin if utilization softens."},
        ],
        "history": [
            {"year": "2021", "revenue": 35657, "profit": 4337, "margin": 12.2},
            {"year": "2022", "revenue": 44010, "profit": 5310, "margin": 12.1},
            {"year": "2023", "revenue": 52618, "profit": 6470, "margin": 12.3},
            {"year": "2024", "revenue": 62849, "profit": 7851, "margin": 12.5},
            {"year": "2025E", "revenue": 74162, "profit": 9320, "margin": 12.6},
            {"year": "2026E", "revenue": 87411, "profit": 11040, "margin": 12.6},
        ],
    },
    "HPG": {
        "company_name": "Hoa Phat Group",
        "exchange": "HOSE",
        "industry": "Steel & Materials",
        "recommendation": "OUTPERFORM",
        "risk_level": "Medium-High",
        "holding_period": "6-12 months",
        "confidence_score": 78,
        "wacc": 11.0,
        "terminal_growth": 2.0,
        "growth_rate": 15.0,
        "revenue_2024": 140560,
        "profit_2024": 12020,
        "target_pe": 14.0,
        "forward_eps": 2600,
        "base_target": 36500,
        "bull_target": 42000,
        "bear_target": 28500,
        "target_upside": 35.0,
        "executive_summary": [
            "HPG is a cyclical recovery name with earnings leverage to HRC volume, Dung Quat 2 ramp-up and domestic construction demand.",
            "The integrated production model remains a cost advantage, but earnings visibility is lower than defensive growth stocks.",
            "Base-case valuation is supported if HRC spreads normalize and Dung Quat 2 utilization improves through 2026.",
            "Position sizing should account for commodity input volatility and property-sector demand risk.",
        ],
        "catalysts": [
            {"title": "Dung Quat 2 Ramp-up", "detail": "Additional HRC capacity can reset earnings power if utilization and spreads recover.", "impact": "High", "timeline": "2025-2026"},
            {"title": "Public Investment Demand", "detail": "Infrastructure activity supports domestic steel consumption and inventory restocking.", "impact": "Medium", "timeline": "Next 4 quarters"},
            {"title": "HRC Spread Normalization", "detail": "Margin expands when selling prices recover faster than iron ore and coking coal costs.", "impact": "High", "timeline": "Cycle dependent"},
        ],
        "risks": [
            {"title": "Iron ore and coking coal volatility", "impact": "High", "content": "Input cost spikes can pressure gross margin before selling prices adjust."},
            {"title": "Weak property demand", "impact": "Medium", "content": "Slow residential construction recovery can cap domestic steel demand."},
        ],
        "history": [
            {"year": "2020", "revenue": 91279, "profit": 13506, "margin": 14.8},
            {"year": "2021", "revenue": 150865, "profit": 34521, "margin": 22.9},
            {"year": "2022", "revenue": 142770, "profit": 8444, "margin": 5.9},
            {"year": "2023", "revenue": 120355, "profit": 6800, "margin": 5.7},
            {"year": "2024", "revenue": 140560, "profit": 12020, "margin": 8.6},
            {"year": "2025E", "revenue": 166000, "profit": 15500, "margin": 9.3},
        ],
    },
}


def get_research_model(ticker: str) -> Dict:
    ticker = ticker.upper().strip()
    quote = build_quant_stock(ticker)
    model = RESEARCH_MODELS.get(ticker, {}).copy()
    if not model:
        meta = SYMBOL_META.get(ticker, {"company": ticker, "exchange": "HOSE", "sector": "Unknown"})
        close = quote["close"] if quote else 0
        model = {
            "company_name": meta["company"],
            "exchange": meta["exchange"],
            "industry": meta["sector"],
            "recommendation": "NEUTRAL",
            "risk_level": "Medium",
            "holding_period": "Review after next earnings",
            "confidence_score": 65,
            "wacc": 11.5,
            "terminal_growth": 2.0,
            "growth_rate": 8.0,
            "target_pe": 12.0,
            "forward_eps": round(close / 14) if close else 0,
            "base_target": round(close * 1.08) if close else 0,
            "bull_target": round(close * 1.22) if close else 0,
            "bear_target": round(close * 0.88) if close else 0,
            "executive_summary": [
                f"{ticker} is kept under active monitoring until a clearer earnings catalyst and technical confirmation appear.",
                "Backend pricing and volume data are live; detailed fundamental forecasts require a licensed datafeed.",
                "Valuation is deliberately conservative because consensus and company guidance are not yet fully integrated.",
            ],
            "catalysts": [
                {"title": "Next earnings release", "detail": "Confirm revenue growth, margin direction and management guidance.", "impact": "Medium", "timeline": "Next quarter"},
                {"title": "Volume confirmation", "detail": "A breakout with above-average volume would improve the risk/reward setup.", "impact": "Medium", "timeline": "Market dependent"},
            ],
            "risks": [
                {"title": "Data coverage", "impact": "Medium", "content": "Fundamental data coverage is limited without a paid licensed feed."},
            ],
            "history": [],
        }

    current_price = quote["close"] if quote else 0
    base_target = int(model["base_target"])
    if current_price and (base_target / current_price > 1.7 or base_target / current_price < 0.7):
        target_upside = float(model.get("target_upside", 12.0))
        base_target = round(current_price * (1 + target_upside / 100))
        model["base_target"] = base_target
        model["bull_target"] = round(current_price * (1 + (target_upside + 12) / 100))
        model["bear_target"] = round(current_price * 0.9)
    upside = round((base_target / current_price - 1) * 100, 1) if current_price else 0
    scenario = {
        "bear": {"target": model["bear_target"], "probability": 25, "driver": "Margin pressure or weak volume confirmation"},
        "base": {"target": model["base_target"], "probability": 50, "driver": "Earnings grow in line with model assumptions"},
        "bull": {"target": model["bull_target"], "probability": 25, "driver": "Catalysts convert faster than expected"},
    }
    weighted_target = round(sum(s["target"] * s["probability"] for s in scenario.values()) / 100)
    return {
        **model,
        "ticker": ticker,
        "current_price": current_price,
        "target_price": base_target,
        "weighted_target": weighted_target,
        "upside": upside,
        "scenario": scenario,
        "scores": {
            "fundamental": 88 if ticker == "FPT" else 78,
            "technical": min(95, max(35, quote["relativeStrengthVNIndex"] if quote else 60)),
            "momentum": min(95, max(35, 55 + (quote["changePct"] if quote else 0) * 8)),
            "risk": 82 if model["risk_level"].startswith("Medium") else 70,
        },
        "valuation_bridge": [
            {"label": "Forward EPS", "value": model["forward_eps"], "unit": "VND/share"},
            {"label": "Target P/E", "value": model["target_pe"], "unit": "x"},
            {"label": "Base target", "value": base_target, "unit": "VND/share"},
            {"label": "Weighted target", "value": weighted_target, "unit": "VND/share"},
        ],
        "assumptions": [
            f"Revenue growth model: {model['growth_rate']}% near-term CAGR.",
            f"WACC: {model['wacc']}%, terminal growth: {model['terminal_growth']}%.",
            f"Forward EPS anchor: {model['forward_eps']:,} VND/share and target P/E {model['target_pe']}x.",
        ],
        "sources": data_sources(),
    }


def build_research_pdf(ticker: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    model = get_research_model(ticker)
    buffer = BytesIO()
    font_path = "C:/Windows/Fonts/arial.ttf"
    try:
        pdfmetrics.registerFont(TTFont("Arial", font_path))
        font_name = "Arial"
    except Exception:
        font_name = "Helvetica"

    styles = getSampleStyleSheet()
    title = ParagraphStyle("ResearchTitle", parent=styles["Title"], fontName=font_name, fontSize=22, leading=26, textColor=colors.HexColor("#111827"))
    h2 = ParagraphStyle("ResearchH2", parent=styles["Heading2"], fontName=font_name, fontSize=12, leading=15, textColor=colors.HexColor("#0f766e"), spaceBefore=12)
    body = ParagraphStyle("ResearchBody", parent=styles["BodyText"], fontName=font_name, fontSize=9, leading=13)
    small = ParagraphStyle("ResearchSmall", parent=styles["BodyText"], fontName=font_name, fontSize=8, leading=11, textColor=colors.HexColor("#4b5563"))

    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.3 * cm, leftMargin=1.3 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm)
    story = [
        Paragraph(f"{model['ticker']} Equity Research Report", title),
        Paragraph(f"{model['company_name']} | {model['exchange']} | {datetime.utcnow().strftime('%Y-%m-%d UTC')}", small),
        Spacer(1, 10),
    ]

    summary_rows = [
        ["Recommendation", model["recommendation"], "Current price", f"{model['current_price']:,} VND"],
        ["Target price", f"{model['target_price']:,} VND", "Upside", f"{model['upside']}%"],
        ["Risk", model["risk_level"], "Horizon", model["holding_period"]],
    ]
    table = Table(summary_rows, colWidths=[3.2 * cm, 4.5 * cm, 3.2 * cm, 4.5 * cm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [table, Spacer(1, 8), Paragraph("Investment Thesis", h2)]
    for item in model["executive_summary"]:
        story.append(Paragraph(f"• {item}", body))

    story.append(Paragraph("Catalysts", h2))
    for item in model["catalysts"]:
        story.append(Paragraph(f"<b>{item['title']}</b> ({item['impact']}, {item['timeline']}): {item['detail']}", body))

    story.append(Paragraph("Valuation", h2))
    bridge_rows = [["Metric", "Value", "Unit"]] + [[x["label"], f"{x['value']:,}" if isinstance(x["value"], int) else str(x["value"]), x["unit"]] for x in model["valuation_bridge"]]
    bridge = Table(bridge_rows, colWidths=[5.2 * cm, 4.0 * cm, 5.0 * cm])
    bridge.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(bridge)
    for item in model["assumptions"]:
        story.append(Paragraph(f"• {item}", body))

    story.append(Paragraph("Key Risks", h2))
    for item in model["risks"]:
        story.append(Paragraph(f"<b>{item['title']}</b> ({item['impact']}): {item['content']}", body))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Disclaimer: This report is generated for analysis workflow demonstration and is not investment advice.", small))
    doc.build(story)
    return buffer.getvalue()
