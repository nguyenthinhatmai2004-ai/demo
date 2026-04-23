import React from 'react';

interface HistoryPoint {
  year: string;
  revenue: number;
  profit: number;
  margin: number;
}

interface ProprietaryFinancialChartProps {
  ticker: string;
  history: HistoryPoint[];
}

const ProprietaryFinancialChart: React.FC<ProprietaryFinancialChartProps> = ({ ticker, history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-3xl border border-white/5 min-h-[300px]">
        <div className="flex flex-col items-center gap-4">
           <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
           <span className="text-slate-600 text-[10px] uppercase font-black tracking-widest">Nạp dữ liệu tài chính: {ticker}...</span>
        </div>
      </div>
    );
  }

  const maxRev = Math.max(...history.map(h => h.revenue)) || 1;
  const maxProfit = Math.max(...history.map(h => h.profit)) || 1;

  return (
    <div className="w-full h-full flex flex-col gap-6 p-8 bg-gradient-to-br from-slate-900/80 to-black rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden min-h-[450px]">
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full"></div>
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <h3 className="text-[12px] font-black text-white uppercase tracking-[0.4em] mb-1">Financial Power Metrics</h3>
          <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest italic">{ticker} Strategic Growth</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-blue-500 rounded-sm shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase">Doanh thu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-emerald-500 rounded-sm shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase">Lợi nhuận</span>
          </div>
        </div>
      </div>

      {/* CHART CONTENT: Pure CSS for 100% reliability */}
      <div className="flex-1 flex items-end gap-6 pt-16 pb-4 relative z-10 border-b border-white/5">
        {history.map((h, i) => {
          // Scale Profit independently to make it visible but label it correctly
          // Added 5px minimum height to ensure visibility
          const revHeight = Math.max((h.revenue / maxRev) * 100, 2);
          const profitHeight = Math.max((h.profit / maxProfit) * 80, 2);

          return (
            <div key={i} className="flex-1 flex flex-col items-center h-full relative group">
              <div className="w-full flex items-end justify-center gap-2 h-full relative mb-4">
                
                {/* Revenue Column */}
                <div 
                  style={{ height: `${revHeight}%` }}
                  className="w-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm shadow-[0_0_15px_rgba(59,130,246,0.2)] relative transition-all duration-700 hover:from-blue-400"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-1 py-0.5 rounded border border-blue-500/20 z-20">
                    {h.revenue.toLocaleString()}
                  </div>
                </div>

                {/* Profit Column */}
                <div 
                  style={{ height: `${profitHeight}%` }}
                  className="w-4 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] relative transition-all duration-700 delay-100 hover:from-emerald-400"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-1 py-0.5 rounded border border-emerald-500/20 z-20">
                    {h.profit.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-[10px] font-black text-white tabular-nums tracking-tighter">{h.year}</span>
                  <span className="text-[8px] font-black text-emerald-500/80 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 whitespace-nowrap">{h.margin}% biên</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2 relative z-10">
        <div className="p-3 bg-black/40 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1 leading-none">Doanh thu Peak</span>
          <span className="text-xs font-black text-blue-400 tabular-nums">{maxRev.toLocaleString()}B</span>
        </div>
        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-center hover:border-emerald-500/30 transition-colors">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1 leading-none">Hiệu suất Biên</span>
          <span className="text-xs font-black text-emerald-400 tabular-nums">Tăng trưởng</span>
        </div>
        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-right hover:border-white/20 transition-colors">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1 leading-none">Vị thế Ngành</span>
          <span className="text-xs font-black text-white tabular-nums">Leader AX</span>
        </div>
      </div>
    </div>
  );
};

export default ProprietaryFinancialChart;
