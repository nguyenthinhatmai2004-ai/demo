from vnstock import Vnstock
import pandas as pd

vst = Vnstock()

print("--- Stock object attributes ---")
print([attr for attr in dir(vst.stock) if not attr.startswith('_')])

print("\n--- Testing Stock Finance Ratio ---")
try:
    ratios = vst.stock.finance.ratio(symbol='FPT', report_range='yearly', is_pro=False)
    print("Ratios Columns:", ratios.columns.tolist())
    print(ratios.head(2))
except Exception as e:
    print(f"Stock finance ratio error: {e}")

print("\n--- Testing FX (Exchange Rate) ---")
try:
    # Most likely for USD/VND
    fx_data = vst.fx.quote(symbol='USDVND') # Guessing
    print("FX Data:")
    print(fx_data)
except Exception as e:
    print(f"FX error: {e}")
    try:
        print("FX attributes:", [attr for attr in dir(vst.fx) if not attr.startswith('_')])
    except: pass
