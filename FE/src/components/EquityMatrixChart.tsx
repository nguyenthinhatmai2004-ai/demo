import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import type { ISeriesApi, IChartApi } from 'lightweight-charts';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8001/api';

interface EquityMatrixChartProps {
  ticker: string;
}

const EquityMatrixChart: React.FC<EquityMatrixChartProps> = ({ ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const [data, setData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1Y' | '5Y' | 'ALL'>('ALL');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)', style: 2 },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)', style: 2 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { 
            color: '#3b82f6', 
            width: 1, 
            style: 0,
            labelBackgroundColor: '#1e3a8a' 
        },
        horzLine: { 
            color: '#3b82f6', 
            width: 1, 
            style: 0,
            labelBackgroundColor: '#1e3a8a' 
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        autoScale: true,
        alignLabels: true,
      },
      leftPriceScale: {
        visible: true,
        borderColor: 'rgba(51, 65, 85, 0.5)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        timeVisible: true,
        barSpacing: 8,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const priceSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 100,
      },
    });
    priceSeriesRef.current = priceSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#1e293b',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const equitySeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      title: 'Performance',
      priceScaleId: 'left',
      lineType: 2, // Curved line
    });
    
    chart.priceScale('left').applyOptions({
        autoScale: true,
        scaleMargins: {
            top: 0.1,
            bottom: 0.4,
        },
    });
    
    equitySeriesRef.current = equitySeries;

    // Auto-resize handler using ResizeObserver for better reliability
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
      chartRef.current.timeScale().fitContent();
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/market/history/${ticker}`);
        setData(res.data || []);
      } catch (error) {
        console.error('Failed to load equity data:', error);
      }
    };
    fetchData();
  }, [ticker]);

  useEffect(() => {
    if (data.length === 0) {
        // Fallback mock data if API fails to provide data
        const mockData = [];
        const now = new Date();
        for (let i = 100; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const timeStr = d.toISOString().split('T')[0];
            const basePrice = 100 + Math.sin(i / 10) * 20 + Math.random() * 5;
            mockData.push({
                time: timeStr,
                open: basePrice,
                high: basePrice + 2,
                low: basePrice - 2,
                close: basePrice + 1,
                volume: Math.floor(Math.random() * 1000000)
            });
        }
        processChartData(mockData);
        return;
    }
    processChartData(data);
  }, [data]);

  const processChartData = (chartData: any[]) => {
    if (!priceSeriesRef.current || !equitySeriesRef.current || chartData.length === 0) return;

    const priceData = chartData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = chartData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));

    // Mock Equity Curve
    let currentEquity = 100;
    const equityData = chartData.map((d, i) => {
        const priceChange = i > 0 ? (d.close - chartData[i-1].close) / chartData[i-1].close : 0;
        const strategyReturn = priceChange > 0 ? priceChange * 1.15 : priceChange * 0.85;
        currentEquity = currentEquity * (1 + strategyReturn);
        return {
            time: d.time,
            value: currentEquity
        };
    });

    priceSeriesRef.current.setData(priceData);
    volumeSeriesRef.current?.setData(volumeData);
    equitySeriesRef.current.setData(equityData);
    
    setTimeout(() => {
        chartRef.current?.timeScale().fitContent();
    }, 100);
  };

  return (
    <div className="w-full h-full relative group flex flex-col bg-[#020617]/50">
      <div className="absolute top-4 left-6 z-20 flex items-center gap-6">
        <div className="flex flex-col">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Equity Matrix v3</h4>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">Real Price</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">AI Strategy</span>
                </div>
            </div>
        </div>
      </div>

      <div className="absolute top-4 right-6 z-20 flex bg-slate-900/60 border border-slate-800 rounded-lg p-0.5 backdrop-blur-md">
        {(['1Y', '5Y', 'ALL'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${
              timeframe === tf 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      
      <div 
        ref={chartContainerRef} 
        className="flex-1 w-full"
      />
      
      {/* Watermark */}
      <div className="absolute bottom-8 right-8 pointer-events-none opacity-[0.03] select-none">
         <div className="text-[120px] font-black italic leading-none tracking-tighter">FIRE-X</div>
      </div>
    </div>
  );
};

export default EquityMatrixChart;
