from fastapi.testclient import TestClient

from config import settings
from main import app


client = TestClient(app)


def test_root_health():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_data_sources_expose_provider_strategy():
    response = client.get("/api/data/sources")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "vnstock" in names
    assert "SSI FastConnect" in names
    assert "FiinPro / FiinQuant" in names


def test_universe_uses_configured_symbols():
    response = client.get("/api/universe")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ticker_tape"] == settings.ticker_tape_symbols
    assert payload["scan_symbols"] == settings.scan_symbols
    assert any(item["ticker"] == "FPT" for item in payload["symbols"])
