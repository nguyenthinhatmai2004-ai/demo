import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  ticker: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ ticker }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef(`tv_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // TradingView VN symbols: HOSE:FPT, HNX:ACB, UPCOM:VGI
    let symbol = ticker.toUpperCase();
    if (!symbol.includes(':')) {
      symbol = `HOSE:${symbol}`;
    }

    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol,
      "interval": "D",
      "timezone": "Asia/Ho_Chi_Minh",
      "theme": "dark",
      "style": "1",
      "locale": "vi_VN",
      "toolbar_bg": "#f1f3f6",
      "enable_publishing": false,
      "allow_symbol_change": true,
      "save_image": false,
      "container_id": widgetId.current,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "calendar": false,
      "support_host": "https://www.tradingview.com"
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId.current;
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    
    containerRef.current.appendChild(widgetDiv);
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
      <div className="flex-1 overflow-hidden" ref={containerRef}>
      </div>
    </div>
  );
};

export default TradingViewWidget;
