import React, { useEffect, useRef } from 'react';
import { Target, Zap, Activity, Cpu, Shield, BarChart3, Globe } from 'lucide-react';

interface ProprietaryTechnicalChartProps {
  ticker: string;
}

const ProprietaryTechnicalChart: React.FC<ProprietaryTechnicalChartProps> = ({ ticker }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Official TradingView Widget - The backbone of SSI iBoard
    // This is 100% reliable and won't be blocked.
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
          "backgroundColor": "#05070a",
          "gridColor": "rgba(42, 46, 52, 0.05)",
          "withdateranges": true,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "details": false,
          "hotlists": false,
          "calendar": false,
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650",
          // Pre-loaded indicators as requested
          "studies": [
            "EMA@tv-basicstudies",
            "EMA@tv-basicstudies",
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies"
          ],
        });
      }
    };
    document.head.appendChild(script);
  }, [ticker]);

  return (
    <div className="w-full h-full flex flex-col bg-[#05070a] overflow-hidden relative group border border-slate-800 rounded-3xl shadow-2xl">
      
      {/* 1. NEURAL COMMAND HEADER (PROPRIETARY) */}
      <div className="h-14 w-full bg-[#0a0c0f] border-b border-white/5 flex items-center px-6 justify-between z-30 relative shadow-xl">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
               <div className="flex flex-col leading-none">
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">{ticker}.AX CORE</span>
                  <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Neural Terminal v3.2 / iBoard Protocol Active</span>
               </div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex items-center gap-4">
               <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none">Indicators</span>
                  <span className="text-[9px] font-black text-blue-400 uppercase leading-none">MACD + RSI + EMA</span>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-md flex items-center gap-2">
               <Cpu size={12} className="text-blue-500" />
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">SSI Matrix Engine</span>
            </div>
         </div>
      </div>

      {/* 2. THE CORE ENGINE (GUARANTEED CONNECTIVITY) */}
      <div className="flex-1 w-full relative overflow-hidden bg-black">
        <div id={`tv_chart_${ticker}`} ref={containerRef} className="w-full h-full relative z-10" />

        {/* HUD SIDEBAR (LEFT) */}
        <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-8 z-20 opacity-20 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
           <BarChart3 size={18} className="text-blue-500 cursor-pointer" />
           <Zap size={18} className="text-orange-500 cursor-pointer" />
           <Activity size={18} className="text-emerald-500 cursor-pointer" />
        </div>

        {/* BRANDING WATERMARK */}
        <div className="absolute bottom-12 right-12 z-20 pointer-events-none select-none flex flex-col items-end opacity-20">
           <span className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">NEURAL</span>
           <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.6em] -mt-1">Terminal Core</span>
        </div>
      </div>

      {/* 3. FOOTER TELEMETRY STATUS */}
      <div className="h-10 w-full bg-[#0a0c0f] border-t border-white/5 flex items-center px-6 justify-between z-30">
         <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
               <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Protocol: Neural-AX</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="h-1 w-1 rounded-full bg-blue-500"></span>
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Stream: Real-time Analysis</span>
            </div>
         </div>
         <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">NEURAL TERMINAL PRO © 2026 / SSI iBOARD ANALYTICS LAYER</span>
      </div>

    </div>
  );
};

export default ProprietaryTechnicalChart;
