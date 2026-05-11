import type { AIAction, QuantStock } from '../data/quantData';
import { breakoutScoreFromStatus, detectBreakoutStatus } from './breakoutEngine';
import { calculateTrendScore } from './cmtTrendEngine';
import { calculateEarningsSurpriseScore } from './earningsScoring';
import { calculateNewsCatalystScore } from './newsScoring';
import { calculateRiskRewardScore, generateStopLoss } from './riskManagement';
import { calculateVolumeScore, detectAccumulationDistribution } from './volumeEngine';

export const calculateTechnicalScore = (stock: QuantStock): number => {
  let score = 40;
  if (stock.close > stock.ma50) score += 10;
  if (stock.close > stock.ma200) score += 12;
  if (stock.ma50 > stock.ma200) score += 8;
  if (stock.rsi14 >= 50 && stock.rsi14 <= 70) score += 9;
  if (stock.rsi14 > 70) score += 4;
  if (stock.macd > stock.macdSignal) score += 8;
  if (stock.macd > 0) score += 5;
  if (stock.obvTrend === 'Up') score += 7;
  if (stock.mfi > 50) score += 5;
  if (stock.cmf > 0) score += 6;
  return Math.min(100, Math.max(0, score));
};

export const calculateAIQuantScore = (stock: QuantStock): number => {
  const status = detectBreakoutStatus(stock);
  const entry = stock.close;
  const stop = generateStopLoss(entry, stock.atr14);
  const target1 = Math.round(entry + (entry - stop) * 2.4);
  const riskReward = calculateRiskRewardScore(entry, stop, target1);
  const score =
    0.2 * calculateTrendScore(stock) +
    0.2 * calculateVolumeScore(stock) +
    0.15 * breakoutScoreFromStatus(status) +
    0.15 * calculateTechnicalScore(stock) +
    0.15 * calculateNewsCatalystScore(stock) +
    0.1 * calculateEarningsSurpriseScore(stock) +
    0.05 * riskReward;
  return Math.round(score);
};

export const classifyAIQuantScore = (score: number): string => {
  if (score >= 85) return 'Strong Buy Candidate';
  if (score >= 70) return 'Buy / Add to Watchlist';
  if (score >= 55) return 'Watch / Wait';
  if (score >= 40) return 'Weak Setup';
  return 'Avoid / Sell if holding';
};

export const generateAITradingAction = (stock: QuantStock): AIAction => {
  const score = calculateAIQuantScore(stock);
  const trend = calculateTrendScore(stock);
  const volume = calculateVolumeScore(stock);
  const status = detectBreakoutStatus(stock);
  const news = calculateNewsCatalystScore(stock);
  const earnings = calculateEarningsSurpriseScore(stock);
  const volumeSignal = detectAccumulationDistribution(stock);
  const validBuyStatus = ['Breakout Confirmed', 'Pullback Entry', 'Ready to Buy'].includes(status);
  const hasCatalyst = news >= 60 || earnings >= 60;
  const badNews = stock.news.some((item) => item.sentiment === 'Very Negative' || item.sentiment === 'Negative');

  if (score < 40 || status === 'Breakdown' || badNews) return stock.currentPosition ? 'Sell' : 'Avoid';
  if (score >= 75 && trend >= 65 && volume >= 65 && validBuyStatus && hasCatalyst && volumeSignal !== 'Distribution') return 'Buy';
  if (stock.currentPosition && trend >= 60 && status !== 'False Breakout') return 'Hold';
  if (score >= 55) return 'Watch';
  return 'Avoid';
};

export const generateAIExplanation = (stock: QuantStock): string => {
  const action = generateAITradingAction(stock);
  const score = calculateAIQuantScore(stock);
  const status = detectBreakoutStatus(stock);
  const volumeSignal = detectAccumulationDistribution(stock);
  if (action === 'Buy') {
    return `Mua demo ${stock.ticker} vì xu hướng tốt, ${status}, ${volumeSignal}, tin/catalyst được xác nhận và AI Quant Score đạt ${score}/100. Lệnh có stop loss rõ ràng và risk/reward tối thiểu 2:1.`;
  }
  if (action === 'Sell') {
    return `Bán demo ${stock.ticker} vì setup vi phạm: ${status}, có rủi ro tin tức hoặc AI Quant Score giảm còn ${score}/100. Ưu tiên bảo toàn vốn.`;
  }
  if (action === 'Hold') {
    return `Giữ ${stock.ticker} vì xu hướng chưa gãy, giá còn trên MA50/MA200 và chưa có tín hiệu phân phối nghiêm trọng.`;
  }
  if (action === 'Watch') {
    return `Theo dõi ${stock.ticker}; setup có điểm mạnh nhưng cần thêm xác nhận breakout/volume hoặc catalyst trước khi mua demo.`;
  }
  return `Tránh mua ${stock.ticker}; thiếu hợp lưu CMT hoặc rủi ro/volume chưa đạt chuẩn.`;
};
