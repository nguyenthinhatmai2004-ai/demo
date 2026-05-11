import type { QuantNewsItem, QuantStock } from '../data/quantData';

export const calculateNewsCatalystScore = (stock: QuantStock): number => {
  if (stock.news.length === 0) return 45;
  const score = stock.news.reduce((sum, item) => {
    const sentiment = item.sentiment === 'Very Positive' ? 92 : item.sentiment === 'Positive' ? 76 : item.sentiment === 'Neutral' ? 55 : item.sentiment === 'Negative' ? 30 : 15;
    const categoryBoost = ['Earnings Surprise', 'Profit Surge', 'Revenue Surge', 'Contract Win', 'Policy Tailwind', 'Foreign Fund Buying'].includes(item.category) ? 8 : 0;
    return sum + sentiment + categoryBoost;
  }, 0);
  return Math.min(100, Math.round(score / stock.news.length));
};

export const summarizeNewsImpact = (item: QuantNewsItem): string => {
  const action = item.sentiment.includes('Positive')
    ? 'Chỉ hành động nếu giá và volume xác nhận.'
    : item.sentiment.includes('Negative')
      ? 'Không mua mới, kiểm tra hỗ trợ và stop loss.'
      : 'Theo dõi, chưa đủ catalyst giao dịch.';
  return `${item.title}. ${item.summary} Tin được phân loại ${item.category}, tác động ${item.impact}. ${action}`;
};
