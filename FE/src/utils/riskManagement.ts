import type { QuantStock } from '../data/quantData';

export const generateStopLoss = (entry: number, atr14: number): number => {
  const percentStop = entry * 0.925;
  const atrStop = entry - 2 * atr14;
  return Math.round(Math.max(percentStop, atrStop));
};

export const generateTrailingStop = (currentPrice: number, atr14: number): number => Math.round(currentPrice - 2.2 * atr14);

export const calculateRiskRewardScore = (entry: number, stopLoss: number, target1: number): number => {
  const risk = Math.max(1, entry - stopLoss);
  const reward = Math.max(0, target1 - entry);
  const ratio = reward / risk;
  if (ratio >= 3) return 92;
  if (ratio >= 2) return 78;
  if (ratio >= 1.5) return 58;
  return 30;
};

export const calculatePositionSize = (nav: number, entry: number, stopLoss: number, riskPct = 0.01): number => {
  const portfolioRiskAmount = nav * riskPct;
  const riskPerShare = Math.max(1, entry - stopLoss);
  const rawQuantity = Math.floor(portfolioRiskAmount / riskPerShare);
  const maxValueQuantity = Math.floor((nav * 0.1) / entry);
  return Math.max(0, Math.min(rawQuantity, maxValueQuantity));
};

export const riskRulesForStock = (stock: QuantStock): string[] => [
  `Stop loss bắt buộc: ${generateStopLoss(stock.close, stock.atr14).toLocaleString('vi-VN')}.`,
  'Không bình quân giá xuống.',
  stock.close < stock.ma200 ? 'Không mua vì cổ phiếu dưới MA200.' : 'Giá đang trên MA200, được phép xem xét nếu có hợp lưu.',
  'Không mua nếu risk/reward < 2:1.',
  'Không để một cổ phiếu vượt 10% NAV khi mới mua.',
  'Nếu VN-Index dưới MA200, chỉ bán hoặc giữ tiền mặt.'
];
