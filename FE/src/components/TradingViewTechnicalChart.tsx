import React, { useEffect, useRef } from 'react';

interface TradingViewTechnicalChartProps {
  ticker: string;
}

const TradingViewTechnicalChart: React.FC<TradingViewTechnicalChartProps> = ({ ticker }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": `HOSE:${ticker.toUpperCase()}`,
          "interval": "D",
          "timezone": "Asia/Ho_Chi_Minh",
          "theme": "dark",
          "style": "1",
          "locale": "vi_VN",
          "toolbar_bg": "#0a0c0f",
          "enable_publishing": false,
          "hide_top_toolbar": false,
          "hide_legend": false,
          "save_image": false,
          "container_id": containerRef.current.id,
          "backgroundColor": "#0a0c0f",
          "gridColor": "rgba(42, 46, 52, 0.06)",
          "withdateranges": true,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "details": false,
          "hotlists": false,
          "calendar": false,
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650",
          "studies": [
            "EMA@tv-basicstudies",
            "EMA@tv-basicstudies",
            "RSI@tv-basicstudies"
          ],
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Clean up script tag if needed, though TradingView widget manages its own state
    };
  }, [ticker]);

  return (
    <div className="w-full h-full relative group">
      <div id={`tradingview_${ticker}`} ref={containerRef} className="w-full h-full" />
      
      {/* OVERLAY LABEL */}
      <div className="absolute top-12 left-4 pointer-events-none z-10 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">TradingView Real-Time Matrix</span>
        </div>
      </div>

      {/* CORE TERMINAL IDENTITY */}
      <div className="absolute bottom-10 right-4 pointer-events-none z-10 opacity-30 select-none">
         <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Institutional Engine v3.1</span>
      </div>
    </div>
  );
};

export default TradingViewTechnicalChart;
