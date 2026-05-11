import type { QuantStock } from '../data/quantData';

export const detectTrendStructure = (stock: QuantStock): string => {
  if (
    stock.higherHighHigherLow &&
    stock.close > stock.ma50 &&
    stock.close > stock.ma200 &&
    stock.ma50 > stock.ma200 &&
    stock.ma200Slope !== 'Down'
  ) {
    return stock.relativeStrengthVNIndex >= 80 ? 'Strong Uptrend' : 'Uptrend';
  }

  if (stock.close < stock.ma50 && stock.close < stock.ma200 && stock.ma50 < stock.ma200 && stock.ma200Slope === 'Down') {
    return 'Downtrend';
  }

  if (Math.abs(stock.close - stock.ma50) / stock.close < 0.08 && stock.baseWeeks >= 3) {
    return 'Sideway / Accumulation';
  }

  return 'Weak Trend';
};

export const calculateTrendScore = (stock: QuantStock): number => {
  let score = 35;
  if (stock.higherHighHigherLow) score += 16;
  if (stock.close > stock.ma50) score += 12;
  if (stock.close > stock.ma200) score += 14;
  if (stock.ma50 > stock.ma200) score += 10;
  if (stock.ma200Slope === 'Up') score += 10;
  if (stock.relativeStrengthVNIndex > 70) score += 10;
  if (stock.close >= stock.ma20 || stock.close >= stock.ma50) score += 5;
  return Math.min(100, Math.max(0, score));
};
