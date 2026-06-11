import logging
from datetime import datetime
from functools import lru_cache
from io import BytesIO
from typing import Dict, List, Optional

import pandas as pd
from vnstock import Finance, Quote

from config import settings

logger = logging.getLogger("LiveDashboard")


SYMBOL_META: Dict[str, Dict[str, str]] = {
    "FPT": {"company": "FPT Corp", "exchange": "HOSE", "sector": "Công nghệ"},
    "HPG": {"company": "Hòa Phát", "exchange": "HOSE", "sector": "Thép / vật liệu"},
    "DGC": {"company": "Đức Giang Chemicals", "exchange": "HOSE", "sector": "Hóa chất"},
    "SSI": {"company": "SSI Securities", "exchange": "HOSE", "sector": "Chứng khoán"},
    "VCI": {"company": "Vietcap", "exchange": "HOSE", "sector": "Chứng khoán"},
    "VND": {"company": "VNDirect", "exchange": "HOSE", "sector": "Chứng khoán"},
    "VCB": {"company": "Vietcombank", "exchange": "HOSE", "sector": "Ngân hàng"},
    "MBB": {"company": "MB Bank", "exchange": "HOSE", "sector": "Ngân hàng"},
    "TCB": {"company": "Techcombank", "exchange": "HOSE", "sector": "Ngân hàng"},
    "ACB": {"company": "ACB", "exchange": "HOSE", "sector": "Ngân hàng"},
    "MWG": {"company": "Mobile World", "exchange": "HOSE", "sector": "Tiêu dùng"},
    "PNJ": {"company": "PNJ", "exchange": "HOSE", "sector": "Tiêu dùng"},
    "MSN": {"company": "Masan", "exchange": "HOSE", "sector": "Tiêu dùng"},
    "VNM": {"company": "Vinamilk", "exchange": "HOSE", "sector": "Tiêu dùng"},
    "VIC": {"company": "Vingroup", "exchange": "HOSE", "sector": "Tập đoàn / bất động sản"},
    "VHM": {"company": "Vinhomes", "exchange": "HOSE", "sector": "Bất động sản"},
    "KDH": {"company": "Khang Điền", "exchange": "HOSE", "sector": "Bất động sản"},
    "NLG": {"company": "Nam Long", "exchange": "HOSE", "sector": "Bất động sản"},
    "CTD": {"company": "Coteccons", "exchange": "HOSE", "sector": "Xây dựng / đầu tư công"},
    "HHV": {"company": "Đèo Cả", "exchange": "HOSE", "sector": "Hạ tầng"},
    "VCG": {"company": "Vinaconex", "exchange": "HNX", "sector": "Xây dựng / đầu tư công"},
    "CII": {"company": "Hạ tầng kỹ thuật TP.HCM", "exchange": "HOSE", "sector": "Hạ tầng / Bất động sản"},
}

DEFAULT_UNIVERSE = list(SYMBOL_META.keys())


