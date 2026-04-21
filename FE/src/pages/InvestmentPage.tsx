import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, Globe, BarChart3, ChevronUp, ChevronDown, Activity, Shield, TrendingUp, Zap, Briefcase } from 'lucide-react';
import EquityMatrixChart from '../components/EquityMatrixChart';

const API_BASE = 'http://localhost:8001/api';

const InvestmentPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [strategy, setStrategy] = useState<any>(null);
  const [macro, setMacro] = useState<any>(null);
  const [accountData, setAccountData] = useState<any>(null);

  const fetchData = async () => {
    const safeGet = async (url: string, fallback: any) => {
      try {
        const res = await axios.get(url);
        return res.data;
      } catch (e) {
        console.error(`Failed to fetch ${url}`, e);
        return fallback;
      }
    };

    const ticker = activeTicker.toUpperCase();
    const [strat, macroRes, accountRes] = await Promise.all([
      safeGet(`${API_BASE}/investment/strategy`, null),
      safeGet(`${API_BASE}/analysis/macro`, null),
      safeGet(`${API_BASE}/account/positions`, null)
    ]);
    setStrategy(strat);
    setMacro(macroRes);
    setAccountData(accountRes);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTicker]);

  return (
    <div className="flex flex-col gap-10">
      
      {/* MACRO RADAR & CYCLE MAP */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {macro && (
           <div className="xl:col-span-1 terminal-card p-8 flex flex-col gap-6 bg-gradient-to-br from-slate-900 to-black">
              <div className="flex items-center gap-3 text-blue-400">
                 <Globe size={20} />
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Market Pulse</h3>
              </div>
              <div className={`p-6 rounded-2xl border-2 flex flex-col gap-2 ${macro.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                 <p className="text-[9px] font-black uppercase opacity-60">Cycle Phase</p>
                 <p className="text-sm font-black uppercase leading-tight">{macro.current_case || macro.phase}</p>
              </div>
              <div className="flex flex-col gap-4 mt-2">
                 <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Intermarket Watch</h4>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">DXY Index</span>
                    <span className="text-xs font-black text-white tabular-nums">{macro.indicators?.dxy_index?.value || '104.2'}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">US 10Y Yield</span>
                    <span className="text-xs font-black text-white tabular-nums">{macro.indicators?.us_10y_yield?.value || '4.25'}%</span>
                 </div>
              </div>
              <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed mt-auto border-t border-white/5 pt-4">"{macro.strategy}"</p>
           </div>
        )}

        <div className="xl:col-span-3 terminal-card p-8 flex flex-col gap-6">
           <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 text-emerald-400">
                 <Target size={20} />
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">CANSLIM & SEPA Selector</h3>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-500/20">Active Discovery Mode</span>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                 <thead>
                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                       <th className="px-4">Ticker</th>
                       <th className="px-4">CANSLIM Score</th>
                       <th className="px-4">Technical Setup</th>
                       <th className="px-4">Verdict</th>
                       <th className="px-4 text-right">Potential</th>
                    </tr>
                 </thead>
                 <tbody>
                    {(strategy?.focus_list || []).map((s: any, i: number) => (
                       <tr key={i} className="group cursor-pointer">
                          <td className="px-4 py-4 bg-slate-900/50 rounded-l-xl border-y border-l border-slate-800 group-hover:border-blue-500/30 transition-colors">
                             <span className="text-sm font-black text-white italic tabular-nums">{s.ticker}</span>
                          </td>
                          <td className="px-4 py-4 bg-slate-900/50 border-y border-slate-800 group-hover:border-blue-500/30 transition-colors">
                             <div className="flex items-center gap-3">
                                <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                                   <div className="h-full bg-blue-500" style={{ width: `${s.canslim_score}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-blue-400">{s.canslim_score}</span>
                             </div>
                          </td>
                          <td className="px-4 py-4 bg-slate-900/50 border-y border-slate-800 group-hover:border-blue-500/30 transition-colors">
                             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{s.setup}</span>
                          </td>
                          <td className="px-4 py-4 bg-slate-900/50 border-y border-slate-800 group-hover:border-blue-500/30 transition-colors">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${s.sepa_verdict?.includes('BUY') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{s.sepa_verdict}</span>
                          </td>
                          <td className="px-4 py-4 bg-slate-900/50 rounded-r-xl border-y border-r border-slate-800 group-hover:border-blue-500/30 transition-colors text-right">
                             <span className="text-xs font-black text-emerald-400">{s.potential}</span>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* TECHNICAL ANALYSIS HUB */}
      <section className="terminal-card p-10 flex flex-col gap-8">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-blue-400">
               <BarChart3 size={24} />
               <h3 className="font-black text-xs uppercase tracking-[0.3em]">TradingView Pro: {activeTicker}</h3>
            </div>
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Advanced Technical Engine</span>
            </div>
         </div>
         <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-black">
            <TradingViewWidget ticker={activeTicker} />
         </div>

      </section>

      {/* POSITIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <section className="bg-gray-900/30 rounded-3xl border border-gray-800 p-8 shadow-xl">
            <h3 className="font-bold text-sm uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
               <Briefcase size={18} /> Danh Mục Hiện Tại
            </h3>
            <div className="flex flex-col gap-4">
               {accountData?.positions ? Object.entries(accountData.positions).map(([t, q]: any) => (
                  <div key={t} className="p-4 bg-black/20 rounded-xl border border-gray-800 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center font-bold text-blue-400">{t}</div>
                        <p className="text-sm font-bold text-white tabular-nums">{q.toLocaleString()} CP</p>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-emerald-400">+5.2%</p>
                        <span className="text-[8px] font-black text-slate-600 uppercase">PnL</span>
                     </div>
                  </div>
               )) : <p className="text-slate-600 italic text-xs">No active positions.</p>}
            </div>
         </section>
      </div>

    </div>
  );
};

export default InvestmentPage;
e;
