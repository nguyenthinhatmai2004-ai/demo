# Vietnam Stock Terminal Prototype

Hệ thống theo dõi thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM).

## Cấu trúc dự án
- `BE/`: Backend FastAPI (Python). Xử lý dữ liệu thị trường và cào tin tức on-demand.
- `FE/`: Frontend React + Vite + Tailwind CSS. Dashboard hiển thị đồ thị và tin tức.

## Hướng dẫn khởi chạy

### 1. Khởi chạy Backend (BE)
```powershell
cd BE
# Kích hoạt venv (nếu có)
.\venv\Scripts\activate
# Cài đặt thư viện
pip install fastapi uvicorn vnstock beautifulsoup4 httpx python-dotenv
# Chạy server
python main.py
```
Backend sẽ chạy tại `http://localhost:8001`.

### 2. Khởi chạy Frontend (FE)
```powershell
cd FE
# Cài đặt dependencies
npm install
# Chạy dashboard
npm run dev
```
Truy cập URL hiển thị (thường là `http://localhost:5173`).

## Tính năng chính
- **Đồ thị FireAnt:** Tích hợp đồ thị kỹ thuật thời gian thực từ FireAnt.
- **Cào tin tức đa nguồn:** Tự động lấy tin từ Cafef, Vietstock, VnExpress... cho từng mã chứng khoán.
- **Báo cáo phân tích:** Hiển thị danh sách các bài phân tích từ các công ty chứng khoán.
- **Watchlist:** Theo dõi nhanh các mã cổ phiếu hàng đầu VN30.
