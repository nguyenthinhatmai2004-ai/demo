import type { QuantStock } from '../data/quantData';
import { calculateAIQuantScore, generateAIExplanation, generateAITradingAction } from './quantScoring';
import { calculatePositionSize, generateStopLoss } from './riskManagement';

export interface SimulatedOrder {
  orderId: string;
  timestamp: string;
  ticker: string;
  action: 'Market Buy' | 'Limit Buy' | 'Stop Buy' | 'Market Sell' | 'Limit Sell' | 'Stop Loss' | 'Trailing Stop' | 'Take Profit';
  signalSource: string;
  price: number;
  quantity: number;
  positionSize: string;
  stopLoss: number;
  target: number;
  reason: string;
  confidenceScore: number;
  status: 'Pending' | 'Filled' | 'Cancelled' | 'Rejected';
}

export const simulateBuyOrder = (stock: QuantStock, nav = 1_000_000_000): SimulatedOrder => {
  const stopLoss = generateStopLoss(stock.close, stock.atr14);
  const quantity = calculatePositionSize(nav, stock.close, stopLoss, 0.01);
  return {
    orderId: `PAPER-BUY-${stock.ticker}`,
    timestamp: 'Demo Data / Needs Live API',
    ticker: stock.ticker,
    action: 'Market Buy',
    signalSource: 'AI Quant Brain',
    price: stock.close,
    quantity,
    positionSize: `${Math.round((quantity * stock.close / nav) * 1000) / 10}% NAV`,
    stopLoss,
    target: Math.round(stock.close + (stock.close - stopLoss) * 2.4),
    reason: generateAIExplanation(stock),
    confidenceScore: calculateAIQuantScore(stock),
    status: generateAITradingAction(stock) === 'Buy' ? 'Filled' : 'Rejected'
  };
};

export const simulateSellOrder = (stock: QuantStock): SimulatedOrder => {
  const stopLoss = generateStopLoss(stock.close, stock.atr14);
  return {
    orderId: `PAPER-SELL-${stock.ticker}`,
    timestamp: 'Demo Data / Needs Live API',
    ticker: stock.ticker,
    action: stock.close <= stopLoss ? 'Stop Loss' : 'Market Sell',
    signalSource: 'Risk Management Engine',
    price: stock.close,
    quantity: stock.currentPosition?.quantity ?? 0,
    positionSize: 'Paper position',
    stopLoss,
    target: Math.round(stock.close + (stock.close - stopLoss) * 2.2),
    reason: generateAIExplanation(stock),
    confidenceScore: calculateAIQuantScore(stock),
    status: stock.currentPosition ? 'Filled' : 'Rejected'
  };
};
