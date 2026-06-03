import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  Gauge,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Target,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import type { AIAction, BreakoutStatus, ClosedTrade, DemoPosition, QuantStock } from '../data/quantData';
import { detectBreakoutStatus } from '../utils/breakoutEngine';
import { calculateTrendScore, detectTrendStructure } from '../utils/cmtTrendEngine';
import { calculateEarningsSurpriseScore, earningsQualityLabel } from '../utils/earningsScoring';
import { calculateNewsCatalystScore, summarizeNewsImpact } from '../utils/newsScoring';
import { simulateBuyOrder, simulateSellOrder } from '../utils/orderSimulator';
import { calculatePerformanceMetrics, calculatePortfolioMetrics, generateTradeJournalEntry, runBacktest } from '../utils/portfolioEngine';
import { calculateAIQuantScore, calculateTechnicalScore, classifyAIQuantScore, generateAIExplanation, generateAITradingAction } from '../utils/quantScoring';
import { calculatePositionSize, calculateRiskRewardScore, generateStopLoss, generateTrailingStop, riskRulesForStock } from '../utils/riskManagement';
import { calculateVolumeScore, detectAccumulationDistribution, detectVolumeExplosion } from '../utils/volumeEngine';

const API_BASE = 'http://127.0.0.1:8011/api';

interface QuantDashboardData {
  stocks: QuantStock[];
  positions: DemoPosition[];
  closedTrades: ClosedTrade[];
  marketUniverseSummary: {
    hose: number;
    hnx: number;
    upcom: number;
    scanned: string;
    mode: string;
  };
}

const emptyDashboard: QuantDashboardData = {
  stocks: [],
  positions: [],
  closedTrades: [],
  marketUniverseSummary: { hose: 0, hnx: 0, upcom: 0, scanned: 'Loading backend API', mode: 'Loading' }
};

const DISCLAIMER =
  'AI Quant chỉ phục vụ phân tích, mô phỏng và paper trading. Đây không phải khuyến nghị đầu tư. Không có chiến lược nào đảm bảo lợi nhuận. Cần quản trị rủi ro, kiểm chứng dữ liệu và xác nhận thủ công trước khi giao dịch bằng tiền thật.';

const actionClass = (action: AIAction) => {
  if (action === 'Buy') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (action === 'Watch') return 'bg-blue-500/10 text-blue-300 border-blue-500/25';
  if (action === 'Hold') return 'bg-slate-500/10 text-slate-300 border-slate-500/25';
  if (action === 'Sell') return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
  return 'bg-red-950/50 text-red-300 border-red-500/25';
};

const statusClass = (status: string) => {
  if (status.includes('Breakout') || status.includes('Ready') || status.includes('Pullback')) return 'bg-violet-500/10 text-violet-200 border-violet-500/25';
  if (status.includes('Breakdown') || status.includes('False') || status.includes('Avoid')) return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
  if (status.includes('Near')) return 'bg-blue-500/10 text-blue-300 border-blue-500/25';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/25';
};

const money = (value: number) => value.toLocaleString('vi-VN');

const target1For = (stock: QuantStock) => {
  const stopLoss = generateStopLoss(stock.close, stock.atr14);
  return Math.round(stock.close + (stock.close - stopLoss) * 2.4);
};

const target2For = (stock: QuantStock) => {
  const stopLoss = generateStopLoss(stock.close, stock.atr14);
  return Math.round(stock.close + (stock.close - stopLoss) * 3.6);
};

