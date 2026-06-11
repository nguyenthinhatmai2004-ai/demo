from live_dashboard import get_research_model, ticker_catalysts


def _quote(ticker: str) -> dict:
    return {
        "ticker": ticker,
        "close": 100_000,
        "pivot": 104_000,
        "volume": 1_400_000,
        "avgVolume20": 1_000_000,
        "relativeStrengthVNIndex": 72,
        "atr14": 4_000,
        "changePct": 1.2,
    }


def test_ticker_catalysts_are_symbol_specific() -> None:
    fpt_titles = [item["title"] for item in ticker_catalysts("FPT", "Công nghệ")]
    hpg_titles = [item["title"] for item in ticker_catalysts("HPG", "Thép / vật liệu")]

    assert "AI Factory và hợp đồng công nghệ quốc tế" in fpt_titles
    assert "Dung Quất 2 ramp-up" in hpg_titles
    assert set(fpt_titles) != set(hpg_titles)


def test_research_model_uses_ticker_specific_catalysts(monkeypatch) -> None:
    monkeypatch.setattr("live_dashboard.build_quant_stock", _quote)
    monkeypatch.setattr(
        "live_dashboard.get_live_ratios",
        lambda _ticker: {"roe": 15, "margin": 12, "pe": 14, "eps": 5000, "notes": {}},
    )
    monkeypatch.setattr("live_dashboard.get_live_financial_history", lambda _ticker: [])

    model = get_research_model("SSI")
    titles = [item["title"] for item in model["catalysts"]]

    assert "Thanh khoản thị trường và nâng hạng" in titles
    assert "Kỳ công bố KQKD tới" not in titles
