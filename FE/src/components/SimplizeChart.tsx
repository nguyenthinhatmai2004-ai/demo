import React from 'react';

interface SimplizeChartProps {
  ticker: string;
}

const SimplizeChart: React.FC<SimplizeChartProps> = ({ ticker }) => {
  // Widget URL của Simplize cho biểu đồ kỹ thuật hoặc tài chính
  // Chúng ta sử dụng iframe để nhúng trực tiếp dashboard của mã cổ phiếu
  const chartUrl = `https://simplize.vn/co-phieu/${ticker}/bieu-do`;

  return (
    <div className="w-full h-full min-h-[500px] rounded-[2rem] overflow-hidden border border-gray-800 bg-gray-950/40 relative group">
      <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
        <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Simplize Live Chart: {ticker}</span>
      </div>
      
      {/* 
        Lưu ý: Một số trang web có thể chặn iframe do chính sách X-Frame-Options.
        Trong trường hợp đó, Terminal sẽ cung cấp một link preview hoặc dashboard custom.
      */}
      <iframe 
        src={chartUrl}
        className="w-full h-full border-none grayscale-[0.2] contrast-[1.1] hover:grayscale-0 transition-all"
        title={`Financial Chart for ${ticker}`}
        allowFullScreen
      />
      
      <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <a 
          href={chartUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase shadow-xl"
        >
          Mở rộng tại Simplize
        </a>
      </div>
    </div>
  );
};

export default SimplizeChart;