TICKER_CATALYSTS: Dict[str, List[Dict[str, str]]] = {
    "FPT": [
        {"title": "AI Factory và hợp đồng công nghệ quốc tế", "detail": "Backlog chuyển đổi số, AI và thị trường Nhật/Mỹ là biến số cần theo dõi riêng cho FPT.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Viễn thông và giáo dục giữ nền dòng tiền", "detail": "Dòng tiền lặp lại giúp giảm biến động lợi nhuận khi mảng dịch vụ CNTT toàn cầu chậm lại.", "impact": "Trung bình", "timeline": "Liên tục"},
    ],
    "HPG": [
        {"title": "Dung Quất 2 ramp-up", "detail": "Sản lượng HRC mới và tỷ lệ vận hành nhà máy là catalyst lợi nhuận riêng của HPG.", "impact": "Cao", "timeline": "2025-2026"},
        {"title": "Spread thép và tái tích trữ", "detail": "Biên lợi nhuận phục hồi nếu giá bán thép vượt tốc độ tăng quặng sắt/than luyện cốc.", "impact": "Cao", "timeline": "Theo chu kỳ"},
    ],
    "DGC": [
        {"title": "Chu kỳ giá phốt pho vàng", "detail": "Biên lợi nhuận DGC nhạy với giá phốt pho, xuất khẩu và nhu cầu hóa chất công nghiệp.", "impact": "Cao", "timeline": "Theo quý"},
        {"title": "Dự án hóa chất mới", "detail": "Tiến độ pháp lý, capex và chạy thử dự án mới quyết định mở rộng công suất dài hạn.", "impact": "Trung bình", "timeline": "2025-2026"},
    ],
    "SSI": [
        {"title": "Thanh khoản thị trường và nâng hạng", "detail": "Doanh thu môi giới, cho vay margin và tự doanh của SSI hưởng lợi khi GTGD tăng.", "impact": "Cao", "timeline": "Theo thị trường"},
        {"title": "Deal ECM/IB quay lại", "detail": "Pipeline phát hành, niêm yết và tư vấn vốn có thể bổ sung lợi nhuận ngoài môi giới.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
    ],
    "VCI": [
        {"title": "Pipeline ngân hàng đầu tư", "detail": "VCI có đòn bẩy cao với các thương vụ ECM/M&A khi điều kiện vốn thuận lợi hơn.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Tự doanh và brokerage hồi phục", "detail": "Danh mục tự doanh và thị phần môi giới cần xác nhận bằng thanh khoản toàn thị trường.", "impact": "Trung bình", "timeline": "Theo thị trường"},
    ],
    "VND": [
        {"title": "Margin và thị phần môi giới", "detail": "VND nhạy với tăng trưởng dư nợ margin và sự phục hồi của nhà đầu tư cá nhân.", "impact": "Cao", "timeline": "Theo thị trường"},
        {"title": "Tái định vị sau giai đoạn rủi ro vận hành", "detail": "Niềm tin khách hàng và ổn định hệ thống là điều kiện để catalyst thị phần phát huy.", "impact": "Trung bình", "timeline": "2-3 quý tới"},
    ],
    "VCB": [
        {"title": "Chất lượng tài sản và CASA", "detail": "VCB có catalyst từ chi phí vốn thấp, nợ xấu kiểm soát và khả năng mở rộng NIM chọn lọc.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Tăng vốn và room tín dụng", "detail": "Thông tin tăng vốn hoặc hạn mức tín dụng mới có thể hỗ trợ định giá premium.", "impact": "Trung bình", "timeline": "Theo chính sách"},
    ],
    "MBB": [
        {"title": "Hệ sinh thái số và CASA", "detail": "Tăng trưởng khách hàng số, phí dịch vụ và CASA là catalyst riêng của MBB.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Tín dụng bán lẻ/quốc phòng ổn định", "detail": "Chất lượng tài sản cần được xác nhận khi tín dụng hệ thống tăng lại.", "impact": "Trung bình", "timeline": "Theo quý"},
    ],
    "TCB": [
        {"title": "CASA phục hồi", "detail": "TCB nhạy với CASA, chi phí vốn và nhu cầu tín dụng của hệ sinh thái khách hàng lớn.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Trái phiếu và bất động sản giảm áp lực", "detail": "Rủi ro tài sản liên quan BĐS giảm sẽ giúp P/B được tái định giá.", "impact": "Trung bình", "timeline": "Theo quý"},
    ],
    "ACB": [
        {"title": "Bán lẻ chất lượng cao", "detail": "ACB có catalyst từ tăng trưởng tín dụng bán lẻ thận trọng và nợ xấu thấp.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
        {"title": "Cổ tức tiền mặt/cổ phiếu", "detail": "Chính sách phân phối lợi nhuận đều có thể hỗ trợ khẩu vị phòng thủ.", "impact": "Trung bình", "timeline": "Theo ĐHCĐ"},
    ],
    "MWG": [
        {"title": "Bách Hóa Xanh hòa vốn và mở rộng", "detail": "Biên EBITDA, doanh thu/cửa hàng và tốc độ mở mới BHX là catalyst riêng của MWG.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Điện máy/điện thoại hồi phục", "detail": "Chu kỳ thay thế thiết bị và sức mua tiêu dùng quyết định đòn bẩy doanh thu.", "impact": "Trung bình", "timeline": "Theo mùa vụ"},
    ],
    "PNJ": [
        {"title": "Sức mua trang sức và mở cửa hàng", "detail": "SSSG, biên gộp bán lẻ và mở rộng mạng lưới là catalyst cần theo dõi riêng cho PNJ.", "impact": "Cao", "timeline": "Theo quý"},
        {"title": "Giá vàng ổn định", "detail": "Chênh lệch giá vàng bớt biến động giúp nhu cầu trang sức rõ hơn nhu cầu đầu cơ.", "impact": "Trung bình", "timeline": "Theo thị trường"},
    ],
    "MSN": [
        {"title": "WinCommerce cải thiện biên", "detail": "Mở rộng cửa hàng có chọn lọc và cải thiện EBITDA WCM là catalyst chính của MSN.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Giảm đòn bẩy và tái cấu trúc danh mục", "detail": "Thoái vốn, giảm nợ hoặc tối ưu hàng tiêu dùng có thể mở khóa định giá.", "impact": "Trung bình", "timeline": "Theo sự kiện"},
    ],
    "VNM": [
        {"title": "Biên sữa phục hồi", "detail": "Giá nguyên liệu sữa bột, mix sản phẩm và kiểm soát chi phí quyết định biên lợi nhuận VNM.", "impact": "Trung bình", "timeline": "Theo quý"},
        {"title": "Xuất khẩu và thị phần nội địa", "detail": "Tăng trưởng kênh xuất khẩu hoặc lấy lại thị phần giúp câu chuyện tăng trưởng bớt phòng thủ.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
    ],
    "VIC": [
        {"title": "VinFast và tiến độ gọi vốn", "detail": "Dòng tiền, bàn giao xe và giao dịch huy động vốn của VinFast là catalyst riêng của VIC.", "impact": "Cao", "timeline": "Theo sự kiện"},
        {"title": "Bàn giao bất động sản và dịch vụ", "detail": "Tiến độ dự án, doanh thu tài chính và dòng tiền tập đoàn cần xác nhận theo quý.", "impact": "Trung bình", "timeline": "Theo quý"},
    ],
    "VHM": [
        {"title": "Bàn giao đại dự án", "detail": "Tiến độ bàn giao Ocean Park/Smart City/Grand Park và dự án mới quyết định lợi nhuận VHM.", "impact": "Cao", "timeline": "Theo quý"},
        {"title": "Pháp lý và presales", "detail": "Mở bán mới, hấp thụ sản phẩm và pháp lý dự án là điều kiện để định giá hồi phục.", "impact": "Cao", "timeline": "2-4 quý tới"},
    ],
    "KDH": [
        {"title": "Mở bán dự án thấp tầng", "detail": "Tiến độ pháp lý và booking tại các dự án TP.HCM là catalyst riêng của KDH.", "impact": "Cao", "timeline": "Theo sự kiện"},
        {"title": "Bảng cân đối lành mạnh", "detail": "Đòn bẩy thấp giúp KDH hưởng lợi khi lãi suất hỗ trợ BĐS chọn lọc.", "impact": "Trung bình", "timeline": "Liên tục"},
    ],
    "NLG": [
        {"title": "Bàn giao Akari/Waterpoint", "detail": "Tiến độ bàn giao và ghi nhận lợi nhuận từ dự án trung cấp là catalyst riêng của NLG.", "impact": "Cao", "timeline": "Theo quý"},
        {"title": "Presales phục hồi", "detail": "Tốc độ bán hàng mới cho thấy nhu cầu nhà ở thực có quay lại hay chưa.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
    ],
    "CTD": [
        {"title": "Backlog xây dựng mới", "detail": "Giá trị hợp đồng ký mới, đặc biệt dự án FDI/công nghiệp, là catalyst chính của CTD.", "impact": "Cao", "timeline": "2-4 quý tới"},
        {"title": "Biên gộp hồi phục", "detail": "Khả năng kiểm soát chi phí và lựa chọn dự án quyết định chất lượng lợi nhuận.", "impact": "Trung bình", "timeline": "Theo quý"},
    ],
    "HHV": [
        {"title": "Đầu tư công và PPP giao thông", "detail": "Khối lượng thi công cao tốc, BOT/PPP mới và giải ngân hạ tầng là catalyst riêng của HHV.", "impact": "Cao", "timeline": "2025-2026"},
        {"title": "Lưu lượng thu phí", "detail": "Lưu lượng xe và điều chỉnh phí BOT hỗ trợ dòng tiền vận hành.", "impact": "Trung bình", "timeline": "Theo quý"},
    ],
    "VCG": [
        {"title": "Backlog hạ tầng", "detail": "Tiến độ thi công sân bay, cao tốc và dự án công là catalyst riêng của VCG.", "impact": "Cao", "timeline": "2025-2026"},
        {"title": "Bất động sản và thoái vốn", "detail": "Mở khóa quỹ đất hoặc thoái vốn tài sản có thể bổ sung lợi nhuận ngoài xây lắp.", "impact": "Trung bình", "timeline": "Theo sự kiện"},
    ],
    "CII": [
        {"title": "Đấu giá đất Thủ Thiêm", "detail": "CII sở hữu quỹ đất lớn tại Thủ Thiêm; việc tái khởi động đấu giá đất tại đây là catalyst cực mạnh cho định giá tài sản.", "impact": "Rất cao", "timeline": "2-4 quý tới"},
        {"title": "Dòng tiền từ các dự án BOT", "detail": "Các dự án như Trung Lương - Mỹ Thuận và Xa lộ Hà Nội đi vào vận hành ổn định giúp cải thiện dòng tiền hoạt động.", "impact": "Cao", "timeline": "Liên tục"},
        {"title": "Tái cấu trúc nợ và trái phiếu", "detail": "Việc mua lại trái phiếu trước hạn và giảm áp lực nợ vay giúp tối ưu chi phí tài chính.", "impact": "Trung bình", "timeline": "2-3 quý tới"},
    ],
}


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
    for source in settings.vnstock_quote_sources:
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
        return "Chất lượng cao"
    if growth >= 0:
        return "Chất lượng trung bình"
    return "Chất lượng thấp"


def _sector_fallback_catalysts(ticker: str, sector: str) -> List[Dict[str, str]]:
    if "Công nghệ" in sector:
        return [
            {"title": "Hợp đồng chuyển đổi số", "detail": f"{ticker} cần xác nhận tăng trưởng backlog và doanh thu dịch vụ công nghệ.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
            {"title": "AI và cloud", "detail": "Nhu cầu AI/cloud có thể hỗ trợ định giá nếu chuyển hóa thành doanh thu thực.", "impact": "Trung bình", "timeline": "Từ 2026"},
        ]
    if "Chứng khoán" in sector:
        return [
            {"title": "Thanh khoản thị trường", "detail": f"{ticker} nhạy với giá trị giao dịch, dư nợ margin và khẩu vị risk-on.", "impact": "Cao", "timeline": "Theo thị trường"},
            {"title": "Kỳ vọng nâng hạng", "detail": "Dòng tiền ngoại và sản phẩm mới có thể hỗ trợ nhóm chứng khoán nếu tiến độ nâng hạng rõ hơn.", "impact": "Trung bình", "timeline": "Theo sự kiện"},
        ]
    if "Ngân hàng" in sector:
        return [
            {"title": "Room tín dụng và NIM", "detail": f"{ticker} cần xác nhận tăng trưởng tín dụng, CASA và chi phí vốn trong các quý tới.", "impact": "Trung bình", "timeline": "Theo quý"},
            {"title": "Chất lượng tài sản", "detail": "Nợ xấu và chi phí dự phòng giảm sẽ là điều kiện để định giá ngân hàng cải thiện.", "impact": "Cao", "timeline": "2-4 quý tới"},
        ]
    if "Bất động sản" in sector:
        return [
            {"title": "Pháp lý dự án", "detail": f"{ticker} cần catalyst từ mở bán, bàn giao hoặc tháo gỡ pháp lý dự án cụ thể.", "impact": "Cao", "timeline": "Theo sự kiện"},
            {"title": "Lãi suất và hấp thụ", "detail": "Mặt bằng lãi suất thấp hơn chỉ có ý nghĩa khi presales và dòng tiền khách hàng cải thiện.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
        ]
    if any(key in sector for key in ("Thép", "vật liệu", "Hóa chất")):
        return [
            {"title": "Chu kỳ giá hàng hóa", "detail": f"{ticker} nhạy với spread sản phẩm, chi phí đầu vào và nhu cầu xuất khẩu.", "impact": "Cao", "timeline": "Theo quý"},
            {"title": "Đầu tư công / công nghiệp", "detail": "Nhu cầu hạ tầng và sản xuất công nghiệp là biến số hỗ trợ sản lượng.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
        ]
    if any(key in sector for key in ("Tiêu dùng", "bán lẻ")):
        return [
            {"title": "Sức mua nội địa", "detail": f"{ticker} cần xác nhận doanh thu cùng cửa hàng, biên gộp và kiểm soát chi phí.", "impact": "Trung bình", "timeline": "Theo quý"},
            {"title": "Tái cấu trúc vận hành", "detail": "Cải thiện hiệu quả cửa hàng/kênh phân phối sẽ là catalyst lợi nhuận rõ hơn giá trị vĩ mô chung.", "impact": "Trung bình", "timeline": "2-4 quý tới"},
        ]
    return [
        {"title": f"KQKD riêng của {ticker}", "detail": "Theo dõi tăng trưởng doanh thu, lợi nhuận và biên lợi nhuận từ báo cáo tài chính mới nhất.", "impact": "Trung bình", "timeline": "Quý tới"},
        {"title": f"Xác nhận kỹ thuật {ticker}", "detail": "Giá vượt pivot với thanh khoản trên trung bình 20 phiên sẽ cải thiện xác suất setup.", "impact": "Trung bình", "timeline": "Theo thị trường"},
    ]


def ticker_catalysts(ticker: str, sector: str = "", quote: Optional[Dict] = None) -> List[Dict[str, str]]:
    ticker = ticker.upper().strip()
    sector = sector or SYMBOL_META.get(ticker, {}).get("sector", "")
    catalysts = [item.copy() for item in TICKER_CATALYSTS.get(ticker, _sector_fallback_catalysts(ticker, sector))]

    if quote:
        volume_ratio = round(quote["volume"] / max(quote["avgVolume20"], 1), 2)
        if quote["close"] >= quote["pivot"] * 0.97 and volume_ratio >= 1.1:
            catalysts.append({
                "title": f"Breakout gần pivot {quote['pivot']:,}",
                "detail": f"Giá đang sát pivot với volume {volume_ratio}x trung bình 20 phiên, phù hợp để kiểm tra xác nhận dòng tiền.",
                "impact": "Trung bình",
                "timeline": "Ngắn hạn",
            })
        elif volume_ratio >= 1.3:
            catalysts.append({
                "title": "Thanh khoản tăng bất thường",
                "detail": f"Volume đạt {volume_ratio}x trung bình 20 phiên, cần đối chiếu với tin riêng của {ticker}.",
                "impact": "Trung bình",
                "timeline": "Ngắn hạn",
            })

    return catalysts[:4]


def catalyst_badges_for_ticker(ticker: str, sector: str = "", quote: Optional[Dict] = None) -> List[str]:
    return [item["title"] for item in ticker_catalysts(ticker, sector, quote)][:4]


def _catalyst_score_from_stock(stock: Dict) -> int:
    score = 55
    if stock["ticker"] in TICKER_CATALYSTS:
        score += 10
    if stock["changePct"] > 0:
        score += min(10, int(stock["changePct"] * 3))
    if stock["volume"] > stock["avgVolume20"]:
        score += min(10, int((stock["volume"] / max(stock["avgVolume20"], 1) - 1) * 12))
    if stock["close"] >= stock["pivot"] * 0.97:
        score += 8
    if stock["earnings"]["profitGrowthYoY"] >= 15:
        score += 7
    return min(95, max(35, score))


def _legacy_incomplete_build_quant_stock(ticker: str) -> Optional[Dict]:
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
    meta = SYMBOL_META.get(ticker, {"company": ticker, "exchange": "HOSE", "sector": "Khác"})

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
        "summary": "Giá, khối lượng và chỉ báo kỹ thuật được tính từ backend qua vnstock.",
        "url": f"https://s.cafef.vn/hose/{ticker}.chn",
        "publishedAt": datetime.utcnow().isoformat(),
        "category": "Yếu tố hỗ trợ ngành" if change_pct >= 0 else "Rủi ro nợ vay",
        "sentiment": "Positive" if change_pct >= 0 else "Negative",
        "impact": "Catalyst ngắn hạn" if change_pct >= 0 else "Sự kiện rủi ro",
        "relatedMetrics": {"changePct": change_pct, "volumeRatio": round(volume / avg_volume20, 2)},
    }


def _latest_period_columns(df: pd.DataFrame) -> List[str]:
    return [col for col in df.columns if col not in {"item", "item_en", "item_id"}]


def _row_value(df: pd.DataFrame, item_id: str, period_col: Optional[str] = None, default: float = 0.0) -> float:
    if df is None or df.empty or "item_id" not in df.columns:
        return default
    rows = df[df["item_id"].astype(str).str.lower() == item_id.lower()]
    if rows.empty:
        return default
    columns = _latest_period_columns(df)
    if not columns:
        return default
    row = rows.iloc[0]
    if period_col is not None:
        for idx, col in enumerate(df.columns):
            if idx >= 3 and str(col) == str(period_col):
                return _number(row.iloc[idx], default)
    return _number(row.iloc[3], default)


@lru_cache(maxsize=128)
def fetch_financial_frame(ticker: str, statement: str) -> pd.DataFrame:
    ticker = ticker.upper().strip()
    try:
        finance = Finance(symbol=ticker, source=settings.vnstock_finance_source)
        if statement == "ratio":
            return finance.ratio(period="year", lang="en")
        if statement == "income":
            return finance.income_statement(period="year", lang="en")
        if statement == "balance":
            return finance.balance_sheet(period="year", lang="en")
        if statement == "cashflow":
            return finance.cash_flow(period="year", lang="en")
    except Exception as exc:
        logger.warning("finance %s failed for %s: %s", statement, ticker, exc)
    return pd.DataFrame()


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
    rs = 78 if close > ma50 > ma200 else 62 if close > ma200 else 42
    profit_growth = round(max(-30, min(80, change_pct * 8 + (close / max(ma200, 1) - 1) * 60)), 1)
    revenue_growth = round(profit_growth * 0.6, 1)
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
        "news": [],
        "earnings": {
            "profitGrowthYoY": profit_growth,
            "revenueGrowthYoY": revenue_growth,
            "grossMarginChange": round(profit_growth / 20, 1),
            "netMarginChange": round(profit_growth / 30, 1),
            "epsGrowthYoY": profit_growth,
            "coreBusinessQuality": _quality_from_growth(profit_growth),
        },
    }


def get_live_ratios(ticker: str) -> Dict:
    ticker = ticker.upper().strip()
    ratios = fetch_financial_frame(ticker, "ratio")
    quote = build_quant_stock(ticker)
    latest_col = None

    pe = _row_value(ratios, "pe_ratio", latest_col)
    pb = _row_value(ratios, "pb_ratio", latest_col)
    roe = _row_value(ratios, "roe", latest_col) * 100
    margin = (_row_value(ratios, "net_margin", latest_col) or _row_value(ratios, "gross_margin", latest_col)) * 100
    debt_equity = _row_value(ratios, "debt_to_equity", latest_col) or _row_value(ratios, "debtPerEquity", latest_col)
    eps = round((quote["close"] / pe), 0) if quote and pe else 0
    source = f"vnstock Finance.ratio(source={settings.vnstock_finance_source})"

    if not any([pe, pb, roe, margin, debt_equity, eps]):
        model = RESEARCH_MODELS.get(ticker, {})
        history = model.get("history", [])
        latest_history = history[-1] if history else {}
        pe = float(model.get("target_pe") or 0)
        margin = float(latest_history.get("margin") or 0)
        eps = float(model.get("forward_eps") or 0)
        roe = round(margin * 2, 2) if margin else 0
        debt_equity = 0.4 if model else 0
        source = "research_model_fallback"

    def status(value: float, good: float, warning: float, lower_is_better: bool = False) -> str:
        if value == 0:
            return "neutral"
        if lower_is_better:
            return "good" if value <= good else "warning" if value <= warning else "danger"
        return "good" if value >= good else "neutral" if value >= warning else "warning"

    return {
        "pe": round(pe, 2),
        "pb": round(pb, 2),
        "roe": round(roe, 2),
        "margin": round(margin, 2),
        "debt_equity": round(debt_equity, 2),
        "eps": eps,
        "status": {
            "pe": status(pe, 12, 20, lower_is_better=True),
            "roe": status(roe, 18, 10),
            "margin": status(margin, 15, 8),
            "debt_equity": status(debt_equity, 1, 2, lower_is_better=True),
        },
        "notes": {
            "pe": "Latest available P/E; fallback uses research model target P/E when live provider is empty.",
            "roe": "Latest available ROE; fallback is estimated from model margin when live provider is empty.",
            "margin": "Latest available net/gross margin; fallback uses research model history.",
            "debt_equity": "Latest available debt/equity; fallback uses conservative model estimate.",
        },
        "source": source,
        "period": "latest",
    }


def get_live_financial_history(ticker: str, years: int = 6) -> List[Dict]:
    income = fetch_financial_frame(ticker, "income")
    ratios = fetch_financial_frame(ticker, "ratio")
    period_cols = _latest_period_columns(income)[:years]
    rows = []
    for col in period_cols:
        revenue = _row_value(income, "net_sales", col) or _row_value(income, "sales", col)
        profit = (
            _row_value(income, "net_profit_loss_after_tax", col)
            or _row_value(income, "attributable_to_parent_company", col)
        )
        margin = _row_value(ratios, "net_margin", col) * 100
        rows.append({
            "year": str(col),
            "revenue": round(revenue / 1_000_000_000),
            "profit": round(profit / 1_000_000_000),
            "margin": round(margin, 2),
        })
    return rows


def _has_real_financial_history(history: List[Dict]) -> bool:
    return any(
        float(item.get("revenue") or 0) > 0 or float(item.get("profit") or 0) > 0
        for item in history or []
    )

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
            "status": "Sẵn sàng mua" if trend_template >= 85 else "Gần pivot" if close > ma200 else "Chờ xác nhận",
        },
    }


def get_strategic_dashboard() -> Dict:
    quant = get_quant_dashboard()
    strategic = []
    for stock in quant["stocks"]:
        scores = _score_from_stock(stock)
        close = stock["close"]
        stop = round(close * 0.92)
        catalysts = catalyst_badges_for_ticker(stock["ticker"], stock["sector"], stock)
        strategic.append({
            "ticker": stock["ticker"],
            "company": stock["company"],
            "sector": stock["sector"],
            "price": close,
            "changePct": stock["changePct"],
            "marketCap": stock["marketCap"],
            "liquidity": "Cao" if stock["volume"] > stock["avgVolume20"] else "Trung bình",
            "liquidityScore": min(100, max(30, int(55 + stock["volumeOscillator"]))),
            "macroFitScore": 80 if "Công nghệ" in stock["sector"] else 72,
            "cycleFit": "Risk-on chọn lọc, backend live scan",
            "creditSensitivity": "Thấp" if "Công nghệ" in stock["sector"] else "Trung bình",
            "inflationSensitivity": "Thấp" if "Công nghệ" in stock["sector"] else "Trung bình",
            "canslim": scores["canslim"],
            "sepa": scores["sepa"],
            "catalystScore": _catalyst_score_from_stock(stock),
            "catalysts": catalysts,
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
            {"id": "credit_to_gdp", "name": "Dư nợ tín dụng / GDP", "value": 125, "unit": "%", "status": "Rủi ro", "category": "Credit Leverage", "description": "Backend macro placeholder; replace with official GSO/SBV feed when available."},
            {"id": "public_debt_to_gdp", "name": "Nợ công / GDP", "value": 37, "unit": "%", "status": "Tốt", "category": "Fiscal Room", "description": "Backend macro placeholder."},
            {"id": "cpi_current", "name": "CPI hiện tại", "value": 3.2, "unit": "%", "status": "Tốt", "category": "Inflation", "description": "Backend macro placeholder."},
            {"id": "cpi_pressure", "name": "CPI áp lực", "value": 3.9, "unit": "%", "status": "Cẩn trọng", "category": "Inflation", "description": "Backend macro placeholder."},
            {"id": "ppi", "name": "PPI", "value": 2.1, "unit": "%", "status": "Cẩn trọng", "category": "Inflation Pipeline", "description": "Backend macro placeholder."},
            {"id": "gdp_growth", "name": "Tăng trưởng GDP", "value": 6.8, "unit": "%", "status": "Tốt", "category": "Growth", "description": "Backend macro placeholder."},
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
        {"name": "vnstock", "type": "library", "usage": f"Backend market OHLCV adapter using {', '.join(settings.vnstock_quote_sources)} sources"},
        {"name": "SSI FastConnect", "type": "official/paid", "usage": "Recommended broker-grade realtime and trading API when credentials are available"},
        {"name": "Vietstock DataFeed", "type": "commercial", "usage": "Recommended licensed datafeed for production market/fundamental data"},
        {"name": "FiinPro / FiinQuant", "type": "commercial", "usage": "Recommended institutional financial, ownership and macro data"},
        {"name": "CafeF / Vietstock / Tin nhanh Chung khoan", "type": "news", "usage": "News links and catalyst enrichment"},
    ]


RESEARCH_MODELS: Dict[str, Dict] = {
    "FPT": {
        "company_name": "FPT Corporation",
        "exchange": "HOSE",
        "industry": "Công nghệ thông tin",
        "recommendation": "MUA",
        "risk_level": "Trung bình",
        "holding_period": "12 tháng",
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
            "FPT tiếp tục là doanh nghiệp tăng trưởng chất lượng cao nhờ xuất khẩu phần mềm, chuyển đổi số trong nước, dòng tiền viễn thông và mảng giáo dục.",
            "Các sáng kiến AI và bán dẫn tạo thêm quyền chọn tăng trưởng dài hạn, nhưng định giá vẫn neo vào năng lực thực thi của mảng phần mềm và viễn thông.",
            "Cổ phiếu xứng đáng được giao dịch ở mức P/E cao hơn thị trường nhờ ROE, khả năng chuyển đổi tiền mặt và độ chắc chắn lợi nhuận vượt trội.",
            "Vấn đề cần theo dõi là liệu dịch vụ CNTT quốc tế có duy trì được tăng trưởng cao trong khi kiểm soát lạm phát lương và biến động JPY/VND.",
        ],
        "catalysts": [
            {"title": "Dịch vụ CNTT toàn cầu", "detail": "Hợp đồng mới tại Nhật Bản, APAC và Mỹ hỗ trợ tăng trưởng doanh thu cao và giữ biên lợi nhuận ổn định.", "impact": "Cao", "timeline": "2-4 quý tới"},
            {"title": "AI Factory / hệ sinh thái NVIDIA", "detail": "Hạ tầng AI và nhu cầu AI doanh nghiệp tạo dư địa tăng trưởng ngoài mô hình outsourcing truyền thống.", "impact": "Trung bình", "timeline": "Từ 2026"},
            {"title": "Giáo dục và dòng tiền viễn thông", "detail": "Dòng tiền lặp lại ổn định hỗ trợ cổ tức và giảm rủi ro bảng cân đối trong chu kỳ.", "impact": "Trung bình", "timeline": "Liên tục"},
        ],
        "risks": [
            {"title": "Tỷ giá JPY/VND và ngân sách khách hàng", "impact": "Trung bình", "content": "Doanh thu từ Nhật Bản có thể bị pha loãng khi tỷ giá biến động bất lợi so với VND."},
            {"title": "Lạm phát chi phí nhân sự", "impact": "Cao", "content": "Chi phí lương tăng có thể làm giảm biên lợi nhuận dịch vụ phần mềm nếu tỷ lệ sử dụng nhân sự suy yếu."},
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
        "industry": "Thép và vật liệu",
        "recommendation": "KHẢ QUAN",
        "risk_level": "Trung bình - Cao",
        "holding_period": "6-12 tháng",
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
            "HPG là cổ phiếu chu kỳ hồi phục, có đòn bẩy lợi nhuận từ sản lượng HRC, tiến độ Dung Quất 2 và nhu cầu xây dựng trong nước.",
            "Mô hình sản xuất khép kín tiếp tục là lợi thế chi phí, nhưng độ chắc chắn lợi nhuận thấp hơn nhóm tăng trưởng phòng thủ.",
            "Định giá cơ sở được hỗ trợ nếu spread HRC bình thường hóa và tỷ lệ vận hành Dung Quất 2 cải thiện trong năm 2026.",
            "Tỷ trọng đầu tư cần phản ánh biến động giá nguyên liệu và rủi ro nhu cầu từ bất động sản.",
        ],
        "catalysts": [
            {"title": "Dung Quất 2 tăng công suất", "detail": "Công suất HRC bổ sung có thể nâng lại nền lợi nhuận nếu tỷ lệ sử dụng và spread hồi phục.", "impact": "Cao", "timeline": "2025-2026"},
            {"title": "Nhu cầu đầu tư công", "detail": "Hoạt động hạ tầng hỗ trợ tiêu thụ thép nội địa và chu kỳ tái tích trữ hàng tồn kho.", "impact": "Trung bình", "timeline": "4 quý tới"},
            {"title": "Spread HRC bình thường hóa", "detail": "Biên lợi nhuận mở rộng khi giá bán phục hồi nhanh hơn quặng sắt và than luyện cốc.", "impact": "Cao", "timeline": "Theo chu kỳ"},
        ],
        "risks": [
            {"title": "Biến động quặng sắt và than luyện cốc", "impact": "Cao", "content": "Chi phí đầu vào tăng nhanh có thể gây áp lực lên biên gộp trước khi giá bán điều chỉnh."},
            {"title": "Nhu cầu bất động sản yếu", "impact": "Trung bình", "content": "Sự hồi phục chậm của xây dựng dân dụng có thể giới hạn nhu cầu thép nội địa."},
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


def _legacy_static_research_model(ticker: str) -> Dict:
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
            "recommendation": "TRUNG LẬP",
            "risk_level": "Trung bình",
            "holding_period": "Đánh giá lại sau kỳ KQKD tới",
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
                f"{ticker} được giữ trong danh sách theo dõi cho tới khi xuất hiện catalyst lợi nhuận và xác nhận kỹ thuật rõ ràng hơn.",
                "Dữ liệu giá và khối lượng được lấy trực tiếp từ backend; dự báo cơ bản chi tiết cần thêm nguồn dữ liệu có bản quyền.",
                "Định giá hiện được đặt thận trọng vì consensus và hướng dẫn doanh nghiệp chưa được tích hợp đầy đủ.",
            ],
            "catalysts": ticker_catalysts(ticker, meta["sector"], quote),
            "risks": [
                {"title": "Độ phủ dữ liệu", "impact": "Trung bình", "content": "Dữ liệu cơ bản còn giới hạn nếu chưa kết nối nguồn dữ liệu trả phí có bản quyền."},
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
        "bear": {"target": model["bear_target"], "probability": 25, "driver": "Áp lực biên lợi nhuận hoặc khối lượng xác nhận yếu"},
        "base": {"target": model["base_target"], "probability": 50, "driver": "Lợi nhuận tăng đúng theo giả định mô hình"},
        "bull": {"target": model["bull_target"], "probability": 25, "driver": "Catalyst chuyển hóa nhanh hơn kỳ vọng"},
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
            "risk": 82 if model["risk_level"].startswith("Trung") else 70,
        },
        "valuation_bridge": [
            {"label": "EPS dự phóng", "value": model["forward_eps"], "unit": "VND/cp"},
            {"label": "P/E mục tiêu", "value": model["target_pe"], "unit": "x"},
            {"label": "Giá mục tiêu cơ sở", "value": base_target, "unit": "VND/cp"},
            {"label": "Giá mục tiêu xác suất", "value": weighted_target, "unit": "VND/cp"},
        ],
        "assumptions": [
            f"Mô hình tăng trưởng doanh thu: CAGR ngắn hạn {model['growth_rate']}%.",
            f"WACC: {model['wacc']}%, terminal growth: {model['terminal_growth']}%.",
            f"EPS dự phóng: {model['forward_eps']:,} VND/cp và P/E mục tiêu {model['target_pe']}x.",
        ],
        "sources": data_sources(),
    }


def get_research_model(ticker: str) -> Dict:
    ticker = ticker.upper().strip()
    quote = build_quant_stock(ticker)
    meta = SYMBOL_META.get(ticker, {"company": ticker, "exchange": "HOSE", "sector": "Unknown"})
    ratios = get_live_ratios(ticker)
    history = get_live_financial_history(ticker)
    fallback_model = RESEARCH_MODELS.get(ticker, {})
    if not _has_real_financial_history(history):
        history = fallback_model.get("history", [])
    current_price = quote["close"] if quote else 0
    technical_score = min(95, max(35, quote["relativeStrengthVNIndex"] if quote else 60))
    roe = float(ratios.get("roe") or 0)
    margin = float(ratios.get("margin") or 0)
    pe = float(ratios.get("pe") or 0)
    eps = float(ratios.get("eps") or 0)
    growth_rate = 8.0
    if len(history) >= 2 and history[1].get("profit"):
        growth_rate = round(((history[0]["profit"] - history[1]["profit"]) / abs(history[1]["profit"])) * 100, 1)

    target_pe = max(8.0, min(24.0, (pe or 12.0) * (1.08 if roe >= 18 else 0.95)))
    base_target = round(eps * target_pe) if eps else round(current_price * (1.1 if technical_score >= 70 else 1.02))
    if current_price and (base_target / current_price > 1.6 or base_target / current_price < 0.65):
        base_target = round(current_price * (1.12 if technical_score >= 70 else 1.03))
    bull_target = round(base_target * 1.15)
    bear_target = round(current_price * 0.88) if current_price else 0
    upside = round((base_target / current_price - 1) * 100, 1) if current_price else 0
    recommendation = "MUA" if upside >= 15 and technical_score >= 65 else "KHẢ QUAN" if technical_score >= 60 else "TRUNG LẬP"
    risk_level = "Trung bình" if quote and quote["atr14"] / max(current_price, 1) < 0.06 else "Cao"
    scenario = {
        "bear": {"target": bear_target, "probability": 25, "driver": "Giá phá vỡ hỗ trợ hoặc biên lợi nhuận suy yếu"},
        "base": {"target": base_target, "probability": 50, "driver": "Định giá dựa trên EPS/P-E và dữ liệu vnstock/VCI"},
        "bull": {"target": bull_target, "probability": 25, "driver": "Catalyst lợi nhuận và dòng tiền xác nhận nhanh hơn kỳ vọng"},
    }
    weighted_target = round(sum(s["target"] * s["probability"] for s in scenario.values()) / 100)
    model = {
        "ticker": ticker,
        "company_name": meta["company"],
        "exchange": meta["exchange"],
        "industry": meta["sector"],
        "recommendation": recommendation,
        "risk_level": risk_level,
        "holding_period": "Đánh giá lại sau kỳ KQKD tới",
        "confidence_score": int(min(88, max(55, technical_score * 0.55 + min(roe, 35)))),
        "wacc": 11.5,
        "terminal_growth": 2.0,
        "growth_rate": growth_rate,
        "target_pe": round(target_pe, 1),
        "forward_eps": round(eps),
        "base_target": base_target,
        "bull_target": bull_target,
        "bear_target": bear_target,
        "current_price": current_price,
        "target_price": base_target,
        "weighted_target": weighted_target,
        "upside": upside,
        "scenario": scenario,
        "executive_summary": [
            f"{ticker} được phân tích từ giá/khối lượng vnstock và chỉ số tài chính VCI.",
            f"ROE {roe:.1f}%, biên lợi nhuận {margin:.1f}% và P/E {pe:.1f}x là đầu vào chính của mô hình.",
            f"Điểm kỹ thuật hiện tại {technical_score:.0f}/100; cần xác nhận bằng thanh khoản và KQKD mới nhất.",
        ],
        "catalysts": fallback_model.get("catalysts") or ticker_catalysts(ticker, meta["sector"], quote),
        "risks": [
            {"title": "Rủi ro dữ liệu và định giá", "impact": "Trung bình", "content": "Mô hình dùng dữ liệu công khai qua vnstock/VCI; consensus từ nguồn trả phí chưa được tích hợp."},
            {"title": "Rủi ro kỹ thuật", "impact": "Trung bình", "content": "Cần cắt lỗ nếu giá phá vỡ hỗ trợ/MA quan trọng với thanh khoản cao."},
        ],
        "history": history,
        "ratio_notes": ratios.get("notes", {}),
        "forecast_period_years": len(history),
        "final_opinion": (
            f"{ticker} đang có khuyến nghị {recommendation} với giá mục tiêu {base_target:,} VND/cp, "
            f"upside {upside}% dựa trên giá hiện tại {current_price:,} VND/cp. "
            f"Luận điểm chính đến từ ROE {roe:.1f}%, biên lợi nhuận {margin:.1f}%, P/E {pe:.1f}x "
            "và trạng thái kỹ thuật/thanh khoản lấy từ vnstock. Cần theo dõi rủi ro phá vỡ hỗ trợ và cập nhật KQKD mới."
        ),
        "scores": {
            "fundamental": int(min(95, max(35, 45 + roe + margin / 2))),
            "technical": technical_score,
            "momentum": min(95, max(35, 55 + (quote["changePct"] if quote else 0) * 8)),
            "risk": 82 if risk_level.startswith("Trung") else 65,
        },
        "valuation_bridge": [
            {"label": "EPS dự phóng", "value": round(eps), "unit": "VND/cp"},
            {"label": "P/E mục tiêu", "value": round(target_pe, 1), "unit": "x"},
            {"label": "Giá mục tiêu cơ sở", "value": base_target, "unit": "VND/cp"},
            {"label": "Giá mục tiêu xác suất", "value": weighted_target, "unit": "VND/cp"},
        ],
        "assumptions": [
            f"Tăng trưởng lợi nhuận gần nhất: {growth_rate}%.",
            f"WACC: 11.5%, terminal growth: 2.0%.",
            f"EPS ước tính: {round(eps):,} VND/cp và P/E mục tiêu {round(target_pe, 1)}x.",
        ],
        "sources": data_sources(),
    }
    return model


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
        Paragraph(f"Báo cáo phân tích cổ phiếu {model['ticker']}", title),
        Paragraph(f"{model['company_name']} | {model['exchange']} | {datetime.utcnow().strftime('%Y-%m-%d UTC')}", small),
        Spacer(1, 10),
    ]

    summary_rows = [
        ["Khuyến nghị", model["recommendation"], "Giá hiện tại", f"{model['current_price']:,} VND"],
        ["Giá mục tiêu", f"{model['target_price']:,} VND", "Upside", f"{model['upside']}%"],
        ["Rủi ro", model["risk_level"], "Thời gian nắm giữ", model["holding_period"]],
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
    story += [table, Spacer(1, 8), Paragraph("Luận điểm đầu tư", h2)]
    for item in model["executive_summary"]:
        story.append(Paragraph(f"• {item}", body))

    story.append(Paragraph("Catalyst", h2))
    for item in model["catalysts"]:
        story.append(Paragraph(f"<b>{item['title']}</b> ({item['impact']}, {item['timeline']}): {item['detail']}", body))

    story.append(Paragraph("Định giá", h2))
    bridge_rows = [["Chỉ tiêu", "Giá trị", "Đơn vị"]] + [[x["label"], f"{x['value']:,}" if isinstance(x["value"], int) else str(x["value"]), x["unit"]] for x in model["valuation_bridge"]]
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

    story.append(Paragraph("Rủi ro chính", h2))
    for item in model["risks"]:
        story.append(Paragraph(f"<b>{item['title']}</b> ({item['impact']}): {item['content']}", body))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Miễn trừ trách nhiệm: Báo cáo được tạo cho mục đích phân tích và trình diễn quy trình, không phải khuyến nghị đầu tư bắt buộc.", small))
    doc.build(story)
    return buffer.getvalue()
