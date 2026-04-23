import React from 'react';

interface FireAntChartProps {
  ticker: string;
}

const FireAntChart: React.FC<FireAntChartProps> = ({ ticker }) => {
  // FireAnt technical chart URL
  const chartUrl = `https://fireant.vn/charts?symbol=${ticker.toUpperCase()}`;

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col bg-black overflow-hidden rounded-xl border border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800"> 
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">FireAnt Technical Engine: {ticker.toUpperCase()}</span>
        </div>
        <a 
          href={chartUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
        >
          Mở trong tab mới
        </a>
      </div>
      
      <div className="flex-1 relative group">
        <iframe 
          src={chartUrl}
          className="w-full h-full border-none"
          title={`FireAnt Chart for ${ticker}`}
          allowFullScreen
        />
        
        {/* Overlay helper in case iframe is blocked by some browsers/policies */}
        <div className="absolute inset-0 pointer-events-none border border-blue-500/0 group-hover:border-blue-500/10 transition-all"></div>
      </div>
    </div>
  );
};

export default FireAntChart;
