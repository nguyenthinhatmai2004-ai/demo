import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Activity, LineChart, TrendingUp, Brain, Send, Loader2 } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
import AIQuantPage from './AIQuantPage';

const API_BASE = 'http://127.0.0.1:8001/api';

const TraderPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [botRunning, setBotRunning] = useState(false);
  const [balance, setBalance] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const chartSeriesRef = useRef<any>(null);

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
    const [balRes, historyRes, statusRes, signalsRes] = await Promise.all([
      safeGet(`${API_BASE}/account/balance`, { balance: 0 }),
      safeGet(`${API_BASE}/bot/trades`, []),
      safeGet(`${API_BASE}/bot/status`, { running: true }),
      safeGet(`${API_BASE}/analysis/trading-signals/${ticker}`, null)
    ]);

    setBalance(balRes.balance);
    setTrades(historyRes);
    setBotRunning(statusRes.running);
    setSignals(signalsRes);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [activeTicker]);

  const equityChartData = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) {
      return [];
    }

    const orderedTrades = [...trades]
      .filter((trade: any) => trade?.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let cumulativePnl = 0;
    return orderedTrades.map((trade: any) => {
      const pnl = typeof trade?.pnl === 'number' ? trade.pnl : 0;
      cumulativePnl += pnl;
      return {
        time: new Date(trade.timestamp).toISOString().slice(0, 10),
        value: balance + cumulativePnl
      };
    });
  }, [trades, balance]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: 'rgba(31, 41, 55, 0.3)' }, horzLines: { color: 'rgba(31, 41, 55, 0.3)' } },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    });
    const series = chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59, 130, 246, 0.2)', bottomColor: 'transparent', lineWidth: 2 });
    chartRef.current = chart;
    chartSeriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current = null;
      chartSeriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!chartSeriesRef.current) return;

    if (equityChartData.length > 0) {
      chartSeriesRef.current.setData(equityChartData);
      chartRef.current?.timeScale().fitContent();
      return;
    }

    chartSeriesRef.current.setData([
      { time: new Date().toISOString().slice(0, 10), value: balance || 0 }
    ]);
    chartRef.current?.timeScale().fitContent();
  }, [equityChartData, balance]);

  const askCodex = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;

    setAiLoading(true);
    setAiAnswer('');
    try {
      const res = await axios.post(`${API_BASE}/ai/codex`, {
        ticker: activeTicker.toUpperCase(),
        prompt,
        context: { signals }
      });
      setAiAnswer(res.data?.answer || 'No response from Codex Advisor.');
    } catch (e: any) {
      setAiAnswer(e?.response?.data?.detail || e?.message || 'Codex Advisor request failed.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      {/* COLUMN 1 & 2: CODEX ADVISOR */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        <div className="terminal-card p-6 flex flex-col gap-4 border-cyan-500/20">
           <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-cyan-400">
                 <Brain size={18} />
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Codex Advisor</h3>
              </div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{activeTicker} Context</span>
           </div>

           <div className="flex gap-3">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') askCodex();
                }}
                placeholder={`Ask about ${activeTicker}: risk, entry, thesis...`}
                className="min-w-0 flex-1 bg-black/30 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={askCodex}
                disabled={aiLoading || !aiPrompt.trim()}
                className="h-11 w-11 shrink-0 rounded-xl bg-cyan-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                title="Ask Codex Advisor"
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
           </div>

           {aiAnswer && (
             <div className="bg-black/30 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto custom-scrollbar">
                {aiAnswer}
             </div>
           )}
        </div>
      </div>

      {/* COLUMN 3 & 4: SIGNALS & PERFORMANCE */}
      <div className="xl:col-span-2 flex flex-col gap-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {signals ? (
               <>
                  <div className="terminal-card p-6 border-l-4 border-l-blue-500 flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{signals.short_term.label}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${signals.short_term.signal === 'MUA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{signals.short_term.signal}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-white italic tracking-tighter">{activeTicker} Pulse</span>
                        <div className="flex items-center gap-1 text-emerald-400">
                           <TrendingUp size={14} />
                           <span className="text-xs font-black tabular-nums">{signals.short_term.strength}%</span>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        {Object.entries(signals.short_term.indicators).map(([k, v]: any) => (
                           <div key={k} className="bg-black/20 p-2 rounded border border-white/5 flex justify-between items-center">
                              <span className="text-[8px] font-bold text-slate-500 uppercase">{k}</span>
                              <span className="text-[9px] font-black text-slate-300 uppercase">{v}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div className="terminal-card p-6 border-l-4 border-l-emerald-500 flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{signals.long_term.label}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-black">{signals.long_term.signal}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-white italic tracking-tighter">Value Matrix</span>
                        <div className="flex items-center gap-1 text-blue-400">
                           <Activity size={14} />
                           <span className="text-xs font-black tabular-nums">{signals.long_term.strength}%</span>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        {Object.entries(signals.long_term.indicators).map(([k, v]: any) => (
                           <div key={k} className="bg-black/20 p-2 rounded border border-white/5 flex justify-between items-center">
                              <span className="text-[8px] font-bold text-slate-500 uppercase">{k}</span>
                              <span className="text-[9px] font-black text-slate-300 uppercase">{v}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </>
            ) : <div className="col-span-2 terminal-card p-6 text-center text-slate-600 text-[10px] italic uppercase tracking-widest">Scanning signals for {activeTicker}...</div>}
         </div>

         <div className="terminal-card p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3 text-blue-400">
                  <LineChart size={20} />
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Equity Performance (Alpha Test)</h3>
               </div>
               <span className="text-xl font-black text-emerald-400 tabular-nums">+{((balance - 1000000000) / 1000000000 * 100).toFixed(2)}%</span>
            </div>
            <div ref={chartContainerRef} className="w-full" />
         </div>

         <div className="terminal-card p-6 bg-gradient-to-r from-slate-900 to-black flex items-center justify-between">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Automated Execution</span>
               <p className="text-xs font-bold text-slate-300 uppercase">Strategy: Multi-Strategy AI Hunter</p>
            </div>
            <button 
              onClick={() => setBotRunning(!botRunning)}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${botRunning ? 'bg-rose-600 text-white shadow-rose-900/20' : 'bg-blue-600 text-white shadow-blue-900/40'}`}
            >
              {botRunning ? 'Stop Engine' : 'Start Engine'}
            </button>
         </div>
      </div>
    </div>
    <AIQuantPage activeTicker={activeTicker} />
    </div>
  );
};

export default TraderPage;
