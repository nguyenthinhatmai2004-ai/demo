import type { BreakoutStatus, QuantStock } from '../data/quantData';

export const detectBreakoutStatus = (stock: QuantStock): BreakoutStatus => {
  const ratio = stock.volume / stock.avgVolume20;
  const distanceFromPivot = (stock.close - stock.pivot) / stock.pivot;

  if (stock.close < stock.support && ratio >= 1.5) return 'Breakdown';
  if (distanceFromPivot > 0.1) return 'Extended';
  if (stock.close > stock.pivot && ratio >= 2 && stock.changePct > 1.5) return 'Breakout Confirmed';
  if (stock.close > stock.pivot && ratio >= 1.5) return 'Ready to Buy';
  if (Math.abs(stock.close - stock.pivot) / stock.pivot <= 0.035 && stock.baseWeeks >= 3) return 'Near Pivot';
  if (stock.close > stock.ma50 && stock.close < stock.pivot && ratio < 1.1 && stock.baseWeeks >= 4) return 'Pullback Entry';
  if (stock.close > stock.pivot && ratio < 1) return 'False Breakout';
  if (stock.close < stock.ma200) return 'Avoid';
  return 'Near Pivot';
};

export const breakoutScoreFromStatus = (status: BreakoutStatus): number => {
  const scores: Record<BreakoutStatus, number> = {
    'Breakout Confirmed': 90,
    'Ready to Buy': 82,
    'Pullback Entry': 76,
    'Near Pivot': 66,
    Extended: 48,
    'False Breakout': 32,
    Breakdown: 18,
    Avoid: 20
  };
  return scores[status];
};
