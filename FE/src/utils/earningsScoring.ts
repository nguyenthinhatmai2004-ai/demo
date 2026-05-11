import type { QuantStock } from '../data/quantData';

export const calculateEarningsSurpriseScore = (stock: QuantStock): number => {
  const e = stock.earnings;
  let score = 35;
  if (e.profitGrowthYoY > 25) score += 15;
  if (e.profitGrowthYoY > 50) score += 12;
  if (e.profitGrowthYoY > 100) score += 10;
  if (e.revenueGrowthYoY > 20) score += 12;
  if (e.grossMarginChange > 0) score += 8;
  if (e.netMarginChange > 0) score += 8;
  if (e.epsGrowthYoY > 25) score += 8;
  if (e.coreBusinessQuality === 'High Quality') score += 12;
  if (e.coreBusinessQuality === 'Low Quality') score -= 18;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const earningsQualityLabel = (stock: QuantStock): string => {
  const score = calculateEarningsSurpriseScore(stock);
  if (score >= 85) return 'Earnings explosion chất lượng cao';
  if (score >= 70) return 'Strong catalyst';
  if (score >= 55) return 'Cần xác nhận thêm';
  return 'Không phải catalyst mạnh';
};
