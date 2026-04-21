from vnstock import Finance
import pandas as pd

ticker = 'FPT'
try:
    f = Finance(symbol=ticker, source='vci', show_log=False)
    ratios = f.ratio(length=4)
    print("Ratios Type:", type(ratios))
    if isinstance(ratios, pd.DataFrame):
        print("Columns:", ratios.columns.tolist())
        print(ratios.head())
    else:
        print("Ratios Data:", ratios)
except Exception as e:
    print(f"Finance ratio error: {e}")
