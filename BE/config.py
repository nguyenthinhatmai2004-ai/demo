import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)


def _csv_env(name: str, default: str) -> List[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


class Settings:
    app_name = "VN Stock Terminal"
    api_host = os.getenv("API_HOST", "0.0.0.0")
    api_port = int(os.getenv("API_PORT", "8021"))
    database_url = os.getenv("DATABASE_URL", "sqlite:///./vnstock_v3.db")
    cors_origins = _csv_env(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    vnstock_quote_sources = _csv_env("VNSTOCK_QUOTE_SOURCES", "VCI,KBS")
    vnstock_finance_source = os.getenv("VNSTOCK_FINANCE_SOURCE", "VCI")
    ticker_tape_symbols = _csv_env(
        "TICKER_TAPE_SYMBOLS",
        "FPT,SSI,HPG,VCB,DGC,VNM,TCB,MWG,PNJ,VIC",
    )
    scan_symbols = _csv_env(
        "SCAN_SYMBOLS",
        "FPT,HPG,SSI,VCI,VND,VCB,MBB,TCB,ACB,MWG,PNJ,MSN",
    )
    paper_account_balance = int(os.getenv("PAPER_ACCOUNT_BALANCE", "0"))
    frontend_trader_url = os.getenv("FRONTEND_TRADER_URL", "http://localhost:3000")
    openai_model = os.getenv("OPENAI_MODEL", "gpt-5.2")
    dnse_base_url = os.getenv("DNSE_BASE_URL", "https://openapi.dnse.com.vn")
    news_verify_tls = os.getenv("NEWS_VERIFY_TLS", "true").lower() not in {"0", "false", "no"}


settings = Settings()
