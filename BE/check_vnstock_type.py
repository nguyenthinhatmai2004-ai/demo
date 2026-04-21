from vnstock import Vnstock
vst = Vnstock()
for ticker in ['FPT', 'SSI', 'VCB']:
    print(f"\n--- Testing {ticker} ---")
    try:
        s = vst.stock(symbol=ticker, source='kbs')
        ratios = s.finance.ratio()
        print(f"Ratios for {ticker} with kbs (first row):")
        print(ratios.iloc[0].to_dict())
        break
    except Exception as e:
        print(f"Error for {ticker} with kbs: {e}")
