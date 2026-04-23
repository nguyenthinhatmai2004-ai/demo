import React, { useState } from 'react';
import { Target, Zap, Activity, Shield, Cpu, ChevronDown, Maximize2, Settings } from 'lucide-react';

interface ProprietaryTechnicalChartProps {
  ticker: string;
}

const ProprietaryTechnicalChart: React.FC<ProprietaryTechnicalChartProps> = ({ ticker }) => {
  const [activeSignal, setActiveSignal] = useState('STRONG BUY');
  
  // FireAnt engine as the core data provider
  const engineUrl = `https://fireant.vn/charts?symbol=${ticker.toUpperCase()}`;

  return (
    <div className="w-full h-full flex flex-col bg-[#05070a] overflow-hidden relative border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      
      {/* 1. PROPRIETARY CONTROL BAR (LEFT) */}
      <div className="absolute top-0 left-0 h-full w-12 bg-[#0a0c0f] border-r border-slate-800 z-30 flex flex-col items-center py-6 gap-6">
         <div className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg cursor-pointer transition-all"><Target size={20} /></div>
         <div className="p-2 text-slate-600 hover:text-emerald-500 rounded-lg cursor-pointer"><Activity size={20} /></div>
         <div className="p-2 text-slate-600 hover:text-orange-500 rounded-lg cursor-pointer"><Zap size={20} /></div>
         <div className="p-2 text-slate-600 hover:text-white rounded-lg cursor-pointer"><Settings size={20} /></div>
         <div className="mt-auto p-2 text-slate-600 hover:text-white rounded-lg cursor-pointer"><Maximize2 size={18} /></div>
      </div>

      {/* 2. ELITE TOP DASHBOARD */}
      <div className="h-16 w-full bg-[#0a0c0f] border-b border-slate-800 flex items-center pl-16 pr-6 justify-between z-20">
         <div className="flex items-center gap-6">
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white italic tracking-tighter">{ticker}.AX</span>
                  <div className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                     <span className="text-[8px] font-black text-emerald-500">LIVE</span>
                  </div>
               </div>
               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Neural Execution Layer 3.1</span>
            </div>
            
            <div className="h-8 w-px bg-slate-800 mx-2"></div>
            
            <div className="flex gap-10">
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">AI Verdict</span>
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-tight">{activeSignal}</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Risk Level</span>
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-tight">Medium - Low</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Alpha score</span>
                  <span className="text-[11px] font-black text-orange-400 tabular-nums uppercase tracking-tight">84.2</span>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <button className="px-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-black text-white uppercase tracking-widest hover:border-blue-500/50 transition-all flex items-center gap-2">
               Indicators <ChevronDown size={12} />
            </button>
            <button className="px-6 py-1.5 bg-blue-600 rounded-lg text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
               Place Order
            </button>
         </div>
      </div>

      {/* 3. THE CORE ENGINE WRAPPER (MASKED FIREANT) */}
      <div className="flex-1 w-full relative pl-12">
        <div className="absolute inset-0 z-10 pointer-events-none border-[10px] border-[#0a0c0f]"></div> {/* Masking border */}
        
        <iframe 
          src={engineUrl}
          className="w-full h-[105%] border-none -mt-4" // Shifted to hide external top toolbar
          title={`Neural Terminal Core - ${ticker}`}
          allowFullScreen
          style={{ 
             filter: 'contrast(1.05) brightness(0.95) saturate(1.1) hue-rotate(5deg)',
          }}
        />
        
        {/* INTERACTIVE BRANDING OVERLAYS */}
        <div className="absolute top-10 right-10 pointer-events-none z-20 flex flex-col items-end opacity-20 group-hover:opacity-100 transition-all duration-1000">
           <span className="text-[40px] font-black text-white italic tracking-tighter leading-none">NEURAL</span>
           <span className="text-[12px] font-black text-blue-500 uppercase tracking-[0.6em] -mt-1">Terminal</span>
        </div>

        {/* SCANLINES & MATRIX EFFECT */}
        <div className="absolute inset-0 pointer-events-none z-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        <div className="absolute inset-0 pointer-events-none z-20 bg-gradient-to-r from-blue-500/5 to-transparent w-1"></div>
      </div>

      {/* 4. FOOTER STATUS TELEMETRY */}
      <div className="h-8 w-full bg-[#0a0c0f] border-t border-slate-800 flex items-center px-16 justify-between z-30">
         <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2">
               <Cpu size={12} className="text-blue-500" />
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Core Engine: Syncing...</span>
            </div>
            <div className="flex items-center gap-2">
               <Shield size={12} className="text-emerald-500" />
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Encryption: AES-256</span>
            </div>
         </div>
         <div className="flex gap-4">
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Protocol AX-900</span>
            <span className="text-[8px] font-black text-blue-900 uppercase tracking-widest">Neural Terminal Pro © 2026</span>
         </div>
      </div>

    </div>
  );
};

export default ProprietaryTechnicalChart;
