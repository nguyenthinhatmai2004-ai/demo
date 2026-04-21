from vnstock import Quote
import pandas as pd

ticker = 'SSI'
q = Quote(symbol=ticker, source='vci')

print("--- Testing price_depth ---")
try:
    depth = q.price_depth()
    print("Price Depth Data:")
    print(depth)
except Exception as e:
    print(f"Price depth error: {e}")

print("\n--- Testing intraday ---")
try:
    intra = q.intraday()
    print("Intraday Data (Head):")
    print(intra.head())
    if not intra.empty:
        # Check columns to see if it has 'side' or 'type' (Buy/Sell)
        print("Intraday columns:", intra.columns.tolist())
except Exception as e:
    print(f"Intraday error: {e}")
