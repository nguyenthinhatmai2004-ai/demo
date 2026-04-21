import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, Activity, BarChart2, Zap, TrendingUp, Shield, Cpu, ChevronRight, Calculator, ExternalLink } from 'lucide-react';

const API_BASE = 'http://localhost:8001/api';

const AnalystPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [tickerNews, setTickerNews] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<any[]>([]);
  const [bizResults, setBizResults] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any>(null);
  const [ratios, setRatios] = useState<any>(null);

  const fetchData = async () => {
    // Tách riêng các call để tránh 1 cái lỗi làm sập cả bảng
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
    
    // Chạy song song nhưng độc lập
    const [news, spec, biz, reportsRes, prospectsRes, ratiosRes] = await Promise.all([
      safeGet(`${API_BASE}/news/${ticker}`, []),
      safeGet(`${API_BASE}/news/special-events`, []),
      safeGet(`${API_BASE}/news/business-results`, []),
      safeGet(`${API_BASE}/analysis/reports/${ticker}`, []),
      safeGet(`${API_BASE}/analysis/prospects/${ticker}`, null),
      safeGet(`${API_BASE}/finance/ratios/${ticker}`, null)
    ]);

    setTickerNews(news);
    setSpecialEvents(spec);
    setBizResults(biz);
    setReports(reportsRes);
    setProspects(prospectsRes);
    setRatios(ratiosRes);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTicker]);

  const getTagColor = (category: string) => {
    switch (category) {
      case 'DIVESTMENT': return 'text-rose-400 border-rose-500/30 bg-rose-500/5';
      case 'DIVIDEND': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
      case 'EARNINGS': return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
      default: return 'text-slate-400 border-slate-700 bg-slate-800/50';
    }
  };

  return (
    <div className="flex flex-col gap-10">
      
      {/* SECTION 1: CORE INTELLIGENCE & RATIOS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         <div className="xl:col-span-2">
            {prospects && (
               <div className="terminal-card p-10 flex flex-col gap-10 bg-gradient-to-br from-slate-900/60 to-black">
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                     <div className="flex items-center gap-6">
                        <div className="h-16 w-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                           <Zap size={32} className="text-blue-400" />
                        </div>
                        <div>
                           <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">{activeTicker} Analysis Matrix</h2>
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Strategic Roadmap & Quality Score</p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Health Score</span>
                        <span className="text-4xl font-black text-emerald-400 italic tabular-nums">{prospects.health_score}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="flex flex-col gap-6">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><BarChart2 size={14} /> Growth Pillars</h4>
                        <div className="flex flex-col gap-4">
                           {(prospects.growth_pillars || []).map((p: any, i: number) => (
                              <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                 <p className="text-[11px] font-black text-slate-200 uppercase mb-1">{p.title}</p>
                                 <p className="text-[10px] text-slate-500 leading-relaxed">{p.content}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="flex flex-col gap-6">
                        <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={14} /> Catalysts</h4>
                        <div className="flex flex-col gap-4">
                           {(prospects.strategic_catalysts || []).map((c: string, i: number) => (
                              <div key={i} className="p-4 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl flex items-start gap-3 group">
                                 <ChevronRight size={14} className="text-emerald-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                                 <p className="text-[11px] font-bold text-slate-300 italic">"{c}"</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="flex flex-col gap-6">
                        <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><Shield size={14} /> Risks</h4>
                        <div className="flex flex-col gap-4">
                           {(prospects.risk_assessment || []).map((r: string, i: number) => (
                              <div key={i} className="p-4 bg-rose-500/[0.03] border border-rose-500/10 rounded-xl flex items-start gap-3">
                                 <div className="h-1.5 w-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0"></div>
                                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{r}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         <div className="terminal-card p-8 flex flex-col gap-8">
            <div className="flex items-center gap-3 text-orange-400">
               <Calculator size={20} />
               <h3 className="font-black text-xs uppercase tracking-widest">Finance Snapshot</h3>
            </div>
            {ratios ? (
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'P/E TTM', value: ratios.pe, suffix: 'x', desc: 'Price to Earnings' },
                    { label: 'P/B', value: ratios.pb, suffix: 'x', desc: 'Price to Book' },
                    { label: 'ROE', value: ratios.roe, suffix: '%', desc: 'Return on Equity' },
                    { label: 'Net Margin', value: ratios.margin, suffix: '%', desc: 'Profit Margin' },
                    { label: 'D/E', value: ratios.debt_equity, suffix: '', desc: 'Debt to Equity' }
                  ].map((r, i) => (
                    <div key={i} className="p-5 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-orange-500/30 transition-all">
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{r.label}</p>
                          <p className="text-[8px] text-slate-700 font-bold group-hover:text-slate-500">{r.desc}</p>
                       </div>
                       <div className="text-right">
                          <span className="text-xl font-black text-white tabular-nums">{r.value}{r.suffix}</span>
                       </div>
                    </div>
                  ))}
               </div>
            ) : <p className="text-slate-600 text-xs italic text-center p-10">Fetching financial data...</p>}
         </div>
      </div>

      {/* SECTION 2: INTELLIGENCE FEED */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
         <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-blue-400 px-2">
               <Activity size={18} />
               <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Universal Feed: {activeTicker}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
               {tickerNews.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" className="terminal-card p-5 hover:bg-white/[0.02] flex flex-col gap-3 group">
                     <div className="flex items-center justify-between">
                        <span className={`tag-badge ${getTagColor(n.category)}`}>{n.category}</span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">{n.source} • {n.time}</span>
                     </div>
                     <p className="text-[12px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{n.title}</p>
                  </a>
               ))}
            </div>
         </div>

         <div className="xl:col-span-1 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-orange-400 px-2">
               <Newspaper size={18} />
               <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Equity Research</h3>
            </div>
            <div className="flex flex-col gap-4">
               {reports.map((r, i) => (
                  <div key={i} className="terminal-card p-5 bg-black/40 flex flex-col gap-3 border-l-4 border-l-orange-500 group cursor-default">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{r.firm}</span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">{r.date}</span>
                     </div>
                     <h4 className="text-[11px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">{r.title}</h4>
                     <div className="flex items-center gap-2 text-emerald-400 mt-1">
                        <span className="text-[9px] font-black uppercase tracking-widest">Target: {r.target_price}</span>
                        <ExternalLink size={10} />
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="xl:col-span-1 flex flex-col gap-8">
            <div className="terminal-card p-6 flex flex-col gap-6">
               <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">Special Events</h4>
               <div className="flex flex-col gap-4">
                  {specialEvents.slice(0, 5).map((n, i) => (
                     <a key={i} href={n.link} target="_blank" className="flex flex-col gap-1 group">
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-100 transition-colors line-clamp-2 leading-relaxed">• {n.title}</p>
                     </a>
                  ))}
               </div>
            </div>
            <div className="terminal-card p-6 flex flex-col gap-6">
               <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">Corporate Earnings</h4>
               <div className="flex flex-col gap-4">
                  {bizResults.slice(0, 5).map((n, i) => (
                     <a key={i} href={n.link} target="_blank" className="flex flex-col gap-1 group">
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-100 transition-colors line-clamp-2 leading-relaxed">• {n.title}</p>
                     </a>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AnalystPage;
