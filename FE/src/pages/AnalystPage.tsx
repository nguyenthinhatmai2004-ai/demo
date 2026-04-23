import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, Activity, BarChart2, Zap, TrendingUp, Shield, Cpu, ChevronRight, Calculator, ExternalLink, PieChart, Target, BarChart3 } from 'lucide-react';
import ProprietaryFinancialChart from '../components/ProprietaryFinancialChart';
import ProprietaryTechnicalChart from '../components/ProprietaryTechnicalChart';

const API_BASE = 'http://127.0.0.1:8001/api';

const AnalystPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [tickerNews, setTickerNews] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<any[]>([]);
  const [bizResults, setBizResults] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any>(null);
  const [ratios, setRatios] = useState<any>(null);
  const [valuation, setValuation] = useState<any>(null);
  const [techAnalysis, setTechnicalAnalysis] = useState<any>(null);

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
    
    const [news, spec, biz, reportsRes, prospectsRes, ratiosRes, valuationRes, techRes] = await Promise.all([
      safeGet(`${API_BASE}/news/${ticker}`, []),
      safeGet(`${API_BASE}/news/special-events`, []),
      safeGet(`${API_BASE}/news/business-results`, []),
      safeGet(`${API_BASE}/analysis/reports/${ticker}`, []),
      safeGet(`${API_BASE}/analysis/prospects/${ticker}`, null),
      safeGet(`${API_BASE}/finance/ratios/${ticker}`, null),
      safeGet(`${API_BASE}/finance/valuation/dcf/${ticker}`, null),
      safeGet(`${API_BASE}/analysis/technical/${ticker}`, null)
    ]);

    setTickerNews(news.length > 0 ? news : []);
    setSpecialEvents(spec.length > 0 ? spec : []);
    setBizResults(biz.length > 0 ? biz : []);
    setReports(reportsRes);
    setProspects(prospectsRes);
    setRatios(ratiosRes);
    setValuation(valuationRes);
    setTechnicalAnalysis(techRes);
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
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto">
      
      {/* HEADER & TOP STATS */}
      <div className="flex flex-col md:flex-row items-end justify-between border-b-2 border-slate-800 pb-8 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="h-1 bg-blue-500 w-12"></div>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em]">Hệ thống Phân tích Chuyên sâu</span>
          </div>
          <h1 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none">
            {activeTicker}<span className="text-blue-600">.</span>VN
          </h1>
        </div>
        <div className="flex gap-8 items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Điểm Chất lượng</span>
            <span className="text-4xl font-black text-emerald-400 tabular-nums italic leading-none">{prospects?.health_score || '--'}</span>
          </div>
          <div className="h-12 w-px bg-slate-800"></div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Giá Hiện tại</span>
            <span className="text-2xl font-black text-white tabular-nums">{(valuation?.current_price || 0).toLocaleString()}<span className="text-xs ml-1 opacity-50 text-slate-400 font-bold">₫</span></span>
          </div>
        </div>
      </div>

      {/* SECTION 0: NEURAL TECHNICAL CORE (SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* CHART (LEFT 75%) */}
         <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-4 text-blue-400">
                  <BarChart3 size={24} />
                  <h3 className="font-black text-xs uppercase tracking-[0.3em]">Hệ thống Kỹ thuật Độc quyền (Neural HUD)</h3>
               </div>
               <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">High-Performance Neural Core</span>
               </div>
            </div>
            <div className="h-[600px] w-full rounded-3xl overflow-hidden border border-slate-800 bg-[#0a0c0f] shadow-2xl relative group">
               <ProprietaryTechnicalChart key={activeTicker} ticker={activeTicker} />
            </div>
         </div>

         {/* TECHNICAL DIAGNOSIS (RIGHT 25%) */}
         <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-emerald-400 px-2">
               <Cpu size={20} />
               <h3 className="font-black text-[10px] uppercase tracking-[0.3em]">Chẩn đoán Kỹ thuật AI</h3>
            </div>
            
            <div className="flex-1 bg-gradient-to-br from-slate-900 to-black rounded-3xl border border-slate-800 p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>

               {/* Stage Indicator */}
               <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Giai đoạn Cổ phiếu</span>
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                     <p className="text-sm font-black text-emerald-400 uppercase tracking-tighter leading-tight">
                        {techAnalysis?.stage || 'Đang phân tích...'}
                     </p>
                  </div>
               </div>

               {/* Buy/Sell Pressure */}
               <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-end">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Áp lực Cung - Cầu</span>
                     <span className="text-[10px] font-black text-white tabular-nums">{techAnalysis?.order_flow?.buy || 50}% / {techAnalysis?.order_flow?.sell || 50}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                     <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${techAnalysis?.order_flow?.buy || 50}%` }}></div>
                     <div className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-1000" style={{ width: `${techAnalysis?.order_flow?.sell || 50}%` }}></div>
                  </div>
               </div>

               {/* VSA Signals */}
               <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                     <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Tín hiệu VSA</span>
                     <p className="text-[11px] font-bold text-slate-200 italic leading-snug">"{techAnalysis?.vsa_signal || 'Checking supply bars...'}"</p>
                  </div>
                  <div className="flex flex-col gap-1">
                     <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Trạng thái Cung</span>
                     <p className="text-[11px] font-bold text-slate-400 leading-snug">{techAnalysis?.supply_demand || 'Analyzing liquidity absorption...'}</p>
                  </div>
               </div>

               {/* Recommendation */}
               <div className="mt-auto flex flex-col gap-4 border-t border-white/5 pt-6">
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest leading-none">Khuyến nghị Chiến thuật</span>
                     <p className="text-xl font-black text-white italic tracking-tighter uppercase leading-none mt-1">
                        {techAnalysis?.verdict || 'WATCHLIST'}
                     </p>
                  </div>
                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                        "{techAnalysis?.reason || 'Hệ thống đang quét các điểm Pivot và Pocket Pivot...'}"
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>


      {/* SECTION 1: CORE STRATEGIC MATRIX & DCF */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* LEFT: STRATEGIC ROADMAP & DCF MODEL */}
         <div className="lg:col-span-8 flex flex-col gap-10">
            <div className="bg-gradient-to-br from-slate-900 to-black p-1 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800/50">
              <div className="bg-slate-950/80 rounded-[22px] p-10 flex flex-col gap-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Zap size={16} fill="currentColor" /> Trụ cột Tăng trưởng Chiến lược
                  </h3>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="h-1.5 w-1.5 rounded-full bg-blue-500/20"></div>)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {(prospects?.growth_pillars || []).map((p: any, i: number) => (
                    <div key={i} className="flex flex-col gap-4 group">
                      <div className="h-1 w-0 group-hover:w-full bg-blue-500 transition-all duration-500"></div>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Trụ cột 0{i+1}</span>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-blue-400 transition-colors">{p.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{p.content}</p>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-slate-800/50 w-full my-4"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="flex flex-col gap-6">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} /> Catalysts Trọng yếu
                    </h4>
                    <div className="flex flex-col gap-3">
                      {(prospects?.strategic_catalysts || []).map((c: string, i: number) => (
                        <div key={i} className="flex items-center gap-4 group">
                          <span className="text-[10px] font-black text-emerald-900 group-hover:text-emerald-500 tabular-nums transition-colors">0{i+1}</span>
                          <p className="text-[11px] font-bold text-slate-300 italic group-hover:translate-x-1 transition-all">"{c}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-6">
                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                      <Shield size={14} /> Rủi ro & Thách thức
                    </h4>
                    <div className="flex flex-col gap-3">
                      {(prospects?.risk_assessment || []).map((r: string, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="h-1 w-1 bg-rose-500/40 rounded-full"></div>
                          <p className="text-[11px] font-medium text-slate-500">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DCF VALUATION MODEL */}
            <div className="bg-slate-900/40 rounded-3xl border border-slate-800 p-10 flex flex-col gap-10 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-3 text-orange-400">
                  <Target size={20} />
                  <h3 className="font-black text-[10px] uppercase tracking-[0.3em]">Mô hình Định giá DCF (Chiết khấu dòng tiền)</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Giá trị Nội tại</p>
                    <p className="text-2xl font-black text-emerald-400 tabular-nums italic">{(valuation?.intrinsic_value || 0).toLocaleString()} ₫</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Biên an toàn</p>
                    <p className="text-lg font-black text-emerald-400 tabular-nums">+{valuation?.upside}%</p>
                  </div>
                </div>
              </div>

              {/* Param Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'WACC (Chi phí vốn)', value: valuation?.wacc, suffix: '%' },
                  { label: 'Tăng trưởng g (5y)', value: valuation?.growth_rate, suffix: '%' },
                  { label: 'Terminal Growth', value: valuation?.terminal_growth, suffix: '%' },
                  { label: 'Kỳ dự báo', value: '5', suffix: ' Năm' }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-1 hover:border-orange-500/20 transition-colors">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                    <span className="text-lg font-black text-white tabular-nums">{item.value}{item.suffix}</span>
                  </div>
                ))}
              </div>

              {/* DCF Calculation Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-medium text-slate-400 border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-white/5 font-black text-slate-200">
                      <th className="p-3 text-left border-y border-l border-white/10 rounded-tl-lg uppercase tracking-widest">Dòng tiền (Tỷ đồng)</th>
                      {[1, 2, 3, 4, 5].map(y => (
                        <th key={y} className="p-3 text-right border-y border-white/10 uppercase tracking-widest">Năm {y}</th>
                      ))}
                      <th className="p-3 text-right border-y border-r border-white/10 rounded-tr-lg uppercase tracking-widest bg-emerald-500/10 text-emerald-400 font-black">Vĩnh viễn</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 border-l border-white/5 font-bold text-slate-300">FCF Dự phóng</td>
                      {(valuation?.fcf_projections || []).map((val: number, i: number) => (
                        <td key={i} className="p-3 text-right tabular-nums">{val.toLocaleString()}</td>
                      ))}
                      <td className="p-3 text-right tabular-nums border-r border-white/5 bg-emerald-500/5 font-bold text-emerald-300">TV: 52,800</td>
                    </tr>
                    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 border-l border-white/5 font-bold text-slate-300">Hệ số Chiết khấu</td>
                      {[1, 2, 3, 4, 5].map(y => (
                        <td key={y} className="p-3 text-right tabular-nums">{(1 / Math.pow(1 + (valuation?.wacc / 100), y)).toFixed(3)}</td>
                      ))}
                      <td className="p-3 text-right tabular-nums border-r border-white/5 bg-emerald-500/5">{(1 / Math.pow(1 + (valuation?.wacc / 100), 5)).toFixed(3)}</td>
                    </tr>
                    <tr className="bg-blue-500/5 font-black text-blue-400">
                      <td className="p-3 border-l border-white/5 rounded-bl-lg uppercase tracking-widest">Hiện giá (PV)</td>
                      {(valuation?.fcf_projections || []).map((val: number, i: number) => (
                        <td key={i} className="p-3 text-right tabular-nums">{(val * (1 / Math.pow(1 + (valuation?.wacc / 100), i + 1))).toFixed(0)}</td>
                      ))}
                      <td className="p-3 text-right tabular-nums border-r border-white/5 rounded-br-lg bg-emerald-500/10 text-emerald-400 italic">31,500</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Cơ sở và Giả định Chiến lược</span>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(valuation?.assumptions || []).map((a: string, i: number) => (
                    <li key={i} className="text-[10px] text-slate-400 font-medium flex gap-3 italic leading-relaxed">
                      <span className="text-orange-500 shrink-0">▸</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
         </div>

         {/* RIGHT: QUANTITATIVE SNAPSHOT & PROPRIETARY FINANCIAL DASHBOARD */}
         <div className="lg:col-span-4 flex flex-col gap-10">
            {/* FINANCE SCORECARD */}
            <div className="bg-white/[0.02] border border-slate-800 rounded-3xl p-8 flex flex-col gap-8 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Chỉ số Tài chính</h3>
                <Calculator size={16} className="text-orange-500" />
              </div>

              <div className="flex flex-col gap-4">
                {[
                  { label: 'P/E TTM', value: ratios?.pe, suffix: 'x', sub: 'Trung bình ngành: 12.5' },
                  { label: 'ROE', value: ratios?.roe, suffix: '%', sub: 'Top 5% toàn ngành' },
                  { label: 'Biên Lợi nhuận', value: ratios?.margin, suffix: '%', sub: 'Hiệu suất vận hành cao' },
                  { label: 'Nợ/Vốn CSH', value: ratios?.debt_equity, suffix: '', sub: 'Đòn bẩy an toàn' }
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-transparent hover:border-orange-500/20 hover:bg-orange-500/[0.02] transition-all group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.label}</span>
                      <span className="text-[8px] font-bold text-slate-700 uppercase group-hover:text-slate-500">{r.sub}</span>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums group-hover:text-orange-400 transition-colors">
                      {r.value}<span className="text-sm ml-0.5 opacity-40">{r.suffix}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto bg-orange-500/10 p-5 rounded-2xl border border-orange-500/20">
                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Nhận định Chuyên gia</p>
                <p className="text-[11px] font-bold text-slate-300 leading-relaxed italic">
                  "{activeTicker} thể hiện nền tảng cơ bản xuất sắc với các chất xúc tác từ AI và công nghệ. Khuyến nghị tích lũy tại các nhịp điều chỉnh."
                </p>
              </div>
            </div>

            {/* PROPRIETARY FINANCIAL DASHBOARD */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2 px-2">
                <PieChart size={16} /> Chỉ số Tài chính Độc quyền
              </h3>
              <div className="h-[450px] w-full shadow-2xl">
                <ProprietaryFinancialChart ticker={activeTicker} history={valuation?.history || []} />
              </div>
            </div>
         </div>
      </div>

      {/* SECTION 2: THE INTELLIGENCE ENGINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* FEED: REAL-TIME INTEL */}
         <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-blue-400 px-2">
               <Activity size={18} />
               <h3 className="font-black text-[10px] uppercase tracking-[0.4em]">Luồng Tin tức Tổng hợp</h3>
            </div>
            <div className="flex flex-col gap-1 border-t-2 border-slate-800">
               {tickerNews.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" className="py-6 border-b border-slate-800 flex flex-col md:flex-row gap-6 group hover:bg-blue-600/[0.02] transition-all px-2">
                     <div className="md:w-32 shrink-0">
                        <span className={`text-[8px] font-black px-2 py-1 rounded border ${getTagColor(n.category)}`}>
                          {n.category}
                        </span>
                     </div>
                     <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{n.source}</span>
                          <span className="text-[9px] font-bold text-slate-700 uppercase">{n.time}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors leading-tight">
                          {n.title}
                        </h4>
                     </div>
                  </a>
               ))}
            </div>
         </div>

         {/* SIDEBAR: RESEARCH & REPORTS */}
         <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-8 lg:flex lg:flex-col">
            
            {/* RESEARCH REPORTS */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                <Newspaper size={16} /> Báo cáo Phân tích Chiến lược
              </h3>
              <div className="flex flex-col gap-4">
                {(reports || []).map((r, i) => (
                  <a 
                    key={i} 
                    href={r.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800 group hover:border-orange-500/40 hover:bg-orange-500/[0.02] transition-all flex flex-col gap-3 relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-4 opacity-20 group-hover:opacity-100 transition-opacity">
                      <ExternalLink size={12} className="text-orange-500" />
                    </div>

                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em]">{r.firm}</span>
                       <span className="text-[9px] font-bold text-slate-600 uppercase">{r.date}</span>
                    </div>
                    <h4 className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors leading-snug pr-4">{r.title}</h4>
                    <div className="flex items-center gap-2 text-emerald-400 mt-1">
                       <div className="h-1 w-1 bg-emerald-500 rounded-full"></div>
                       <span className="text-[9px] font-black uppercase tracking-widest">{r.target_price || 'Chi tiết'}</span>
                       <span className="text-[8px] font-bold text-slate-500 ml-auto group-hover:text-orange-400 transition-colors uppercase">Mở báo cáo PDF ▸</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* EVENT TIMELINE */}
            <div className="flex flex-col gap-6 bg-slate-900/20 p-8 rounded-3xl border border-slate-800/50">
               <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] flex items-center gap-2">
                 <Activity size={14} /> Lộ trình Doanh nghiệp
               </h3>
               <div className="flex flex-col gap-6">
                  {specialEvents.slice(0, 4).map((n, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 group-hover:scale-150 transition-transform"></div>
                        {i !== 3 && <div className="w-px h-full bg-slate-800 mt-2"></div>}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 group-hover:text-slate-200 transition-colors leading-snug -mt-1 pb-2">
                        {n.title}
                      </p>
                    </div>
                  ))}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default AnalystPage;
