import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Newspaper, Activity, BarChart2, Zap, TrendingUp, Shield, Cpu, 
  ChevronRight, Calculator, ExternalLink, PieChart, Target, 
  BarChart3, Award, AlertTriangle, Clock, ThumbsUp, Layers, 
  FileText, Briefcase, Globe, Info, Download, Copy, Plus
} from 'lucide-react';
import ProprietaryFinancialChart from '../components/ProprietaryFinancialChart';
import ProprietaryTechnicalChart from '../components/ProprietaryTechnicalChart';

const API_BASE = 'http://127.0.0.1:8001/api';

const AnalystPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [tickerNews, setTickerNews] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any>(null);
  const [ratios, setRatios] = useState<any>(null);
  const [valuation, setValuation] = useState<any>(null);
  const [techAnalysis, setTechnicalAnalysis] = useState<any>(null);
  const [realtimeQuote, setRealtimeQuote] = useState<any>(null);
  const [marketScanner, setMarketScanner] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState('overview');

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
    
    const [news, spec, reportsRes, prospectsRes, ratiosRes, valuationRes, techRes, quoteRes, scannerRes] = await Promise.all([
      safeGet(`${API_BASE}/news/${ticker}`, []),
      safeGet(`${API_BASE}/news/special-events`, []),
      safeGet(`${API_BASE}/analysis/reports/${ticker}`, []),
      safeGet(`${API_BASE}/analysis/prospects/${ticker}`, null),
      safeGet(`${API_BASE}/finance/ratios/${ticker}`, null),
      safeGet(`${API_BASE}/finance/valuation/dcf/${ticker}`, null),
      safeGet(`${API_BASE}/analysis/technical/${ticker}`, null),
      safeGet(`${API_BASE}/market/quote/${ticker}`, null),
      safeGet(`${API_BASE}/market/scanner`, [])
    ]);

    setTickerNews(news);
    setSpecialEvents(spec);
    setReports(reportsRes);
    setProspects(prospectsRes);
    setRatios(ratiosRes);
    setValuation(valuationRes);
    setTechnicalAnalysis(techRes);
    setRealtimeQuote(quoteRes);
    setMarketScanner(scannerRes);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTicker]);

  const sections = [
    { id: 'overview', label: 'Tổng quan', icon: Globe },
    { id: 'fundamental', label: 'Cơ bản', icon: Award },
    { id: 'technical', label: 'Kỹ thuật', icon: Activity },
    { id: 'valuation', label: 'Định giá', icon: Target },
    { id: 'consensus', label: 'Consensus', icon: FileText },
    { id: 'risks', label: 'Rủi ro', icon: AlertTriangle },
  ];

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'MUA': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'KHẢ QUAN': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'TRUNG LẬP': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'BÁN': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-800/50 border-slate-700';
    }
  };

  return (
    <div className="flex gap-8 max-w-[1600px] mx-auto relative">
      
      {/* LEFT NAVIGATION SIDEBAR (STICKY) */}
      <div className="hidden lg:flex flex-col w-64 gap-2 sticky top-24 h-fit">
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 mb-4">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mục lục báo cáo</span>
        </div>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setActiveSection(s.id);
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 border ${
              activeSection === s.id 
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20 translate-x-2' 
                : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <s.icon size={18} />
            <span className="text-xs font-black uppercase tracking-widest">{s.label}</span>
          </button>
        ))}
        
        <div className="mt-8 flex flex-col gap-3 px-2">
           <button className="flex items-center gap-3 text-[10px] font-black text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
              <Download size={14} /> Xuất PDF (Research Note)
           </button>
           <button className="flex items-center gap-3 text-[10px] font-black text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
              <Plus size={14} /> Thêm vào Watchlist
           </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col gap-12">
        
        {/* MARKET SCANNER RECOMMENDATION BOX */}
        {marketScanner && marketScanner.length > 0 && (
           <div className="bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mt-20 -mr-20 pointer-events-none"></div>
              <div className="flex items-center gap-3 text-emerald-400 mb-6">
                 <Zap size={20} className="animate-pulse" />
                 <h3 className="text-sm font-black uppercase tracking-[0.2em]">Market Scanner: Top Cổ Phiếu Khuyến Nghị Mua (HOSE, HNX, UPCOM)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                 {marketScanner.map((stock: any, index: number) => (
                    <div key={index} className="bg-black/40 border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-400/50 transition-colors">
                       <div className="flex justify-between items-center mb-3">
                          <span className="text-2xl font-black text-white italic">{stock.ticker}</span>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">Mua Mới</span>
                       </div>
                       <p className="text-[11px] text-slate-300 mb-4 h-16 line-clamp-3">"{stock.reason}"</p>
                       <div className="flex justify-between items-end border-t border-emerald-500/10 pt-3">
                          <div className="flex flex-col">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Entry</span>
                             <span className="text-xs font-black text-emerald-400">{stock.entry_zone}</span>
                          </div>
                          <div className="flex flex-col text-right">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Target</span>
                             <span className="text-sm font-black text-white">{stock.target}</span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* SECTION 1: HEADER & QUICK DASHBOARD */}
        <header id="overview" className="flex flex-col gap-8">
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-3">
                    <div className="px-2 py-0.5 bg-blue-600 text-[10px] font-black text-white rounded">
                       {prospects?.exchange || 'HOSE'}
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                       {prospects?.industry || 'Ngành nghề'}
                    </span>
                 </div>
                 <div className="flex items-baseline gap-4">
                    <h1 className="text-7xl font-black text-white italic tracking-tighter leading-none">{activeTicker}</h1>
                    <span className="text-xl font-bold text-slate-500 italic">{prospects?.company_name}</span>
                 </div>
              </div>

              <div className="flex gap-4 items-center">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Giá hiện tại</span>
                    <div className="flex items-center gap-3">
                       <span className={`text-sm font-black px-2 py-0.5 rounded ${ (realtimeQuote?.change || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500' }`}>
                          {(realtimeQuote?.change || 0) > 0 ? '+' : ''}{realtimeQuote?.change || '0.00'}%
                       </span>
                       <span className="text-5xl font-black text-white tabular-nums tracking-tighter">
                          {(realtimeQuote?.price || 0).toLocaleString()}
                          <span className="text-xs ml-1 opacity-40 text-slate-500 uppercase">vnd</span>
                       </span>
                    </div>
                 </div>
              </div>
           </div>

           {/* INVESTMENT RECOMMENDATION BOX */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 p-8 rounded-3xl border-2 flex flex-col gap-6 shadow-2xl relative overflow-hidden ${getRecommendationColor(prospects?.recommendation || 'TRUNG LẬP')}`}>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-current opacity-[0.03] blur-3xl rounded-full -mr-20 -mt-20"></div>
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Khuyến nghị đầu tư</span>
                       <span className="text-6xl font-black italic tracking-tighter">{prospects?.recommendation || 'TRUNG LẬP'}</span>
                    </div>
                    <div className="text-right flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Giá mục tiêu (12T)</span>
                       <span className="text-4xl font-black tabular-nums">{(prospects?.target_price || 0).toLocaleString()} <span className="text-lg opacity-60 uppercase">vnd</span></span>
                       <span className="text-sm font-black text-emerald-500">Upside +{prospects?.upside || 0}%</span>
                    </div>
                 </div>
                 <div className="h-px bg-current opacity-10 w-full"></div>
                 <div className="flex flex-wrap gap-10 items-center relative z-10">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Mức độ rủi ro</span>
                       <div className="flex items-center gap-2 mt-1">
                          <AlertTriangle size={14} />
                          <span className="text-sm font-black uppercase">{prospects?.risk_level || 'Trung bình'}</span>
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Thời gian nắm giữ</span>
                       <div className="flex items-center gap-2 mt-1">
                          <Clock size={14} />
                          <span className="text-sm font-black uppercase">{prospects?.holding_period || '12 Tháng'}</span>
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Độ tin cậy AI</span>
                       <div className="flex items-center gap-2 mt-1">
                          <Shield size={14} />
                          <span className="text-sm font-black uppercase">{prospects?.confidence_score || 0}%</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* FACTOR SCORES HEATMAP */}
              <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8 flex flex-col gap-6 shadow-xl">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Điểm tổng hợp đa nhân tố</span>
                 <div className="flex flex-col gap-4">
                    {[
                       { label: 'Fundamental', score: prospects?.scores?.fundamental || 70, color: 'bg-emerald-500' },
                       { label: 'Technical', score: prospects?.scores?.technical || 70, color: 'bg-blue-500' },
                       { label: 'Momentum', score: prospects?.scores?.momentum || 70, color: 'bg-purple-500' },
                       { label: 'Risk Score', score: prospects?.scores?.risk || 70, color: 'bg-rose-500' },
                    ].map(f => (
                       <div key={f.label} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                             <span className="text-slate-400">{f.label}</span>
                             <span className="text-white">{f.score}/100</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                             <div className={`h-full ${f.color} transition-all duration-1000`} style={{ width: `${f.score}%` }}></div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </header>

        {/* SECTION 2: EXECUTIVE SUMMARY */}
        <section className="bg-white/[0.02] border border-slate-800 rounded-3xl p-10 flex flex-col gap-8 shadow-2xl">
           <div className="flex items-center gap-4 text-blue-400">
              <Award size={24} />
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">Tóm tắt luận điểm đầu tư (Executive Summary)</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="flex flex-col gap-4">
                 {(prospects?.executive_summary || []).map((point: string, i: number) => (
                    <div key={i} className="flex gap-4 group">
                       <div className="h-6 w-6 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <span className="text-[10px] font-black">0{i+1}</span>
                       </div>
                       <p className="text-sm text-slate-300 font-medium leading-relaxed italic">"{point}"</p>
                    </div>
                 ))}
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 flex flex-col gap-6">
                 <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} fill="currentColor" /> Catalyst & Động lực tăng trưởng
                 </h4>
                 <div className="flex flex-col gap-4">
                    {(prospects?.strategic_catalysts || []).map((c: string, i: number) => (
                       <div key={i} className="flex items-center gap-4 group">
                          <div className="h-1 w-1 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform"></div>
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">{c}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </section>

        {/* SECTION 3: FUNDAMENTAL & FINANCIAL ANALYSIS */}
        <section id="fundamental" className="flex flex-col gap-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4 text-emerald-400">
                 <PieChart size={24} />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em]">Phân tích tài chính chuyên sâu</h3>
              </div>
              <div className="px-4 py-1 bg-slate-900 border border-slate-800 rounded-full">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Financial Engine v5.0</span>
              </div>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-3xl p-2 h-[500px] shadow-2xl relative">
                 <ProprietaryFinancialChart ticker={activeTicker} history={valuation?.history || []} />
                 <div className="absolute top-6 left-6 pointer-events-none">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Proprietary Revenue/Profit Model</span>
                 </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                 {[
                    { label: 'P/E Ratio', value: ratios?.pe, sub: 'Trung bình ngành: 14.2x', status: ratios?.status?.pe },
                    { label: 'ROE (%)', value: ratios?.roe, sub: 'Khả năng sinh lời vượt trội', status: ratios?.status?.roe },
                    { label: 'Net Margin (%)', value: ratios?.margin, sub: 'Biên lợi nhuận gộp cải thiện', status: ratios?.status?.margin },
                    { label: 'D/E Ratio', value: ratios?.debt_equity, sub: 'Đòn bẩy an toàn', status: ratios?.status?.debt_equity },
                 ].map(r => {
                    let colorClass = 'text-slate-400 group-hover:text-blue-400';
                    let borderClass = 'hover:border-blue-500/30';
                    
                    if (r.status === 'good') {
                       colorClass = 'text-emerald-500 group-hover:text-emerald-400';
                       borderClass = 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5';
                    } else if (r.status === 'warning') {
                       colorClass = 'text-rose-500 group-hover:text-rose-400';
                       borderClass = 'border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5';
                    }

                    return (
                       <div key={r.label} className={`bg-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all group ${borderClass}`}>
                          <div className="flex justify-between items-start">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.label}</span>
                                <span className="text-[8px] font-bold text-slate-700 uppercase group-hover:text-slate-500">{r.sub}</span>
                             </div>
                             <span className={`text-2xl font-black tabular-nums transition-colors ${colorClass}`}>{r.value}</span>
                          </div>
                       </div>
                    );
                 })}
                 <div className="mt-auto p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
                    <p className="text-[11px] font-bold text-slate-400 italic leading-relaxed">
                       "Nhận định của Analyst: Doanh nghiệp duy trì chất lượng tài sản tốt và dòng tiền ổn định, đảm bảo khả năng chi trả cổ tức cao."
                    </p>
                 </div>
              </div>
           </div>
        </section>

        {/* SECTION 4: TECHNICAL DIAGNOSIS */}
        <section id="technical" className="flex flex-col gap-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4 text-blue-400">
                 <Activity size={24} />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em]">Hệ thống kỹ thuật (Neural Tech Core)</h3>
              </div>
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stage Analysis</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VSA Matrix</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 h-[600px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                 <ProprietaryTechnicalChart key={activeTicker} ticker={activeTicker} />
              </div>
              
              <div className="flex flex-col gap-6">
                 <div className="bg-gradient-to-br from-slate-900 to-black rounded-3xl border border-slate-800 p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                    
                    <div className="flex flex-col gap-2">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Trạng thái kỹ thuật</span>
                       <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                          <p className="text-sm font-black text-blue-400 uppercase italic tracking-tighter">
                             {techAnalysis?.stage || 'Đang quét...'}
                          </p>
                       </div>
                    </div>

                    <div className="flex flex-col gap-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Tín hiệu VSA</span>
                          <p className="text-xs font-bold text-slate-200 italic leading-snug">"{techAnalysis?.vsa_signal}"</p>
                       </div>
                       <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Điểm Pivot quan trọng</span>
                          <p className="text-xl font-black text-white tabular-nums">{(techAnalysis?.pivot_point || 0).toLocaleString()} <span className="text-[10px] text-slate-500 uppercase italic">VND</span></p>
                       </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Verdict</span>
                          <span className="text-2xl font-black text-white uppercase italic tracking-tighter">{techAnalysis?.verdict}</span>
                       </div>
                       <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                          "{techAnalysis?.reason}"
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* SECTION 5: VALUATION MODEL */}
        <section id="valuation" className="bg-slate-900/40 rounded-3xl border border-slate-800 p-10 flex flex-col gap-10 shadow-2xl">
           <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div className="flex items-center gap-3 text-orange-400">
                 <Target size={24} />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em]">Mô hình định giá (Valuation Matrix)</h3>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Định giá Fair Value</p>
                 <p className="text-4xl font-black text-emerald-400 tabular-nums italic">
                    {(valuation?.intrinsic_value || 0).toLocaleString()} ₫
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                 { label: 'WACC', value: valuation?.wacc, suffix: '%', icon: Calculator },
                 { label: 'Tăng trưởng (g)', value: valuation?.growth_rate, suffix: '%', icon: TrendingUp },
                 { label: 'Biên an toàn', value: valuation?.upside, suffix: '%', icon: Shield },
                 { label: 'Kỳ dự báo', value: '5', suffix: ' Năm', icon: Clock },
              ].map(item => (
                 <div key={item.label} className="p-6 bg-black/40 border border-white/5 rounded-2xl flex flex-col gap-2 hover:border-orange-500/20 transition-all">
                    <div className="flex items-center gap-3">
                       <item.icon size={14} className="text-orange-500" />
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{item.value}{item.suffix}</span>
                 </div>
              ))}
           </div>

           <div className="bg-white/[0.02] p-8 rounded-2xl border border-white/5 flex flex-col gap-6">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Luận điểm định giá</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {(valuation?.assumptions || []).map((a: string, i: number) => (
                    <div key={i} className="flex gap-4">
                       <span className="text-orange-500 font-black">▸</span>
                       <p className="text-xs text-slate-400 font-medium italic leading-relaxed">{a}</p>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* SECTION 6: CONSENSUS & RESEARCH REPORTS */}
        <section id="consensus" className="flex flex-col gap-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4 text-purple-400">
                 <FileText size={24} />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em]">Đồng thuận thị trường (Consensus View)</h3>
              </div>
              <div className="flex gap-4">
                 <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-500 uppercase">
                    Mua: {prospects?.consensus?.buy}
                 </div>
                 <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-[9px] font-black text-orange-500 uppercase">
                    Giữ: {prospects?.consensus?.hold}
                 </div>
              </div>
           </div>

           <div className="bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-[11px] border-separate border-spacing-0">
                 <thead>
                    <tr className="bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                       <th className="p-6 text-left border-b border-slate-800">Tổ chức phân tích</th>
                       <th className="p-6 text-center border-b border-slate-800">Khuyến nghị</th>
                       <th className="p-6 text-right border-b border-slate-800">Giá mục tiêu</th>
                       <th className="p-6 text-right border-b border-slate-800">Upside</th>
                       <th className="p-6 text-center border-b border-slate-800">Thao tác</th>
                    </tr>
                 </thead>
                 <tbody className="text-slate-300">
                    {(reports || []).map((r, i) => (
                       <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="p-6 border-b border-slate-800/50">
                             <div className="flex flex-col">
                                <span className="font-black text-white uppercase tracking-tighter text-sm">{r.firm}</span>
                                <span className="text-[9px] text-slate-600 font-bold uppercase mt-1">{r.date}</span>
                             </div>
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-center">
                             <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded text-[9px] font-black uppercase">Khả quan</span>
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-right font-black tabular-nums">
                             {(r.target_price || prospects?.consensus?.avg_target).toLocaleString()} ₫
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-right text-emerald-500 font-black tabular-nums">
                             +{(r.upside || 15.5)}%
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-center">
                             <a href={r.link} target="_blank" className="p-2 hover:bg-blue-600/20 rounded-full transition-colors inline-block text-blue-500">
                                <ExternalLink size={14} />
                             </a>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </section>

        {/* SECTION 7: RISK MATRIX */}
        <section id="risks" className="bg-rose-600/5 border border-rose-500/10 rounded-3xl p-10 flex flex-col gap-8 shadow-xl">
           <div className="flex items-center gap-4 text-rose-500">
              <AlertTriangle size={24} />
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">Ma trận rủi ro (Risk Assessment)</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(prospects?.risk_assessment || []).map((r: any, i: number) => (
                 <div key={i} className="p-6 bg-black/40 border border-slate-800 rounded-2xl flex flex-col gap-4 group hover:border-rose-500/20 transition-all">
                    <div className="flex justify-between items-center">
                       <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest">{r.title}</h4>
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          r.impact === 'High' ? 'bg-rose-500 text-white' : 'bg-orange-500/20 text-orange-500'
                       }`}>
                          Impact: {r.impact}
                       </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed italic group-hover:text-slate-400 transition-colors">
                       "{r.content}"
                    </p>
                 </div>
              ))}
           </div>
        </section>

        {/* FOOTER: ANALYST FINAL VIEW */}
        <footer className="mt-12 bg-gradient-to-br from-slate-900 to-black border-2 border-blue-500/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
           <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full -mb-48 -mr-48"></div>
           <div className="relative z-10 flex flex-col gap-6">
              <div className="flex items-center gap-4 text-blue-400">
                 <Award size={24} />
                 <h3 className="text-xs font-black uppercase tracking-[0.5em]">Quan điểm cuối cùng của Analyst</h3>
              </div>
              <p className="text-lg font-bold text-slate-200 leading-relaxed italic">
                 "Chúng tôi duy trì khuyến nghị <span className="text-emerald-400 underline">{prospects?.recommendation}</span> đối với cổ phiếu {activeTicker} với giá mục tiêu 12 tháng là {prospects?.target_price?.toLocaleString()} ₫/cp. Luận điểm chính đến từ sự bùng nổ lợi nhuận mảng công nghệ/thép và định giá còn hấp dẫn so với tiềm năng tăng trưởng. Tuy nhiên, nhà đầu tư nên theo dõi sát các nhịp điều chỉnh kỹ thuật để tối ưu hóa điểm mua."
              </p>
              <div className="flex items-center gap-8 mt-4 pt-6 border-t border-white/5">
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Thời gian cập nhật</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">28/04/2026 | 09:50 AM</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Research ID</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">AX-5502-CORE</span>
                 </div>
              </div>
           </div>
        </footer>

      </div>
    </div>
  );
};

export default AnalystPage;
