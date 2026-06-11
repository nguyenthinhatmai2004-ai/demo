# Vietnam Stock Terminal Prototype

Dashboard phân tích thị trường chứng khoán Việt Nam cho HOSE, HNX và UPCOM.

## Project Layout

- `BE/`: FastAPI backend for market data, news, research, paper trading, and AI-assisted reports.
- `FE/`: React + Vite + Tailwind frontend for analyst, strategic, and quant views.
- `vnstock_v3.db`: local SQLite database used by the backend when `DATABASE_URL` is not set.

## Backend

```powershell
cd BE
pip install -r requirements.txt
python main.py
```

The backend defaults to `http://127.0.0.1:8021`.

Important environment variables:

- `API_HOST`, `API_PORT`: backend bind address and port.
- `DATABASE_URL`: defaults to `sqlite:///./vnstock_v3.db`.
- `CORS_ORIGINS`: comma-separated frontend origins, default `http://localhost:3000,http://127.0.0.1:3000`.
- `VNSTOCK_QUOTE_SOURCES`: comma-separated quote fallback priority, default `VCI,KBS`.
- `VNSTOCK_FINANCE_SOURCE`: default `VCI`.
- `TICKER_TAPE_SYMBOLS`, `SCAN_SYMBOLS`: configurable stock universes.
- `DNSE_API_KEY`, `DNSE_API_SECRET`, `DNSE_BASE_URL`: optional DNSE market data integration.
- `OPENAI_API_KEY`, `OPENAI_MODEL`: optional AI report/advisor integration.

## Frontend

```powershell
cd FE
npm install
npm run dev
```

The frontend defaults to `http://127.0.0.1:8021/api` for backend calls. Override it with:

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:8021/api"
npm run dev
```

## Docker Deployment

Build and run both services:

```powershell
docker compose build
docker compose up -d
```

Open:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8021`
- Backend API example: `http://127.0.0.1:8021/api/universe`

Useful commands:

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

The backend container persists SQLite data in the `backend_data` Docker volume. The frontend image is built with `VITE_API_BASE_URL=http://127.0.0.1:8021/api` by default; change the build arg in `docker-compose.yml` for a remote host.

## Gmail News

To show Gmail bot news in the Analyst page `Daily Market Brief`, enable IMAP in Gmail and set these values in `BE/.env`:

```env
GMAIL_ADDRESS=your-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
GMAIL_MAILBOX=INBOX
GMAIL_NEWS_QUERY=long.nt1608 newer_than:2d
GMAIL_NEWS_LOOKBACK_HOURS=48
GMAIL_NEWS_SENDER=
```

The Analyst page reads this through `/api/news/gmail/brief/{ticker}` and keeps Gmail items from the last 48 hours.

## Data Source Strategy

Current prototype sources:

- `vnstock` for OHLCV and financial statements, with configurable source priority.
- DNSE OpenAPI when broker credentials are configured.
- CafeF, Vietstock, VietnamBiz, Người Quan Sát, Tin Nhanh Chứng Khoán, and Gmail bot messages for news enrichment.

Recommended production data sources:

- SSI FastConnect for broker-grade realtime data and trading workflows.
- FiinQuant/FiinPro for institutional market, ownership, order book, and financial datasets.
- Vietstock DataFeed/API for licensed market, company, fundamental, macro, and news data.

## Verification

```powershell
python -m py_compile BE\main.py BE\services.py BE\database.py BE\scraper.py BE\live_dashboard.py BE\config.py
D:\demo\BE\venv\Scripts\python.exe -m pytest BE
cd FE
npm.cmd run lint
npm.cmd run build
node test_browser.cjs
```
