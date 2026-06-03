import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, Zap, TrendingUp, Shield, 
  Calculator, ExternalLink, PieChart, Target, 
  Award, AlertTriangle, Clock, 
  FileText, Globe, Download, Plus, Mail, Inbox, RefreshCw
} from 'lucide-react';
import ProprietaryFinancialChart from '../components/ProprietaryFinancialChart';
import ProprietaryTechnicalChart from '../components/ProprietaryTechnicalChart';

const API_BASE = 'http://127.0.0.1:8011/api';

const AnalystPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any>(null);
  const [ratios, setRatios] = useState<any>(null);
  const [valuation, setValuation] = useState<any>(null);
  const [techAnalysis, setTechnicalAnalysis] = useState<any>(null);
  const [realtimeQuote, setRealtimeQuote] = useState<any>(null);
  const [marketScanner, setMarketScanner] = useState<any[]>([]);
  const [gmailBrief, setGmailBrief] = useState<any>(null);
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [aiEquityReport, setAiEquityReport] = useState<any>(null);
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
    
    Promise.all([
      safeGet(`${API_BASE}/news/gmail/status`, null),
      safeGet(`${API_BASE}/news/gmail/brief/${ticker}?limit=20`, null)
    ]).then(([gmailStatusRes, gmailBriefRes]) => {
      setGmailStatus(gmailStatusRes);
      setGmailBrief(gmailBriefRes);
    });

    Promise.all([
      safeGet(`${API_BASE}/finance/ratios/${ticker}`, null),
      safeGet(`${API_BASE}/finance/valuation/dcf/${ticker}`, null)
    ]).then(([ratiosRes, valuationRes]) => {
      setRatios(ratiosRes);
      setValuation(valuationRes);
    });

    safeGet(`${API_BASE}/ai/equity-report/${ticker}`, null).then((reportRes) => {
      setAiEquityReport(reportRes);
    });

    const [reportsRes, prospectsRes, techRes, quoteRes, scannerRes] = await Promise.all([
      safeGet(`${API_BASE}/analysis/reports/${ticker}`, []),
      safeGet(`${API_BASE}/analysis/prospects/${ticker}`, null),
      safeGet(`${API_BASE}/analysis/technical/${ticker}`, null),
      safeGet(`${API_BASE}/market/quote/${ticker}`, null),
      safeGet(`${API_BASE}/market/scanner`, [])
    ]);

    setReports(reportsRes);
    setProspects(prospectsRes);
    setTechnicalAnalysis(techRes);
    setRealtimeQuote(quoteRes);
    setMarketScanner(scannerRes);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTicker]);

  const downloadResearchPdf = async () => {
    const ticker = activeTicker.toUpperCase();
    try {
      const res = await axios.get(`${API_BASE}/research/${ticker}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ticker}_research_report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download research PDF', error);
    }
  };

  const sections = [
    { id: 'overview', label: 'Tổng quan', icon: Globe },
    { id: 'fundamental', label: 'Cơ bản', icon: Award },
    { id: 'technical', label: 'Kỹ thuật', icon: Activity },
    { id: 'valuation', label: 'Định giá', icon: Target },
    { id: 'consensus', label: 'Consensus', icon: FileText },
    { id: 'risks', label: 'Rủi ro', icon: AlertTriangle },
  ];

  const getRecommendationColor = (rec: string) => {
    if (rec === 'MUA') return 'text-emerald-400 bg-emerald-500/10 border-emerald-400/30';
    if (rec === 'KHẢ QUAN') return 'text-cyan-300 bg-cyan-500/10 border-cyan-400/30';
    if (rec === 'TRUNG LẬP') return 'text-amber-300 bg-amber-500/10 border-amber-400/30';
    if (rec === 'BÁN') return 'text-rose-300 bg-rose-500/10 border-rose-400/30';
    switch (rec) {
      case 'MUA': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'KHẢ QUAN': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'TRUNG LẬP': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'BÁN': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-800/50 border-slate-700';
    }
  };

  const latestReportDate = prospects?.updated_at || reports?.[0]?.date || '';
  const researchId = prospects?.research_id || '';
  const ratioNotes = prospects?.ratio_notes || {};
  const finalOpinion = prospects?.final_opinion || '';
  const forecastPeriodYears = valuation?.forecast_period_years || prospects?.forecast_period_years || valuation?.history?.length || 0;
  const gmailConfigured = Boolean(gmailStatus?.configured);
  const gmailGroups = gmailBrief?.groups || {};
  const gmailGroupList = [
    { key: 'tickerSpecific', title: `Tin theo ma ${activeTicker.toUpperCase()}`, empty: `Hom nay chua co tin rieng cho ${activeTicker.toUpperCase()} trong email bot.`, accent: 'cyan' },
    { key: 'macro', title: 'Vi mo', empty: 'Chua co tin vi mo trong email hom nay.', accent: 'emerald' },
    { key: 'international', title: 'Quoc te', empty: 'Chua co tin quoc te trong email hom nay.', accent: 'blue' },
    { key: 'corporate', title: 'Doanh nghiep / thi truong', empty: 'Chua co tin doanh nghiep phu hop trong email hom nay.', accent: 'amber' },
  ];
  const hasGmailBriefItems = (gmailBrief?.items || []).length > 0;
  const aiList = (items: any) => Array.isArray(items) ? items.filter(Boolean) : [];
  const formatMailDate = (value: string) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
  };

  const renderBriefItem = (item: any) => (
    <article key={item.id} className="rounded-xl border border-slate-800 bg-black/25 p-4 hover:border-cyan-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.source || 'Gmail'} / {formatMailDate(item.publishedAt || item.time)}</p>
          <h4 className="mt-2 text-sm font-black text-white leading-snug">{item.title}</h4>
        </div>
        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer" className="h-8 w-8 shrink-0 rounded-lg border border-slate-700 text-cyan-300 hover:bg-cyan-500/10 flex items-center justify-center" title="Open source link">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400 leading-relaxed line-clamp-3">{item.summary || 'Khong co tom tat.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.ticker && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black uppercase text-slate-400">{item.ticker}</span>}
        {item.sentiment && <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase text-cyan-300">{item.sentiment}</span>}
      </div>
    </article>
  );

  const renderAiList = (items: any) => (
    <div className="flex flex-col gap-3">
      {aiList(items).map((item: string, index: number) => (
        <div key={`${item}-${index}`} className="flex gap-3">
          <span className="mt-1 h-5 w-5 shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 text-[9px] font-black text-blue-300 flex items-center justify-center">{index + 1}</span>
          <p className="text-xs text-slate-300 leading-relaxed">{item}</p>
        </div>
      ))}
    </div>
  );

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
           <button onClick={downloadResearchPdf} className="flex items-center gap-3 text-[10px] font-black text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
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
                       <span className="text-sm font-black text-emerald-500">Dư địa tăng +{prospects?.upside || 0}%</span>
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
                       { label: 'Fundamental', score: prospects?.scores?.fundamental ?? 0, color: 'bg-emerald-500' },
                       { label: 'Technical', score: prospects?.scores?.technical ?? 0, color: 'bg-blue-500' },
                       { label: 'Momentum', score: prospects?.scores?.momentum ?? 0, color: 'bg-purple-500' },
                       { label: 'Risk Score', score: prospects?.scores?.risk ?? 0, color: 'bg-rose-500' },
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

           <section className="bg-slate-950/80 border border-cyan-500/15 rounded-3xl overflow-hidden shadow-2xl">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
                 <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
                       <Mail size={19} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-cyan-300 uppercase tracking-[0.24em]">Daily Market Brief</p>
                       <h3 className="text-sm font-black text-white uppercase tracking-widest">{activeTicker} + Macro / Global / Corporate</h3>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded border text-[9px] font-black uppercase ${gmailConfigured ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-amber-500/10 text-amber-300 border-amber-500/25'}`}>
                       {gmailConfigured ? 'Connected' : 'Setup required'}
                    </span>
                    <button onClick={fetchData} title="Refresh Gmail news" className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 flex items-center justify-center">
                       <RefreshCw size={15} />
                    </button>
                 </div>
              </div>

              {!gmailConfigured ? (
                 <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 px-6 py-5">
                    <div className="flex items-start gap-4">
                       <Inbox size={18} className="text-amber-300 mt-0.5" />
                       <div>
                          <p className="text-sm font-bold text-slate-200">Chua cau hinh Gmail trong backend.</p>
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                             Dien `GMAIL_ADDRESS` va `GMAIL_APP_PASSWORD` trong `BE/.env`, bat IMAP trong Gmail, roi restart backend. Query hien tai: {gmailStatus?.query || 'longnt.1608 newer_than:30d'}.
                          </p>
                       </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                       Gmail query: longnt.1608
                    </div>
                 </div>
              ) : !hasGmailBriefItems ? (
                 <div className="px-6 py-6 flex items-center gap-3 text-slate-500">
                    <Inbox size={18} />
                    <span className="text-xs font-bold">Khong co tin trong ngay hien tai phu hop voi {activeTicker} va cac nhom vi mo/quoc te/doanh nghiep.</span>
                 </div>
              ) : (
                 <div className="p-5 space-y-5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                       <span>Ngay: {gmailBrief?.date || 'today'}</span>
                       <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                       <span>Nguon email: {gmailBrief?.sourceEmailCount || 0}</span>
                       {!gmailBrief?.hasTickerSpecific && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                            <span className="text-amber-300">Chua co tin rieng cho {activeTicker.toUpperCase()}</span>
                          </>
                       )}
                    </div>
                    {gmailGroupList.map((group) => {
                       const items = gmailGroups[group.key] || [];
                       return (
                          <section key={group.key} className="rounded-2xl border border-slate-800/80 bg-slate-950/50 overflow-hidden">
                             <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{group.title}</h4>
                                <span className="rounded border border-slate-700 bg-black/30 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{items.length} tin</span>
                             </div>
                             {items.length === 0 ? (
                                <div className="px-4 py-4 flex items-center gap-3 text-slate-500">
                                   <Inbox size={16} />
                                   <span className="text-xs font-bold">{group.empty}</span>
                                </div>
                             ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
                                   {items.map(renderBriefItem)}
                                </div>
                             )}
                          </section>
                       );
                    })}
                 </div>
              )}
           </section>

           <section className="bg-slate-950/80 border border-blue-500/15 rounded-3xl overflow-hidden shadow-2xl">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
                 <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300">
                       <FileText size={19} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.24em]">AI Equity Report</p>
                       <h3 className="text-sm font-black text-white uppercase tracking-widest">{activeTicker} Institutional Research Draft</h3>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded border text-[9px] font-black uppercase ${aiEquityReport?.configured ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-blue-500/10 text-blue-300 border-blue-500/25'}`}>
                       {aiEquityReport?.configured ? `AI ${aiEquityReport?.model || ''}` : 'Model fallback'}
                    </span>
                    <button onClick={fetchData} title="Refresh AI equity report" className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/40 hover:text-blue-300 flex items-center justify-center">
                       <RefreshCw size={15} />
                    </button>
                 </div>
              </div>

              {!aiEquityReport ? (
                 <div className="px-6 py-6 flex items-center gap-3 text-slate-500">
                    <div className="h-5 w-5 border-2 border-blue-500/20 border-t-blue-400 rounded-full animate-spin"></div>
                    <span className="text-xs font-bold">Dang tao equity report cho {activeTicker}...</span>
                 </div>
              ) : (
                 <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div className="xl:col-span-5 rounded-2xl border border-slate-800 bg-black/25 p-5">
                       <div className="flex items-start justify-between gap-4">
                          <div>
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{aiEquityReport.company || activeTicker}</p>
                             <h4 className="mt-2 text-3xl font-black text-white uppercase tracking-tight">{aiEquityReport.recommendation || 'THEO DOI'}</h4>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target</p>
                             <p className="text-xl font-black text-emerald-300 tabular-nums">{(aiEquityReport.target_price || 0).toLocaleString()} VND</p>
                          </div>
                       </div>
                       <p className="mt-5 text-sm text-slate-300 leading-relaxed italic">"{aiEquityReport.investment_view}"</p>
                       {aiEquityReport.ai_note && <p className="mt-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">{aiEquityReport.ai_note}</p>}
                    </div>

                    <div className="xl:col-span-7 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4">Investment Summary</p>
                       {renderAiList(aiEquityReport.summary_bullets)}
                    </div>

                    <div className="xl:col-span-4 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-3">Business Quality</p>
                       <p className="text-xs text-slate-300 leading-relaxed">{aiEquityReport.business_quality}</p>
                    </div>
                    <div className="xl:col-span-4 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-cyan-300 uppercase tracking-widest mb-3">Financials</p>
                       <p className="text-xs text-slate-300 leading-relaxed">{aiEquityReport.financial_analysis}</p>
                    </div>
                    <div className="xl:col-span-4 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-orange-300 uppercase tracking-widest mb-3">Valuation</p>
                       <p className="text-xs text-slate-300 leading-relaxed">{aiEquityReport.valuation_analysis}</p>
                    </div>

                    <div className="xl:col-span-12 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-3">News Read-through</p>
                       <p className="text-xs text-slate-300 leading-relaxed">{aiEquityReport.news_readthrough}</p>
                    </div>

                    <div className="xl:col-span-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
                       <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-4">Catalysts</p>
                       {renderAiList(aiEquityReport.catalysts)}
                    </div>
                    <div className="xl:col-span-6 rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-5">
                       <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-4">Risks</p>
                       {renderAiList(aiEquityReport.risks)}
                    </div>

                    <div className="xl:col-span-6 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Monitoring Plan</p>
                       {renderAiList(aiEquityReport.monitoring_plan)}
                    </div>
                    <div className="xl:col-span-6 rounded-2xl border border-slate-800 bg-black/20 p-5">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Action Plan</p>
                       {renderAiList(aiEquityReport.action_plan)}
                    </div>

                    <p className="xl:col-span-12 text-[10px] text-slate-600 leading-relaxed">{aiEquityReport.disclaimer}</p>
                 </div>
              )}
           </section>
        </header>

        {/* SECTION 2: EXECUTIVE SUMMARY */}
        <section className="bg-white/[0.02] border border-slate-800 rounded-3xl p-10 flex flex-col gap-8 shadow-2xl">
           <div className="flex items-center gap-4 text-blue-400">
              <Award size={24} />
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">Tóm tắt luận điểm đầu tư</h3>
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
                    {(prospects?.strategic_catalysts || []).map((c: any, i: number) => (
                       <div key={i} className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
                          <div className="flex items-center justify-between gap-3">
                             <span className="text-xs font-black text-white uppercase tracking-tight">{typeof c === 'string' ? c : c.title}</span>
                             {typeof c !== 'string' && <span className="text-[9px] font-black text-emerald-300 uppercase">{c.impact} / {c.timeline}</span>}
                          </div>
                          {typeof c !== 'string' && <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{c.detail}</p>}
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
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mô hình tài chính v5.0</span>
              </div>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-3xl p-2 h-[500px] shadow-2xl relative">
                 <ProprietaryFinancialChart ticker={activeTicker} history={valuation?.history || []} />
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                 {[
                    { label: 'P/E Ratio', value: ratios?.pe, sub: ratios?.notes?.pe || ratioNotes.pe || '', status: ratios?.status?.pe },
                    { label: 'ROE (%)', value: ratios?.roe, sub: ratios?.notes?.roe || ratioNotes.roe || '', status: ratios?.status?.roe },
                    { label: 'Net Margin (%)', value: ratios?.margin, sub: ratios?.notes?.margin || ratioNotes.margin || '', status: ratios?.status?.margin },
                    { label: 'D/E Ratio', value: ratios?.debt_equity, sub: ratios?.notes?.debt_equity || ratioNotes.debt_equity || '', status: ratios?.status?.debt_equity },
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

                    const displayValue = typeof r.value === 'number' && Number.isFinite(r.value)
                       ? r.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
                       : 'N/A';

                    return (
                       <div key={r.label} className={`bg-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all group ${borderClass}`}>
                          <div className="flex justify-between items-start">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.label}</span>
                                <span className="text-[8px] font-bold text-slate-700 uppercase group-hover:text-slate-500">{r.sub}</span>
                             </div>
                             <span className={`text-2xl font-black tabular-nums transition-colors ${colorClass}`}>{displayValue}</span>
                          </div>
                       </div>
                    );
                 })}
                 <div className="mt-auto p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
                    <p className="text-[11px] font-bold text-slate-400 italic leading-relaxed">"{finalOpinion}"</p>
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
                 <h3 className="text-sm font-black uppercase tracking-[0.3em]">Mô hình định giá</h3>
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
                 { label: 'Kỳ dự báo', value: forecastPeriodYears || 'N/A', suffix: forecastPeriodYears ? ' Năm' : '', icon: Clock },
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

           {valuation?.valuation_bridge && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-black/35 border border-white/5 rounded-2xl p-6">
                   <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Cầu nối định giá</span>
                   <div className="mt-5 grid grid-cols-2 gap-3">
                      {valuation.valuation_bridge.map((item: any) => (
                        <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                           <p className="mt-2 text-xl font-black text-white tabular-nums">
                              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                           </p>
                           <p className="text-[10px] text-slate-500">{item.unit}</p>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="bg-black/35 border border-white/5 rounded-2xl p-6">
                   <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">Giá mục tiêu theo kịch bản</span>
                   <div className="mt-5 flex flex-col gap-3">
                      {Object.entries(valuation.scenario || {}).map(([name, item]: any) => (
                         <div key={name} className="grid grid-cols-[84px_1fr_auto] items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                            <span className="text-xs font-black uppercase text-slate-300">{name}</span>
                            <div>
                              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full bg-cyan-400" style={{ width: `${item.probability}%` }} />
                              </div>
                              <p className="mt-2 text-[10px] text-slate-500">{item.driver}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-white">{item.target.toLocaleString()}</p>
                              <p className="text-[9px] text-slate-500">{item.probability}%</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
           )}

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
                       <th className="p-6 text-right border-b border-slate-800">Dư địa tăng</th>
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
                             <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded text-[9px] font-black uppercase">{r.recommendation || prospects?.recommendation || 'N/A'}</span>
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-right font-black tabular-nums">
                             {(r.target_price || prospects?.consensus?.avg_target).toLocaleString()} ₫
                          </td>
                          <td className="p-6 border-b border-slate-800/50 text-right text-emerald-500 font-black tabular-nums">
                             +{(r.upside ?? prospects?.upside ?? 0)}%
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
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">Ma trận rủi ro</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(prospects?.risk_assessment || []).map((r: any, i: number) => (
                 <div key={i} className="p-6 bg-black/40 border border-slate-800 rounded-2xl flex flex-col gap-4 group hover:border-rose-500/20 transition-all">
                    <div className="flex justify-between items-center">
                       <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest">{r.title}</h4>
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          r.impact === 'Cao' ? 'bg-rose-500 text-white' : 'bg-orange-500/20 text-orange-500'
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
              <p className="text-lg font-bold text-slate-200 leading-relaxed italic">"{finalOpinion}"</p>
              <div className="flex items-center gap-8 mt-4 pt-6 border-t border-white/5">
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Thời gian cập nhật</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{latestReportDate}</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Research ID</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{researchId}</span>
                 </div>
              </div>
           </div>
        </footer>

      </div>
    </div>
  );
};

export default AnalystPage;
