import type { ClosedTrade, DemoPosition } from '../data/quantData';

export const updateDemoPortfolio = (positions: DemoPosition[], closedTrades: ClosedTrade[], initialCapital = 1_000_000_000) => {
  const equityValue = positions.reduce((sum, item) => sum + item.currentPrice * item.quantity, 0);
  const realizedPnl = closedTrades.reduce((sum, item) => sum + item.pnl, 0);
  const unrealizedPnl = positions.reduce((sum, item) => sum + (item.currentPrice - item.entryPrice) * item.quantity, 0);
  const reservedCash = positions.reduce((sum, item) => sum + item.entryPrice * item.quantity, 0);
  const cash = initialCapital - reservedCash + realizedPnl;
  const nav = cash + equityValue;
  return { cash, equityValue, realizedPnl, unrealizedPnl, nav };
};

export const calculatePortfolioMetrics = (positions: DemoPosition[], closedTrades: ClosedTrade[]) => {
  const base = updateDemoPortfolio(positions, closedTrades);
  const winners = closedTrades.filter((trade) => trade.pnl > 0);
  const losers = closedTrades.filter((trade) => trade.pnl < 0);
  const grossProfit = winners.reduce((sum, item) => sum + item.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, item) => sum + item.pnl, 0));
  const winRate = closedTrades.length ? Math.round((winners.length / closedTrades.length) * 100) : 0;
  const profitFactor = grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : 0;
  const expectancy = closedTrades.length ? Math.round(closedTrades.reduce((sum, item) => sum + item.pnl, 0) / closedTrades.length) : 0;
  const exposureBySector = positions.reduce<Record<string, number>>((acc, item) => {
    acc[item.sector] = (acc[item.sector] ?? 0) + item.currentPrice * item.quantity;
    return acc;
  }, {});

  return {
    ...base,
    totalReturn: Number((((base.nav - 1_000_000_000) / 1_000_000_000) * 100).toFixed(2)),
    dailyPnl: 8_400_000,
    maxDrawdown: -4.8,
    winRate,
    profitFactor,
    expectancy,
    exposureBySector,
    topWinners: [...closedTrades].sort((a, b) => b.pnl - a.pnl).slice(0, 2),
    topLosers: [...closedTrades].sort((a, b) => a.pnl - b.pnl).slice(0, 2)
  };
};

export const calculatePerformanceMetrics = (closedTrades: ClosedTrade[]) => ({
  cagr: 18.4,
  totalReturn: 12.7,
  maxDrawdown: -6.5,
  winRate: closedTrades.length ? Math.round((closedTrades.filter((trade) => trade.pnl > 0).length / closedTrades.length) * 100) : 0,
  profitFactor: 2.58,
  sharpe: 1.32,
  averageGain: 5.8,
  averageLoss: -3.1,
  expectancy: 2_276_000,
  numberOfTrades: closedTrades.length,
  bestTrade: closedTrades.length ? closedTrades.reduce((best, trade) => (trade.pnl > best.pnl ? trade : best), closedTrades[0]) : null,
  worstTrade: closedTrades.length ? closedTrades.reduce((worst, trade) => (trade.pnl < worst.pnl ? trade : worst), closedTrades[0]) : null
});

export const generateTradeJournalEntry = (trade: ClosedTrade): string => {
  if (trade.pnl >= 0) {
    return `Lệnh ${trade.ticker} có lãi vì setup ${trade.setupType} đi đúng hướng, volume xác nhận và kỷ luật chốt lời được tuân thủ.`;
  }
  return `Lệnh ${trade.ticker} thua lỗ vì setup ${trade.setupType} thất bại; bài học là giảm size khi tín hiệu breakout không được xác nhận.`;
};

export const runBacktest = () => ({
  strategy: 'Volume Breakout Strategy',
  cagr: 18.4,
  totalReturn: 42.8,
  maxDrawdown: -9.6,
  winRate: 57,
  profitFactor: 1.84,
  sharpe: 1.21,
  averageGain: 7.2,
  averageLoss: -3.8,
  expectancy: 1.9,
  numberOfTrades: 86,
  bestTrade: 'FPT +24.8%',
  worstTrade: 'VHM -7.8%',
  equityCurve: [100, 104, 102, 109, 116, 114, 123, 129, 142],
  drawdownCurve: [0, -1.2, -3.8, -0.9, -1.4, -4.6, -2.1, -1.0, -0.5]
});
