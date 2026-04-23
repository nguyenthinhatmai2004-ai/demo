import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Terminal, Zap, Activity, LineChart, Shield, BarChart2, Clock, Cpu, Play, Square, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

const API_BASE = 'http://127.0.0.1:8001/api';

const TraderPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [botRunning, setBotRunning] = useState(false);
  const [balance, setBalance] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Thử dùng localhost cho websocket
    const ws = new WebSocket('ws://127.0.0.1:8001/ws/ai-logs');
    ws.onmessage = (e) => setLogs(prev => [...prev, e.data].slice(-100));
    return () => ws.close();
  }, []);

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
      safeGet(`${API_BASE}/account/balance`, { balance: 1250000000 }),
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

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: 'rgba(31, 41, 55, 0.3)' }, horzLines: { color: 'rgba(31, 41, 55, 0.3)' } },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    });
    const series = chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59, 130, 246, 0.2)', bottomColor: 'transparent', lineWidth: 2 });
    series.setData([
      { time: '2026-04-01', value: 100 },
      { time: '2026-04-05', value: 105 },
      { time: '2026-04-10', value: 103 },
      { time: '2026-04-15', value: 112 },
      { time: '2026-04-19', value: 115 },
    ]);
    return () => chart.remove();
  }, []);

  const executeRealTrade = async (ticker: string, side: string, price: number) => {
    try {
      const res = await axios.post(`${API_BASE}/trader/execute`, { ticker, side, price });
      if (res.data.status === 'SUCCESS') alert(`ORDER SUCCESS: ID ${res.data.order_id}`);
    } catch { alert("ORDER FAILED"); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      {/* COLUMN 1 & 2: COMMAND CENTER */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        <div className="terminal-card bg-black p-0 overflow-hidden flex flex-col h-[650px] border-blue-500/20 shadow-2xl shadow-blue-900/10">
           <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3 text-blue-400">
                 <Terminal size={18} />
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">AI Command Center v4.0</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
                 <div className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse"></div>
                 <span className="text-[8px] text-emerald-400 font-black uppercase">Core Online</span>
              </div>
           </div>
           <div ref={terminalRef} className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-1.5 custom-scrollbar">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 group hover:bg-white/5 transition-colors px-2 py-0.5 rounded">
                   <span className="text-slate-700 select-none">{i.toString().padStart(3, '0')}</span>
                   <p className="text-emerald-500/90 leading-tight">
                      <span className="text-emerald-800 mr-2">{" >>> "}</span>{log}
                   </p>
                </div>
              ))}
              <div className="h-4 w-2 bg-emerald-500/50 animate-pulse mt-2 ml-10"></div>
           </div>
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
  );
};

export default TraderPage;
