from sqlmodel import SQLModel, Field, create_engine, Session
from typing import Optional
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Ưu tiên PostgreSQL nếu có cấu hình trong .env, nếu không dùng SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vnstock_v3.db")

# Cấu hình connect_args đặc biệt cho SQLite để hỗ trợ đa luồng trong FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

class News(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    link: str = Field(index=True)
    source: str
    category: Optional[str] = None  # Divestment, Dividend, Earnings, Plans
    ticker: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MacroIndicator(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    value: float
    status: str
    label: str
    description: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AITradeLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str
    side: str  # BUY, SELL
    price: float
    quantity: int
    strategy: str
    pnl: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Watchlist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)

class StrategyScore(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    canslim_score: float
    sepa_score: float
    details: Optional[str] = None # JSON string
    updated_at: datetime = Field(default_factory=datetime.utcnow)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
