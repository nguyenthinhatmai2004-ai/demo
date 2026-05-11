import type { StrategicStock } from '../data/strategicData';

const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export const calculateMacroFitScore = (stock: StrategicStock): number => stock.macroFitScore;

export const calculateCANSLIMScore = (stock: StrategicStock): number =>
  average([stock.canslim.c, stock.canslim.a, stock.canslim.n, stock.canslim.s, stock.canslim.l, stock.canslim.i, stock.canslim.m]);

export const calculateSEPAScore = (stock: StrategicStock): number =>
  average([stock.sepa.trendTemplate, stock.sepa.baseQuality, stock.sepa.breakoutQuality, stock.sepa.riskReward]);

export const calculateCatalystScore = (stock: StrategicStock): number => stock.catalystScore;

export const calculateRelativeStrengthScore = (stock: StrategicStock): number => stock.relativeStrengthScore;

export const calculateLiquidityScore = (stock: StrategicStock): number => stock.liquidityScore;

export const calculateRiskRewardScore = (stock: StrategicStock): number => stock.riskRewardScore;

export const calculateTotalAlphaScore = (stock: StrategicStock): number => {
  const total =
    0.2 * calculateMacroFitScore(stock) +
    0.2 * calculateCANSLIMScore(stock) +
    0.2 * calculateSEPAScore(stock) +
    0.15 * calculateCatalystScore(stock) +
    0.1 * calculateRelativeStrengthScore(stock) +
    0.1 * calculateLiquidityScore(stock) +
    0.05 * calculateRiskRewardScore(stock);
  return Math.round(total);
};

export const classifyAlphaScore = (score: number): string => {
  if (score >= 85) return 'Strong Buy Setup';
  if (score >= 70) return 'Watchlist';
  if (score >= 55) return 'Wait for Confirmation';
  if (score >= 40) return 'Weak Setup';
  return 'Avoid';
};

export const generateAIVerdict = (stock: StrategicStock): string => {
  const total = calculateTotalAlphaScore(stock);
  const label = classifyAlphaScore(total);
  if (label === 'Strong Buy Setup') return 'Ưu tiên cao, chỉ giải ngân trong vùng mua và tuân thủ stop loss.';
  if (label === 'Watchlist') return 'Theo dõi sát pivot, cần volume xác nhận trước khi mua.';
  if (label === 'Wait for Confirmation') return 'Chờ xác nhận xu hướng, không mua sớm.';
  if (label === 'Weak Setup') return 'Setup yếu, giảm ưu tiên vốn.';
  return 'Tránh mua mới.';
};

export const getCatalystBadges = (ticker: string, sector: string): string[] => {
  const badges: string[] = [];
  if (['VIC', 'VHM', 'HPG', 'FPT', 'MSN', 'VCB', 'SSI', 'VNM', 'SAB'].includes(ticker)) badges.push('Nâng hạng / ETF');
  if (sector.includes('Công nghệ')) badges.push('AI', 'Chuyển đổi số');
  if (sector.includes('Chứng khoán')) badges.push('Thanh khoản', 'Margin phục hồi');
  if (sector.includes('Ngân hàng')) badges.push('GDP tăng', 'CASA');
  if (sector.includes('Vật liệu')) badges.push('Đầu tư công', 'Chu kỳ thép');
  if (sector.includes('Bất động sản')) badges.push('Pháp lý', 'Lãi suất hỗ trợ');
  if (sector.includes('Tiêu dùng')) badges.push('Sức mua', 'Tái cấu trúc');
  return badges;
};
