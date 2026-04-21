import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  ticker: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ ticker }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // TradingView uses EXCHANGE:TICKER format
    // For simplicity, we assume HOSE for 3-letter tickers, but it can be adjusted
    const symbol = ticker.includes(':') ? ticker : `HOSE:${ticker}`;

    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol,
      "interval": "D",
      "timezone": "Asia/Ho_Chi_Minh",
      "theme": "dark",
      "style": "1",
      "locale": "vi_VN",
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com"
    });

    containerRef.current.appendChild(script);
  }, [ticker]);

  return (
    <div className="w-full h-full flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">TradingView Official Engine</span>
        </div>
      </div>
      <div className="flex-1" ref={containerRef}>
        <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
          <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }}></div>
        </div>
      </div>
    </div>
  );
};

export default TradingViewWidget;
