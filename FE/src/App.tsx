import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, Briefcase, Zap, Bell, User, Search, Globe, Activity, Terminal
} from 'lucide-react';
import AnalystPage from './pages/AnalystPage';
import InvestmentPage from './pages/InvestmentPage';
import TraderPage from './pages/TraderPage';

const API_BASE = 'http://127.0.0.1:8001/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyst' | 'investment' | 'trader'>('analyst');
  const [activeTicker, setActiveTicker] = useState('FPT');
  const [balance, setBalance] = useState(1250000000);
  const [tickerTape, setTickerTape] = useState<any[]>([]);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await axios.get(`${API_BASE}/account/balance`);
        setBalance(res.data.balance || 1250000000);
      } catch (e) {
        console.error("Balance fetch error", e);
      }
    };
    
    const fetchTickerTape = async () => {
        try {
            const res = await axios.get(`${API_BASE}/market/ticker-tape`);
            setTickerTape(res.data || []);
        } catch (e) {
            console.error("Ticker tape fetch error", e);
        }
    };

    fetchBalance();
    fetchTickerTape();
    
    const interval = setInterval(() => {
        fetchBalance();
        fetchTickerTape();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans">
      
      {/* SIDEBAR - Fixed Navigation */}
      <aside className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-10 gap-12 z-50 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-all" onClick={() => setActiveTab('analyst')}>
          <Terminal className="text-white" size={24} />
        </div>

        <nav className="flex flex-col gap-8 flex-1">
          {[
            { id: 'analyst', icon: Activity, label: 'Analysis', color: 'blue' },
            { id: 'investment', icon: Briefcase, label: 'Strategic', color: 'emerald' },
            { id: 'trader', icon: Zap, label: 'AI Quant', color: 'orange' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              title={tab.label}
              className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                activeTab === tab.id 
                ? `bg-${tab.color}-500/10 text-${tab.color}-400 border border-${tab.color}-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]` 
                : 'text-slate-600 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              <tab.icon size={22} />
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-6 mt-auto">
          <Bell size={20} className="text-slate-600 hover:text-white cursor-pointer" />
          <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
            <User size={20} className="text-gray-400" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER */}
        <header className="h-20 bg-slate-950/50 border-b border-slate-800 flex items-center px-10 justify-between backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-12 flex-1">
             <div className="flex flex-col">
                <h1 className="text-sm font-black text-white uppercase tracking-[0.3em] italic">Neural Terminal</h1>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Status: <span className="text-emerald-500">Live Matrix v3.1</span></p>
             </div>

             <div className="relative w-full max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                <input 
                  type="text"
                  placeholder="SEARCH TICKER OR ANALYSIS COMMAND..."
                  onKeyDown={(e) => { if(e.key === 'Enter') setActiveTicker((e.target as HTMLInputElement).value.toUpperCase()) }}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-xs font-bold focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-slate-700 uppercase tracking-widest"
                />
             </div>
          </div>

          <div className="flex items-center gap-10">
             <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Portfolio Value</span>
                <div className="flex items-center gap-3">
                   <span className="text-lg font-black text-emerald-400 tabular-nums tracking-tighter">{balance.toLocaleString()} ₫</span>
                   <div className="h-8 w-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                      <TrendingUp size={14} className="text-emerald-500" />
                   </div>
                </div>
             </div>
             <div className="h-10 w-px bg-slate-800"></div>
             <div className="flex items-center gap-4">
                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Online</span>
             </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
           <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"></div>
           
           <div className="max-w-[1600px] mx-auto">
              {activeTab === 'analyst' && <AnalystPage activeTicker={activeTicker} />}
              {activeTab === 'investment' && <InvestmentPage activeTicker={activeTicker} />}
              {activeTab === 'trader' && <TraderPage activeTicker={activeTicker} />}
           </div>
           
           <div className="h-20"></div>
        </div>

        {/* BOTTOM TICKER TAPE */}
        <footer className="h-10 bg-black border-t border-slate-800 flex items-center px-10 overflow-hidden shrink-0">
           <div className="flex items-center gap-12 whitespace-nowrap animate-marquee">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-12 items-center">
                   {tickerTape.length > 0 ? tickerTape.map((item) => (
                     <div key={item.ticker} className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.ticker}:</span>
                        <span className={`text-[10px] font-bold tabular-nums ${item.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {(item.price * 1000).toLocaleString()} ({item.change >= 0 ? '+' : ''}{item.change}%)
                        </span>
                     </div>
                   )) : (
                     <span className="text-[9px] font-bold text-slate-700 uppercase animate-pulse">Syncing Global Market Data...</span>
                   )}
                </div>
              ))}
           </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
