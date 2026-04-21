import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { ISeriesApi, IChartApi } from 'lightweight-charts';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8001/api';

interface CustomChartProps {
  ticker: string;
}

const calculateEMA = (data: any[], period: number) => {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let emaData = [];
  let ema = data[0].close;
  
  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    emaData.push({ time: data[i].time, value: ema });
  }
  return emaData;
};

const CustomChart: React.FC<CustomChartProps> = ({ ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  
  const [fullData, setFullData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1D' | '1Y' | '5Y' | 'ALL'>('ALL');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0c0f' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 1,
          labelBackgroundColor: '#2563eb',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 1,
          labelBackgroundColor: '#2563eb',
        },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });
    seriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const ema20 = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: 'EMA 20' });
    ema20Ref.current = ema20;

    const ema50 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, title: 'EMA 50' });
    ema50Ref.current = ema50;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let url = `${API_BASE}/market/history/${ticker}`;
        if (timeframe === '1D') {
          url = `${API_BASE}/market/intraday/${ticker}`;
        }
        const res = await axios.get(url);
        // Fallback: If 1D is empty, try loading history instead of showing nothing
        if ((!res.data || res.data.length === 0) && timeframe === '1D') {
            const histRes = await axios.get(`${API_BASE}/market/history/${ticker}`);
            setFullData(histRes.data || []);
        } else {
            setFullData(res.data || []);
        }
      } catch (error) {
        console.error('Failed to load chart data:', error);
        setFullData([]);
      }
    };
    fetchData();
  }, [ticker, timeframe]);

  useEffect(() => {
    if (fullData.length === 0 || !seriesRef.current) return;

    let filteredData = [...fullData];
    
    if (timeframe !== '1D') {
      const now = new Date();
      if (timeframe === '1Y') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        filteredData = fullData.filter(d => new Date(d.time) >= oneYearAgo);
      } else if (timeframe === '5Y') {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(now.getFullYear() - 5);
        filteredData = fullData.filter(d => new Date(d.time) >= fiveYearsAgo);
      }
    }

    const candleData = filteredData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = filteredData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));

    seriesRef.current.setData(candleData);
    volumeSeriesRef.current?.setData(volumeData);
    
    const ema20Data = calculateEMA(candleData, 20);
    const ema50Data = calculateEMA(candleData, 50);
    
    ema20Ref.current?.setData(ema20Data);
    ema50Ref.current?.setData(ema50Data);
    
    chartRef.current?.timeScale().fitContent();
  }, [fullData]);

  return (
    <div className="w-full h-full relative group">
      <div className="absolute top-4 right-4 z-20 flex bg-gray-900/80 border border-gray-700 rounded-lg p-1 shadow-2xl backdrop-blur-md">
        {(['1D', '1Y', '5Y', 'ALL'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${
              timeframe === tf 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      
      <div 
        ref={chartContainerRef} 
        className="w-full h-full absolute inset-0"
      />
      
      <div className="absolute bottom-4 left-4 text-white/5 font-black text-6xl pointer-events-none select-none z-0 italic tracking-tighter">
        FIRE-X
      </div>
    </div>
  );
};

export default CustomChart;
