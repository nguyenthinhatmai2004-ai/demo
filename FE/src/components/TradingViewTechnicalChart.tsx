import React, { useEffect, useRef } from 'react';
import { Maximize2, Zap, Shield, Cpu } from 'lucide-react';

interface TradingViewTechnicalChartProps {
  ticker: string;
}

const TradingViewTechnicalChart: React.FC<TradingViewTechnicalChartProps> = ({ ticker }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine the exchange prefix (HOSE is default for major stocks)
    // In a real app, this would come from a symbol mapping service
    const hnxStocks = ['SHS', 'PVS', 'CEO', 'IDC', 'MBS'];
    const upcomStocks = ['ACV', 'VGI', 'VEA', 'BSR'];
    
    let exchange = 'HOSE';
    if (hnxStocks.includes(ticker.toUpperCase())) exchange = 'HNX';
    else if (upcomStocks.includes(ticker.toUpperCase())) exchange = 'UPCOM';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": `${exchange}:${ticker.toUpperCase()}`,
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
          "backgroundColor": "#05070a",
          "gridColor": "rgba(42, 46, 52, 0.02)",
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
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies"
          ],
        });
      }
    };
    document.head.appendChild(script);
  }, [ticker]);

  return (
    <div className="w-full h-full flex flex-col bg-[#05070a] overflow-hidden relative group border border-slate-800/50 rounded-3xl">
      
      {/* EXCLUSIVE TOP BAR OVERLAY */}
      <div className="absolute top-0 left-0 w-full h-10 bg-gradient-to-b from-[#05070a] to-transparent z-10 pointer-events-none flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Neural Technical Core (TradingView)</span>
        </div>
        <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
           <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">Signal: Encrypted</span>
        </div>
      </div>

      {/* TRADINGVIEW ENGINE */}
      <div className="flex-1 w-full relative">
        <div id={`tv_chart_${ticker}`} ref={containerRef} className="w-full h-full" />
        
        {/* SIDE DECOR */}
        <div className="absolute top-1/2 left-1 transform -translate-y-1/2 flex flex-col gap-1 opacity-10 pointer-events-none">
          {[1,2,3,4].map(i => <div key={i} className="h-6 w-px bg-blue-400"></div>)}
        </div>
      </div>

      {/* FOOTER OVERLAY */}
      <div className="absolute bottom-2 left-6 z-10 pointer-events-none flex gap-6 opacity-40">
         <div className="flex items-center gap-2">
            <Cpu size={10} className="text-blue-500" />
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none">Global Data Stream</span>
         </div>
         <div className="flex items-center gap-2">
            <Shield size={10} className="text-emerald-500" />
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none">Security: Neural AX</span>
         </div>
      </div>

      {/* WATERMARK */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-[0.02] select-none">
         <span className="text-[100px] font-black text-white italic tracking-tighter uppercase">NEURAL</span>
      </div>

    </div>
  );
};

export default TradingViewTechnicalChart;
