from vnstock import Vnstock
import pandas as pd

vst = Vnstock()
ticker = 'FPT'
print(f"--- Debugging {ticker} with vnstock v3 ---")

try:
    # Thử lấy stock object
    s = vst.stock(symbol=ticker, source='kbs')
    print("Source: KBS")
    
    print("\n1. Testing price.history()...")
    df_h = s.price.history(start='2024-01-01', resolution='1D')
    if df_h is not None:
        print(f"History shape: {df_h.shape}")
        print("History columns:", df_h.columns.tolist())
        print("First 2 rows:")
        print(df_h.head(2))
    else:
        print("History returned None")

    print("\n2. Testing price.quote()...")
    df_q = s.price.quote()
    if df_q is not None:
        print(f"Quote shape: {df_q.shape}")
        print("Quote columns:", df_q.columns.tolist())
        print("Quote data:")
        print(df_q)
    else:
        print("Quote returned None")

except Exception as e:
    print(f"Error with VCI: {e}")
    
    # Thử source khác nếu VCI lỗi
    try:
        print("\n--- Trying TCBS source ---")
        s2 = vst.stock(symbol=ticker, source='tcbs')
        df_h2 = s2.price.history(start='2024-01-01', resolution='1D')
        if df_h2 is not None:
            print(f"TCBS History shape: {df_h2.shape}")
            print("TCBS History columns:", df_h2.columns.tolist())
            print(df_h2.head(2))
    except Exception as e2:
        print(f"Error with TCBS: {e2}")
