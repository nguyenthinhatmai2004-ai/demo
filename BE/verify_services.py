import asyncio
import logging
from sqlmodel import Session
from database import engine, create_db_and_tables
from services import StrategyEvaluator, MacroEngine, QuantTrader

logging.basicConfig(level=logging.INFO)

async def test_services():
    print("Creating tables...")
    create_db_and_tables()
    
    with Session(engine) as session:
        print("\n--- Testing MacroEngine ---")
        macro = MacroEngine(session)
        macro.update_indicators()
        phase = macro.get_market_phase()
        print(f"Market Phase: {phase['phase']}")
        
        print("\n--- Testing StrategyEvaluator ---")
        evaluator = StrategyEvaluator(session)
        score_entry = evaluator.evaluate_and_persist("FPT")
        print(f"FPT Scores - CANSLIM: {score_entry.canslim_score}, SEPA: {score_entry.sepa_score}")
        
        print("\n--- Testing QuantTrader ---")
        trader = QuantTrader(session)
        await trader.scan_and_trade(["FPT", "SSI"])
        print("Scan and trade completed.")

if __name__ == "__main__":
    asyncio.run(test_services())