export const QuantMarketOverview: React.FC<{ dashboard: QuantDashboardData }> = ({ dashboard }) => {
  const metrics = calculatePortfolioMetrics(dashboard.positions, dashboard.closedTrades);
  const buyCount = dashboard.stocks.filter((stock) => generateAITradingAction(stock) === 'Buy').length;
  const watchCount = dashboard.stocks.filter((stock) => generateAITradingAction(stock) === 'Watch').length;
  return (
    <section className="terminal-card p-7 rounded-2xl">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-cyan-300 uppercase">Backend Live API</p>
          <h2 className="mt-2 text-3xl md:text-5xl font-black text-white">AI Quant Paper Trading System</h2>
          <p className="mt-4 max-w-4xl text-sm text-slate-400 leading-relaxed">
            Scanner thiết kế cho HOSE, HNX và UPCOM. Universe, giá, volume và chỉ báo được tải từ backend.
            AI chỉ tự giao dịch trong paper portfolio, live trading mặc định tắt.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 min-w-0 xl:min-w-[760px]">
          {[
            ['Universe', dashboard.marketUniverseSummary.scanned, `${dashboard.marketUniverseSummary.hose + dashboard.marketUniverseSummary.hnx + dashboard.marketUniverseSummary.upcom} mã`],
            ['Mode', 'Paper Trading', 'Live disabled'],
            ['NAV', `${money(metrics.nav)} ₫`, `${metrics.totalReturn}%`],
            ['Buy / Watch', `${buyCount} / ${watchCount}`, 'AI scan'],
            ['Risk Mode', metrics.maxDrawdown < -8 ? 'Reduced Size' : 'Normal', `${metrics.maxDrawdown}% DD`]
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-black/25 p-4">
              <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-black text-white">{value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const SignalScanner: React.FC<{ stocks: QuantStock[]; onSelect: (stock: QuantStock) => void }> = ({ stocks, onSelect }) => {
  const top = [...stocks].sort((a, b) => calculateAIQuantScore(b) - calculateAIQuantScore(a)).slice(0, 5);
  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center gap-3 text-emerald-300">
        <Zap size={18} />
        <h3 className="font-black text-sm">Signal Scanner</h3>
      </div>
      {top.map((stock) => (
        <button key={stock.ticker} onClick={() => onSelect(stock)} className="rounded-xl border border-slate-800 bg-black/20 p-4 text-left hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black text-white">{stock.ticker}</span>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${actionClass(generateAITradingAction(stock))}`}>{generateAITradingAction(stock)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{generateAIExplanation(stock)}</p>
        </button>
      ))}
    </section>
  );
};

export const VolumeExplosionScanner: React.FC<{ stocks: QuantStock[] }> = ({ stocks }) => {
  const rows = [...stocks].sort((a, b) => b.volume / b.avgVolume20 - a.volume / a.avgVolume20).slice(0, 6);
  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center gap-3 text-orange-300">
        <BarChart3 size={18} />
        <h3 className="font-black text-sm">Volume Explosion Scanner</h3>
      </div>
      {rows.map((stock) => (
        <div key={stock.ticker} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-xl border border-slate-800 bg-black/20 p-3">
          <span className="font-black text-white">{stock.ticker}</span>
          <div>
            <p className="text-xs text-slate-300">{detectVolumeExplosion(stock)} - {detectAccumulationDistribution(stock)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-orange-400" style={{ width: `${Math.min(100, (stock.volume / stock.avgVolume20) * 35)}%` }} />
            </div>
          </div>
          <span className="text-sm font-black text-orange-300">{(stock.volume / stock.avgVolume20).toFixed(2)}x</span>
        </div>
      ))}
    </section>
  );
};

export const CMTTrendEngine: React.FC<{ stock: QuantStock }> = ({ stock }) => (
  <section className="terminal-card p-6 rounded-2xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-blue-300">
        <TrendingUp size={18} />
        <h3 className="font-black text-sm">CMT Trend Engine</h3>
      </div>
      <span className="text-2xl font-black text-white">{calculateTrendScore(stock)}</span>
    </div>
    <p className="mt-3 text-lg font-black text-blue-200">{stock.ticker}: {detectTrendStructure(stock)}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
      {[
        ['Giá > MA50', stock.close > stock.ma50 ? 'Có' : 'Không'],
        ['Giá > MA200', stock.close > stock.ma200 ? 'Có' : 'Không'],
        ['MA50 > MA200', stock.ma50 > stock.ma200 ? 'Có' : 'Không'],
        ['RS vs VN-Index', `${stock.relativeStrengthVNIndex}/100`]
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg bg-black/25 border border-slate-800 p-3">
          <p className="text-slate-500">{label}</p>
          <p className="font-black text-white">{value}</p>
        </div>
      ))}
    </div>
  </section>
);

export const BreakoutEngine: React.FC<{ stock: QuantStock }> = ({ stock }) => {
  const status = detectBreakoutStatus(stock);
  return (
    <section className="terminal-card p-6 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-violet-300">
          <Target size={18} />
          <h3 className="font-black text-sm">Breakout Engine</h3>
        </div>
        <span className={`rounded-md border px-3 py-1 text-[10px] font-black ${statusClass(status)}`}>{status}</span>
      </div>
      <p className="mt-4 text-xs text-slate-300 leading-relaxed">
        Pivot {money(stock.pivot)}, kháng cự {money(stock.resistance)}, hỗ trợ {money(stock.support)}. Breakout chỉ hợp lệ khi giá đóng cửa vượt pivot, volume xác nhận và risk/reward tối thiểu 2:1.
      </p>
    </section>
  );
};

export const NewsCatalystEngine: React.FC<{ stock: QuantStock }> = ({ stock }) => (
  <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-cyan-300">
        <Eye size={18} />
        <h3 className="font-black text-sm">News Catalyst Engine</h3>
      </div>
      <span className="text-xl font-black text-cyan-200">{calculateNewsCatalystScore(stock)}</span>
    </div>
    {stock.news.map((item) => (
      <div key={item.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
        <p className="text-[10px] font-black uppercase text-slate-500">{item.source} / {item.category}</p>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{summarizeNewsImpact(item)}</p>
      </div>
    ))}
  </section>
);

export const EarningsSurpriseEngine: React.FC<{ stock: QuantStock }> = ({ stock }) => (
  <section className="terminal-card p-6 rounded-2xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-amber-300">
        <Gauge size={18} />
        <h3 className="font-black text-sm">Earnings Surprise Engine</h3>
      </div>
      <span className="text-xl font-black text-amber-200">{calculateEarningsSurpriseScore(stock)}</span>
    </div>
    <p className="mt-3 text-sm font-black text-white">{earningsQualityLabel(stock)}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
      {[
        ['LNST YoY', `${stock.earnings.profitGrowthYoY}%`],
        ['Doanh thu YoY', `${stock.earnings.revenueGrowthYoY}%`],
        ['EPS YoY', `${stock.earnings.epsGrowthYoY}%`],
        ['Quality', stock.earnings.coreBusinessQuality]
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg bg-black/25 border border-slate-800 p-3">
          <p className="text-slate-500">{label}</p>
          <p className="font-black text-white">{value}</p>
        </div>
      ))}
    </div>
  </section>
);

export const AITradingBrain: React.FC<{ stock: QuantStock }> = ({ stock }) => {
  const action = generateAITradingAction(stock);
  const score = calculateAIQuantScore(stock);
  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-emerald-300">
          <Brain size={18} />
          <h3 className="font-black text-sm">AI Trading Brain</h3>
        </div>
        <span className={`rounded-md border px-3 py-1 text-[10px] font-black ${actionClass(action)}`}>{action}</span>
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold">AI Quant Score</p>
        <p className="text-5xl font-black text-white">{score}<span className="text-lg text-slate-500">/100</span></p>
        <p className="mt-1 text-xs text-slate-400">{classifyAIQuantScore(score)}</p>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{generateAIExplanation(stock)}</p>
    </section>
  );
};

export const DemoPortfolio: React.FC<{ positions: DemoPosition[]; closedTrades: ClosedTrade[] }> = ({ positions, closedTrades }) => {
  const metrics = calculatePortfolioMetrics(positions, closedTrades);
  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center gap-3 text-emerald-300">
        <Shield size={18} />
        <h3 className="font-black text-sm">Demo Portfolio</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ['NAV', `${money(metrics.nav)} ₫`],
          ['Cash', `${money(metrics.cash)} ₫`],
          ['Equity', `${money(metrics.equityValue)} ₫`],
          ['Daily PnL', `${money(metrics.dailyPnl)} ₫`],
          ['Win Rate', `${metrics.winRate}%`],
          ['Profit Factor', `${metrics.profitFactor}`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-3">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      {positions.map((position) => (
        <div key={position.ticker} className="rounded-xl border border-slate-800 bg-black/20 p-3 text-xs text-slate-300">
          <div className="flex justify-between">
            <span className="font-black text-white">{position.ticker}</span>
            <span className={(position.currentPrice - position.entryPrice) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {money((position.currentPrice - position.entryPrice) * position.quantity)} ₫
            </span>
          </div>
          <p className="mt-2">{position.aiReason}</p>
        </div>
      ))}
    </section>
  );
};

export const OrderSimulator: React.FC<{ stock: QuantStock }> = ({ stock }) => {
  const buyOrder = simulateBuyOrder(stock);
  const sellOrder = simulateSellOrder(stock);
  const order = generateAITradingAction(stock) === 'Sell' ? sellOrder : buyOrder;
  return (
    <section className="terminal-card p-6 rounded-2xl">
      <div className="flex items-center gap-3 text-blue-300">
        <CheckCircle2 size={18} />
        <h3 className="font-black text-sm">Order Simulator</h3>
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-4 text-xs text-slate-300">
        <p className="font-black text-white">{order.orderId} / {order.status}</p>
        <p className="mt-2">{order.action} {order.quantity.toLocaleString('vi-VN')} {order.ticker} @ {money(order.price)}</p>
        <p>Stop: {money(order.stopLoss)} / Target: {money(order.target)} / Confidence: {order.confidenceScore}</p>
        <p className="mt-2 text-slate-400">{order.reason}</p>
      </div>
      <p className="mt-3 text-[11px] text-amber-300">Không gửi lệnh thật. Chỉ paper trading.</p>
    </section>
  );
};

export const RiskManagementEngine: React.FC<{ stock: QuantStock }> = ({ stock }) => (
  <section className="terminal-card p-6 rounded-2xl">
    <div className="flex items-center gap-3 text-rose-300">
      <AlertTriangle size={18} />
      <h3 className="font-black text-sm">Risk Management Engine</h3>
    </div>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {riskRulesForStock(stock).map((rule) => (
        <div key={rule} className="rounded-xl border border-slate-800 bg-black/20 p-3 text-xs text-slate-300">{rule}</div>
      ))}
    </div>
  </section>
);

export const TradeJournal: React.FC<{ closedTrades: ClosedTrade[] }> = ({ closedTrades }) => (
  <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
    <h3 className="font-black text-sm text-white">Trade Journal</h3>
    {closedTrades.map((trade) => (
      <div key={`${trade.ticker}-${trade.exit}`} className="rounded-xl border border-slate-800 bg-black/20 p-4">
        <div className="flex justify-between text-sm">
          <span className="font-black text-white">{trade.ticker} / {trade.setupType}</span>
          <span className={trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{money(trade.pnl)} ₫</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">{generateTradeJournalEntry(trade)}</p>
      </div>
    ))}
  </section>
);

export const BacktestPanel: React.FC = () => {
  const result = runBacktest();
  return (
    <section className="terminal-card p-6 rounded-2xl">
      <h3 className="font-black text-sm text-white">Backtest Panel</h3>
      <p className="mt-2 text-xs text-slate-500">Preset: {result.strategy} / Backend paper-trading model</p>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['CAGR', `${result.cagr}%`],
          ['Total Return', `${result.totalReturn}%`],
          ['Max DD', `${result.maxDrawdown}%`],
          ['Win Rate', `${result.winRate}%`],
          ['Profit Factor', `${result.profitFactor}`],
          ['Sharpe', `${result.sharpe}`],
          ['Trades', `${result.numberOfTrades}`],
          ['Expectancy', `${result.expectancy}%`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-3">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const StrategyBuilder: React.FC = () => (
  <section className="terminal-card p-6 rounded-2xl">
    <h3 className="font-black text-sm text-white">AI Strategy Builder</h3>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {[
        ['Volume Breakout', 'Trend > 65, vượt pivot, volume > 2x Avg20, AI Quant > 75.'],
        ['Earnings Surprise Momentum', 'LNST > 50% YoY, quality tốt, giá và volume xác nhận.'],
        ['Pullback to MA50', 'Uptrend, kéo về MA50, volume giảm, bật lại với volume tăng.'],
        ['Defensive Mode', 'VN-Index dưới MA200 hoặc drawdown > 12%, dừng mua mới.']
      ].map(([name, rule]) => (
        <div key={name} className="rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-blue-200">{name}</p>
          <p className="mt-2 text-xs text-slate-400">{rule}</p>
        </div>
      ))}
    </div>
  </section>
);

export const WatchlistRankingTable: React.FC<{ stocks: QuantStock[]; onSelect: (stock: QuantStock) => void }> = ({ stocks, onSelect }) => {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('Tất cả');
  const [action, setAction] = useState('Tất cả');
  const [breakout, setBreakout] = useState('Tất cả');
  const [volumeOnly, setVolumeOnly] = useState(false);
  const [earningsOnly, setEarningsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('ai');
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => {
    const value = (stock: QuantStock) => {
      if (sortBy === 'volume') return stock.volume / stock.avgVolume20;
      if (sortBy === 'earnings') return calculateEarningsSurpriseScore(stock);
      return calculateAIQuantScore(stock);
    };
    return stocks
      .filter((stock) => stock.ticker.includes(query.toUpperCase()) || stock.company.toLowerCase().includes(query.toLowerCase()))
      .filter((stock) => sector === 'Tất cả' || stock.sector === sector)
      .filter((stock) => action === 'Tất cả' || generateAITradingAction(stock) === action)
      .filter((stock) => breakout === 'Tất cả' || detectBreakoutStatus(stock) === breakout)
      .filter((stock) => !volumeOnly || stock.volume / stock.avgVolume20 >= 1.5)
      .filter((stock) => !earningsOnly || calculateEarningsSurpriseScore(stock) >= 70)
      .sort((a, b) => value(b) - value(a));
  }, [action, breakout, earningsOnly, query, sector, sortBy, stocks, volumeOnly]);

  const exportCsv = () => {
    const csv = [
      'Rank,Ticker,Company,Sector,AI Quant Score,AI Action,Breakout,VolumeRatio,Earnings',
      ...rows.map((stock, index) => `${index + 1},${stock.ticker},${stock.company},${stock.sector},${calculateAIQuantScore(stock)},${generateAITradingAction(stock)},${detectBreakoutStatus(stock)},${(stock.volume / stock.avgVolume20).toFixed(2)},${calculateEarningsSurpriseScore(stock)}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ai-quant-ranking.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const refreshData = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 500);
  };

  const sectors = ['Tất cả', ...Array.from(new Set(stocks.map((stock) => stock.sector)))];
  const actions: Array<'Tất cả' | AIAction> = ['Tất cả', 'Buy', 'Watch', 'Hold', 'Sell', 'Avoid'];
  const breakouts: Array<'Tất cả' | BreakoutStatus> = ['Tất cả', 'Ready to Buy', 'Near Pivot', 'Breakout Confirmed', 'Pullback Entry', 'Extended', 'False Breakout', 'Breakdown', 'Avoid'];

  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white">AI Quant Ranking</h3>
          <p className="text-xs text-slate-500">Quét HOSE, HNX, UPCOM qua backend API.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold text-slate-200">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={refreshData} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã" className="w-full rounded-xl border border-slate-800 bg-black/30 py-3 pl-10 pr-3 text-xs text-white" />
        </div>
        <select value={sector} onChange={(event) => setSector(event.target.value)} className="rounded-xl border border-slate-800 bg-black/30 px-3 py-3 text-xs text-white">{sectors.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={action} onChange={(event) => setAction(event.target.value)} className="rounded-xl border border-slate-800 bg-black/30 px-3 py-3 text-xs text-white">{actions.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={breakout} onChange={(event) => setBreakout(event.target.value)} className="rounded-xl border border-slate-800 bg-black/30 px-3 py-3 text-xs text-white">{breakouts.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-slate-800 bg-black/30 px-3 py-3 text-xs text-white">
          <option value="ai">Sort AI Quant</option>
          <option value="volume">Sort Volume / Avg20</option>
          <option value="earnings">Sort Earnings</option>
        </select>
        <button onClick={() => setVolumeOnly((value) => !value)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${volumeOnly ? 'border-orange-500/40 bg-orange-500/10 text-orange-200' : 'border-slate-800 bg-black/30 text-slate-400'}`}>Volume &gt; 1.5x</button>
        <button onClick={() => setEarningsOnly((value) => !value)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${earningsOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-black/30 text-slate-400'}`}>Lãi đột biến</button>
      </div>

      {loading ? <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-200">Đang refresh scanner demo...</div> : (
        <div className="overflow-x-auto max-h-[620px] custom-scrollbar">
          <table className="w-full min-w-[2200px] text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-slate-950">
              <tr className="text-[10px] font-black text-slate-500">
                {['Rank', 'Ticker', 'Company', 'Sector', 'Price', 'Change %', 'Volume / Avg20', 'Trend Score', 'Volume Score', 'Breakout Status', 'Technical Score', 'News Catalyst Score', 'Earnings Surprise Score', 'AI Quant Score', 'AI Action', 'Suggested Entry', 'Stop Loss', 'Target 1', 'Target 2', 'Risk/Reward', 'Position Size', 'Portfolio Status', 'Last News', 'Last Updated'].map((head) => (
                  <th key={head} className="border-b border-slate-800 px-3 py-3 whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((stock, index) => {
                const stop = generateStopLoss(stock.close, stock.atr14);
                const target1 = target1For(stock);
                const rrScore = calculateRiskRewardScore(stock.close, stop, target1);
                return (
                  <tr key={stock.ticker} className="hover:bg-slate-900/60">
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-400">#{index + 1}</td>
                    <td className="border-b border-slate-900 px-3 py-4"><button onClick={() => onSelect(stock)} className="font-black text-blue-300 hover:text-white">{stock.ticker}</button></td>
                    <td className="border-b border-slate-900 px-3 py-4 text-white font-bold">{stock.company}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-300">{stock.sector}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-white">{money(stock.close)}</td>
                    <td className={`border-b border-slate-900 px-3 py-4 ${stock.changePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{stock.changePct >= 0 ? '+' : ''}{stock.changePct}%</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-orange-300 font-black">{(stock.volume / stock.avgVolume20).toFixed(2)}x</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-blue-300 font-black">{calculateTrendScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-orange-300 font-black">{calculateVolumeScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4"><span className={`rounded-md border px-2 py-1 text-[10px] ${statusClass(detectBreakoutStatus(stock))}`}>{detectBreakoutStatus(stock)}</span></td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-200 font-black">{calculateTechnicalScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-cyan-300 font-black">{calculateNewsCatalystScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-amber-300 font-black">{calculateEarningsSurpriseScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-white font-black">{calculateAIQuantScore(stock)}</td>
                    <td className="border-b border-slate-900 px-3 py-4"><span className={`rounded-md border px-2 py-1 text-[10px] font-black ${actionClass(generateAITradingAction(stock))}`}>{generateAITradingAction(stock)}</span></td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-300">{money(stock.close)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-rose-300">{money(stop)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-emerald-300">{money(target1)}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-emerald-300">{money(target2For(stock))}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-300">{rrScore}/100</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-300">{calculatePositionSize(1_000_000_000, stock.close, stop).toLocaleString('vi-VN')} cp</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-300">{stock.currentPosition ? 'Open Position' : 'No Position'}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-400 max-w-[260px]">{stock.news[0]?.title ?? 'No news'}</td>
                    <td className="border-b border-slate-900 px-3 py-4 text-slate-500">{stock.news[0]?.publishedAt ?? 'Backend API'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const AlertCenter: React.FC<{ stocks: QuantStock[]; onSelect: (stock: QuantStock) => void }> = ({ stocks, onSelect }) => {
  const alerts = stocks.flatMap((stock) => {
    const list = [];
    if (stock.volume / stock.avgVolume20 > 2) list.push(['Volume đột biến > 2x Avg20', 'High', 'Kiểm tra breakout và phân phối.']);
    if (detectBreakoutStatus(stock) === 'Breakout Confirmed') list.push(['Breakout confirmed', 'High', 'Có thể xem xét paper buy nếu hợp lưu đầy đủ.']);
    if (calculateEarningsSurpriseScore(stock) >= 75) list.push(['Tin lãi đột biến', 'Medium', 'Kiểm tra chất lượng lợi nhuận và phản ứng giá.']);
    if (calculateAIQuantScore(stock) > 75) list.push(['AI Quant Score vượt 75', 'High', 'Đưa vào danh sách ưu tiên.']);
    if (calculateAIQuantScore(stock) < 50) list.push(['AI Quant Score giảm dưới 50', 'Risk', 'Tránh mua mới hoặc giảm tỷ trọng nếu đang nắm giữ.']);
    return list.map(([type, severity, description]) => ({ stock, type, severity, description }));
  }).slice(0, 10);

  return (
    <section className="terminal-card p-6 rounded-2xl flex flex-col gap-4">
      <h3 className="font-black text-sm text-white">AI Quant Alert Center</h3>
      {alerts.map((alert) => (
        <button key={`${alert.stock.ticker}-${alert.type}`} onClick={() => onSelect(alert.stock)} className="rounded-xl border border-slate-800 bg-black/20 p-3 text-left hover:border-amber-500/40">
          <div className="flex justify-between">
            <span className="font-black text-white">{alert.stock.ticker} / {alert.type}</span>
            <span className="text-[10px] text-amber-300">{alert.severity}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
        </button>
      ))}
    </section>
  );
};

export const PerformanceAnalytics: React.FC<{ closedTrades: ClosedTrade[] }> = ({ closedTrades }) => {
  const metrics = calculatePerformanceMetrics(closedTrades);
  return (
    <section className="terminal-card p-6 rounded-2xl">
      <h3 className="font-black text-sm text-white">Performance Analytics</h3>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['CAGR', `${metrics.cagr}%`],
          ['Total Return', `${metrics.totalReturn}%`],
          ['Max Drawdown', `${metrics.maxDrawdown}%`],
          ['Win Rate', `${metrics.winRate}%`],
          ['Profit Factor', `${metrics.profitFactor}`],
          ['Expectancy', `${money(metrics.expectancy)} ₫`],
          ['Best Strategy', 'Earnings Momentum'],
          ['Worst Strategy', 'False Breakout']
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-3">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">AI đánh giá: chiến lược earnings momentum đang hiệu quả; cần tắt/giảm size các setup false breakout khi volume không xác nhận.</p>
    </section>
  );
};

export const HumanApprovalPanel: React.FC = () => (
  <section className="terminal-card p-6 rounded-2xl">
    <div className="flex items-center gap-3 text-rose-300">
      <Lock size={18} />
      <h3 className="font-black text-sm">Human Approval Panel</h3>
    </div>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="font-black text-emerald-200">Paper Trading</p>
        <p className="mt-2 text-xs text-slate-300">AI được tự mua/bán demo.</p>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <p className="font-black text-blue-200">Human Approval</p>
        <p className="mt-2 text-xs text-slate-300">AI đề xuất, người dùng duyệt trước khi có broker thật.</p>
      </div>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
        <p className="font-black text-rose-200">Live Trading Disabled</p>
        <p className="mt-2 text-xs text-slate-300">Không có lệnh thật nào được gửi tới broker.</p>
      </div>
    </div>
  </section>
);

export const StockSignalDetailDrawer: React.FC<{ stock: QuantStock | null; onClose: () => void }> = ({ stock, onClose }) => {
  if (!stock) return null;
  const stop = generateStopLoss(stock.close, stock.atr14);
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60">
      <aside className="h-full w-full max-w-2xl overflow-y-auto custom-scrollbar border-l border-slate-800 bg-slate-950 p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-slate-500 font-bold">{stock.exchange} / {stock.sector}</p>
            <h3 className="text-4xl font-black text-white">{stock.ticker}</h3>
            <p className="text-sm text-slate-400">{stock.company}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 p-3 text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            ['AI Quant Score', calculateAIQuantScore(stock)],
            ['AI Action', generateAITradingAction(stock)],
            ['Trend Score', calculateTrendScore(stock)],
            ['Volume Score', calculateVolumeScore(stock)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-4">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 h-28 rounded-xl border border-slate-800 bg-black/20 p-4">
          <div className="flex h-full items-end gap-2">
            {[stock.low, stock.ma200, stock.ma50, stock.ma20, stock.close, target1For(stock)].map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 rounded-t bg-blue-500/70" style={{ height: `${Math.max(18, Math.min(100, (value / target2For(stock)) * 100))}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CMTTrendEngine stock={stock} />
          <BreakoutEngine stock={stock} />
          <NewsCatalystEngine stock={stock} />
          <EarningsSurpriseEngine stock={stock} />
        </div>
        <div className="mt-6 rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-white">Suggested Trade Plan</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            {[
              ['Entry zone', `${money(stock.close)} - ${money(Math.round(stock.close * 1.03))}`],
              ['Stop loss', money(stop)],
              ['Target 1', money(target1For(stock))],
              ['Target 2', money(target2For(stock))],
              ['Trailing stop', money(generateTrailingStop(stock.close, stock.atr14))],
              ['Position size', `${calculatePositionSize(1_000_000_000, stock.close, stop).toLocaleString('vi-VN')} cp`],
              ['Invalid thesis', 'Thủng MA50/MA200, failed breakout hoặc tin xấu'],
              ['AI confidence', `${calculateAIQuantScore(stock)}/100`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-950/70 p-3">
                <p className="text-slate-500">{label}</p>
                <p className="font-black text-white">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-300">{generateAIExplanation(stock)}</p>
        </div>
        <OrderSimulator stock={stock} />
      </aside>
    </div>
  );
};

export const AIQuantPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [selectedStock, setSelectedStock] = useState<QuantStock | null>(null);
  const [dashboard, setDashboard] = useState<QuantDashboardData>(emptyDashboard);
  const activeStock = dashboard.stocks.find((stock) => stock.ticker === activeTicker.toUpperCase()) ?? dashboard.stocks[0];

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      try {
        const res = await axios.get(`${API_BASE}/quant/dashboard`);
        if (!cancelled) setDashboard({ ...emptyDashboard, ...res.data });
      } catch (error) {
        console.error('Failed to fetch quant dashboard', error);
      }
    };
    fetchDashboard();
    const interval = window.setInterval(fetchDashboard, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!activeStock) {
    return <div className="terminal-card p-6 text-sm text-slate-400">Loading backend market data...</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <QuantMarketOverview dashboard={dashboard} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SignalScanner stocks={dashboard.stocks} onSelect={setSelectedStock} />
        <div className="flex flex-col gap-6">
          <VolumeExplosionScanner stocks={dashboard.stocks} />
          <BreakoutEngine stock={activeStock} />
          <StrategyBuilder />
        </div>
        <div className="flex flex-col gap-6">
          <AITradingBrain stock={activeStock} />
          <DemoPortfolio positions={dashboard.positions} closedTrades={dashboard.closedTrades} />
          <AlertCenter stocks={dashboard.stocks} onSelect={setSelectedStock} />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CMTTrendEngine stock={activeStock} />
        <NewsCatalystEngine stock={activeStock} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <EarningsSurpriseEngine stock={activeStock} />
        <RiskManagementEngine stock={activeStock} />
      </div>
      <WatchlistRankingTable stocks={dashboard.stocks} onSelect={setSelectedStock} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TradeJournal closedTrades={dashboard.closedTrades} />
        <BacktestPanel />
      </div>
      <PerformanceAnalytics closedTrades={dashboard.closedTrades} />
      <HumanApprovalPanel />
      <footer className="rounded-2xl border border-slate-800 bg-black/30 p-5 text-xs text-slate-500 leading-relaxed">{DISCLAIMER}</footer>
      <StockSignalDetailDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
};

export default AIQuantPage;
