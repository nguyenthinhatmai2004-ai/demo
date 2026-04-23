import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import axios from 'axios';
import { Cpu, Shield } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8001/api';

interface ProprietaryTechnicalChartProps {
  ticker: string;
}

const ProprietaryTechnicalChart: React.FC<ProprietaryTechnicalChartProps> = ({ ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. INITIALIZE NURAL GRAPHICS ENGINE (NATIVE)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#05070a' },
        textColor: '#64748b',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.01)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.01)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#3b82f6', labelBackgroundColor: '#2563eb' },
        horzLine: { color: '#3b82f6', labelBackgroundColor: '#2563eb' },
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.05)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.05)', timeVisible: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#f43f5e',
      borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#f43f5e',
    });

    const ema20 = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.6)', lineWidth: 1.5, title: 'EMA 20' });
    const ema50 = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.6)', lineWidth: 1.5, title: 'EMA 50' });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0.05 },
    });

    const rsiSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 1.5,
      title: 'RSI (14)',
      priceScaleId: 'rsi',
    });

    rsiSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.05 },
    });

    const macdSeries = chart.addHistogramSeries({
      color: '#f43f5e',
      title: 'MACD Hist',
      priceScaleId: 'macd',
    });

    macdSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.9, bottom: 0 },
    });

    // 2. NATIVE DATA FETCH & INDICATOR CALCULATION
    const loadNativeData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/market/history/${ticker}`);
        const rawData = res.data || [];
        
        if (rawData.length > 0) {
          const candleData = rawData.map((d: any) => ({
            time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
          }));

          const volumeData = rawData.map((d: any) => ({
            time: d.time, value: d.volume,
            color: d.close >= d.open ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
          }));

          candleSeries.setData(candleData);
          volumeSeries.setData(volumeData);

          const calculateEMA = (cData: any[], period: number) => {
            const k = 2 / (period + 1);
            let ema = cData[0].close;
            return cData.map(d => {
              ema = d.close * k + ema * (1 - k);
              return { time: d.time, value: ema };
            });
          };

          const calculateRSI = (cData: any[], period: number) => {
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
              const diff = cData[i].close - cData[i-1].close;
              if (diff >= 0) gains += diff; else losses -= diff;
            }
            let avgGain = gains / period, avgLoss = losses / period;
            
            return cData.map((d, i) => {
              if (i <= period) return { time: d.time, value: 50 };
              const diff = d.close - cData[i-1].close;
              avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
              avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
              const rs = avgGain / avgLoss;
              return { time: d.time, value: 100 - (100 / (1 + rs)) };
            });
          };

          const calculateMACD = (cData: any[]) => {
            const ema12 = calculateEMA(cData, 12);
            const ema26 = calculateEMA(cData, 26);
            return cData.map((d, i) => {
              const val = (ema12[i]?.value || 0) - (ema26[i]?.value || 0);
              return { time: d.time, value: val, color: val >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)' };
            });
          };

          ema20.setData(calculateEMA(candleData, 20));
          ema50.setData(calculateEMA(candleData, 50));
          rsiSeries.setData(calculateRSI(candleData, 14));
          macdSeries.setData(calculateMACD(candleData));
          
          chart.timeScale().fitContent();
        }
      } catch (e) {
        console.error("Neural Graphics Engine Error:", e);
      } finally {
        setLoading(false);
      }
    };

    loadNativeData();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ticker]);

  return (
    <div className="w-full h-full flex flex-col bg-[#05070a] overflow-hidden relative group border border-slate-800 rounded-3xl shadow-2xl">
      
      {/* 1. NEURAL COMMAND HEADER */}
      <div className="h-14 w-full bg-[#0a0c0f] border-b border-white/5 flex items-center px-6 justify-between z-30 shadow-lg relative">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
               <div className="flex flex-col">
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] leading-none">{ticker}.AX CORE</span>
                  <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Proprietary Native Engine v5.0</span>
               </div>
            </div>
            <div className="h-6 w-px bg-white/5"></div>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase">
               <span className="text-blue-400">MACD</span>
               <span className="text-emerald-400">RSI</span>
               <span className="text-orange-400">EMA</span>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-md flex items-center gap-2">
               <Cpu size={12} className="text-blue-500" />
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">AI Neural Logic</span>
            </div>
         </div>
      </div>

      {/* 2. THE PROPRIETARY CANVAS */}
      <div className="flex-1 w-full relative">
        <div ref={chartContainerRef} className="w-full h-full relative z-10" />
        
        {loading && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
               <div className="h-10 w-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] animate-pulse">Syncing Matrix Data...</span>
            </div>
          </div>
        )}

        {/* WATERMARK LABEL */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.03]">
           <span className="text-[160px] font-black text-white italic tracking-tighter uppercase leading-none">CORE</span>
        </div>
      </div>

      {/* 3. FOOTER TELEMETRY STATUS */}
      <div className="h-10 w-full bg-[#0a0c0f] border-t border-white/5 flex items-center px-6 justify-between z-30 relative">
         <div className="flex gap-4 items-center text-[8px] font-black text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
               <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
               <span>Protocol: Native-AX</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="h-1 w-1 rounded-full bg-blue-500"></span>
               <span>Logic: Synchronized</span>
            </div>
         </div>
         <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">NEURAL TERMINAL PRO © 2026</span>
      </div>

    </div>
  );
};

export default ProprietaryTechnicalChart;
