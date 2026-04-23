from vnstock import Vnstock
import pandas as pd

vst = Vnstock()
tickers = ['FPT', 'SSI', 'HPG']
sources = ['VCI', 'TCBS', 'SSI', 'KBS']

for ticker in tickers:
    print(f"\n=== Testing {ticker} ===")
    for source in sources:
        try:
            print(f"  Source: {source}")
            s = vst.stock(symbol=ticker, source=source)
            
            # Test quote
            df_q = s.quote.history(length=1)
            if df_q is not None and not df_q.empty:
                print(f"    [OK] Quote: {df_q.iloc[0]['close']}")
            else:
                print(f"    [FAIL] Quote: None/Empty")
                
            # Test finance ratio
            df_r = s.finance.ratio(report_range='yearly', is_pro=False)
            if df_r is not None and not df_r.empty:
                print(f"    [OK] Ratio: Found {len(df_r)} periods")
                print(f"    Columns: {df_r.columns.tolist()[:5]}")
            else:
                print(f"    [FAIL] Ratio: None/Empty")
                
        except Exception as e:
            print(f"    [ERROR] {source}: {str(e)[:100]}")
