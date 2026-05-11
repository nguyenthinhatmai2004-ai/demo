import type { QuantStock, VolumeSignal } from '../data/quantData';

export const detectVolumeExplosion = (stock: QuantStock): string => {
  const ratio = stock.volume / stock.avgVolume20;
  if (ratio >= 3) return 'Extreme Volume Explosion';
  if (ratio >= 2) return 'Strong Volume Explosion';
  if (ratio >= 1.5) return 'Volume Explosion';
  return 'Normal Volume';
};

export const detectAccumulationDistribution = (stock: QuantStock): VolumeSignal => {
  const ratio = stock.volume / stock.avgVolume20;
  if (stock.changePct > 2 && stock.close > stock.pivot && ratio >= 2) return 'Breakout Volume';
  if (stock.changePct > 0 && ratio >= 1.5 && stock.cmf > 0) return 'Accumulation';
  if (stock.changePct < -2 && ratio >= 2) return 'Distribution';
  if (stock.changePct > 3.5 && ratio >= 3) return 'Climax Volume';
  if (ratio < 0.7 && stock.baseWeeks >= 4) return 'Dry-up Volume';
  if (stock.changePct > 0 && ratio < 0.8) return 'Weak Volume';
  return 'No Signal';
};

export const calculateVolumeScore = (stock: QuantStock): number => {
  const ratio = stock.volume / stock.avgVolume20;
  const signal = detectAccumulationDistribution(stock);
  if (signal === 'Distribution') return 25;
  if (signal === 'Climax Volume') return 62;
  if (signal === 'Breakout Volume') return Math.min(100, Math.round(78 + ratio * 6));
  if (signal === 'Accumulation') return Math.min(88, Math.round(62 + ratio * 10));
  if (signal === 'Dry-up Volume') return 58;
  if (signal === 'Weak Volume') return 42;
  return Math.max(45, Math.min(70, Math.round(48 + ratio * 10)));
};
