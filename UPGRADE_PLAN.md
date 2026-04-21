# 🚀 KẾ HOẠCH NÂNG CẤP VIETNAM STOCK TERMINAL v3.0

Dự án này được thiết kế để trở thành một hệ thống hỗ trợ quyết định đầu tư toàn diện, kết hợp giữa phân tích dữ liệu truyền thống và trí tuệ nhân tạo (AI). Hệ thống sử dụng **PostgreSQL** để lưu trữ dữ liệu dài hạn, đảm bảo tính nhất quán và khả năng mở rộng.

---

## 🟢 PHÂN KHU 1: EQUITY INTEL HUB (PHÒNG PHÂN TÍCH)
*Vai trò: Chuyên viên phân tích cổ phiếu (Equity Analyst)*

### 1. Luồng tin tức thông minh (News Terminal)
*   **Cơ chế:** Cào dữ liệu (Scraping) liên tục từ CafeF, Vietstock.
*   **Phân loại tự động (Tagging):** Phân loại tin vào các nhóm: `[THOÁI VỐN]`, `[CỔ TỨC]`, `[KQKD]`, `[KẾ HOẠCH]`.
*   **Lưu trữ dài hạn:** Mọi tin tức sau khi cào sẽ được lưu vào PostgreSQL để tra cứu lịch sử và phân tích xu hướng. [DONE]

### 2. Tích hợp Đồ thị & Phân tích
*   **Charts:** Lightweight Charts với MA, RSI, MACD.
*   **Equity Snapshot:** Bảng tóm tắt định giá chuyên sâu.

---

## 🟡 PHÂN KHU 2: STRATEGIC INVESTMENT (CHIẾN LƯỢC & VĨ MÔ)
*Vai trò: Chuyên viên quản lý danh mục (Investment & Macro Analyst)*

### 1. Radar Kinh tế Vĩ mô (Macro Radar)
*   **Market Cycle Map:** Xác định trạng thái thị trường dựa trên Tỷ giá, Lãi suất, CPI, IIP.
*   **Dữ liệu lịch sử:** Lưu trữ biến động vĩ mô theo thời gian trong Postgres để vẽ biểu đồ so sánh. [DONE]

### 2. Săn cổ phiếu tăng trưởng (CANSLIM & SEPA)
*   **C-A-N-S-L-I-M Engine:** Bộ lọc siêu cổ phiếu theo O'Neil và Minervini.
*   **Portfolio Allocator:** Công cụ gợi ý tỷ trọng vốn tối ưu.

### 3. Phòng vệ Downtrend (Bear Market Strategy)
*   **Hedging Mode:** Gợi ý các điểm **Short Phái sinh (VN30F1M)** khi thị trường vào Downtrend.

---

## 🔴 PHÂN KHU 3: AI QUANT TRADER (GIAO DỊCH TỰ ĐỘNG)
*Vai trò: Nhà giao dịch thuật toán (Quantitative Trader)*

### 1. AI Trading Engine
*   **Strategy Engine:** Thực thi các chiến thuật *Mean Reversion*, *Breakout Hunter*.
*   **Trade Persistence:** Mọi lệnh giao dịch (giả lập) đều được lưu vào Postgres để tính toán hiệu quả (PnL, Sharpe Ratio). [DONE]

### 2. Command Center (Trung tâm điều lệnh)
*   **Live Log:** Luồng log lệnh thời gian thực qua WebSockets. [DONE]
*   **Performance Tracking:** Theo dõi Equity Curve dựa trên dữ liệu lịch sử trong DB.

---

## 🛠 TECH STACK (CÔNG NGHỆ SỬ DỤNG)

### 1. Backend (The Intelligence Engine)
- **Ngôn ngữ:** `Python 3.10+`
- **Framework:** `FastAPI` (REST & WebSockets)
- **Database:** `PostgreSQL` (Lưu trữ tin tức, logs, vĩ mô)
- **ORM:** `SQLModel` (SQLAlchemy + Pydantic)
- **Data Science:** `Pandas`, `NumPy`, `vnstock`
- **AI/NLP:** `TextBlob` (Sentiment Analysis)

### 2. Frontend (The Command Center)
- **Framework:** `React 19` + `Vite`
- **Ngôn ngữ:** `TypeScript`
- **Styling:** `Tailwind CSS 4.0`
- **Charting:** `Lightweight Charts` (TradingView)

---

## ✅ DANH SÁCH TODO (LỘ TRÌNH THỰC THI)

### 🟦 GIAI ĐOẠN 1: NỀN TẢNG & DATABASE
- [x] **1.1. Thiết lập PostgreSQL:**
    - [x] Khởi tạo Database và thiết kế Schema cho `news`, `macro_data`, `trade_logs`.
    - [x] Cấu hình kết nối `SQLModel` trong FastAPI.
- [x] **1.2. Hệ thống Tin tức & Vĩ mô:**
    - [x] Nâng cấp scraper hỗ trợ phân loại nhãn và lưu vào DB.
    - [x] Xây dựng engine tính toán Market Cycle.

### 🟩 GIAI ĐOẠN 2: CẤU TRÚC GIAO DIỆN (UI ARCHITECTURE)
- [x] **2.1. Thanh điều hướng (Sidebar):**
    - [x] Thiết kế lại Sidebar với 3 phân khu chính.
- [x] **2.2. Hoàn thiện Layout 3 Trang:**
    - [x] Trang 1: Analyst Hub (Layout 2 cột).
    - [x] Trang 2: Strategic Investment (Macro Map + Portfolio).
    - [x] Trang 3: AI Trader Workspace (Cyberpunk Log).

### 🟥 GIAI ĐOẠN 3: AI TRADING & TỐI ƯU
- [x] **3.1. Quant Implementation:**
    - [x] Viết thuật toán trading ngắn hạn và lưu lịch sử lệnh vào Postgres.
- [x] **3.2. Real-time Features:**
    - [x] Triển khai WebSockets để đẩy dữ liệu sống từ DB lên UI.

---

## 🔥 ĐIỂM NHẤN CÔNG NGHỆ (ADVANCED HIGHLIGHTS)
1. **Persistent Intelligence:** Sử dụng **PostgreSQL** để tích lũy tri thức thị trường (tin tức, vĩ mô) theo thời gian.
2. **Hybrid Strategy Engine:** Kết hợp CANSLIM, SEPA và Derivatives Hedging.
3. **Low-Latency Streaming:** WebSockets cho trải nghiệm giao dịch thời gian thực.
4. **Data-Driven Analysis:** Đánh giá hiệu quả AI Trader qua các chỉ số Sharpe Ratio, Drawdown chuyên nghiệp.
