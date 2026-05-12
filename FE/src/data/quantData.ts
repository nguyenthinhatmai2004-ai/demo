export type Exchange = 'HOSE' | 'HNX' | 'UPCOM';
export type AIAction = 'Buy' | 'Sell' | 'Hold' | 'Watch' | 'Avoid';
export type BreakoutStatus =
  | 'Ready to Buy'
  | 'Near Pivot'
  | 'Breakout Confirmed'
  | 'Pullback Entry'
  | 'Extended'
  | 'False Breakout'
  | 'Breakdown'
  | 'Avoid';
export type VolumeSignal =
  | 'Accumulation'
  | 'Breakout Volume'
  | 'Distribution'
  | 'Climax Volume'
  | 'Weak Volume'
  | 'Dry-up Volume'
  | 'No Signal';

export interface QuantNewsItem {
  id: string;
  source: 'cafef' | 'vietstock' | 'nguoiquansat' | 'tinnhanhchungkhoan';
  ticker: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  category:
    | 'Earnings Surprise'
    | 'Profit Surge'
    | 'Revenue Surge'
    | 'Margin Expansion'
    | 'Contract Win'
    | 'Policy Tailwind'
    | 'Sector Tailwind'
    | 'Foreign Fund Buying'
    | 'Insider Buying'
    | 'Dividend'
    | 'M&A'
    | 'Restructuring'
    | 'Negative Earnings'
    | 'Insider Selling'
    | 'Legal Risk'
    | 'Debt Risk'
    | 'Dilution Risk';
  sentiment: 'Very Positive' | 'Positive' | 'Neutral' | 'Negative' | 'Very Negative';
  impact: 'Short-term catalyst' | 'Medium-term catalyst' | 'Long-term catalyst' | 'One-off noise' | 'Risk event';
  relatedMetrics: Record<string, number | string>;
}

export interface EarningsData {
  profitGrowthYoY: number;
  revenueGrowthYoY: number;
  grossMarginChange: number;
  netMarginChange: number;
  epsGrowthYoY: number;
  coreBusinessQuality: 'High Quality' | 'Medium Quality' | 'Low Quality';
}

export interface QuantStock {
  ticker: string;
  company: string;
  exchange: Exchange;
  sector: string;
  industry: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number;
  volume: number;
  avgVolume20: number;
  valueTraded: number;
  marketCap: string;
  freeFloat: number;
  foreignRoom: number;
  ma20: number;
  ma50: number;
  ma100: number;
  ma150: number;
  ma200: number;
  ema20: number;
  ema50: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  atr14: number;
  obvTrend: 'Up' | 'Flat' | 'Down';
  mfi: number;
  cmf: number;
  volumeOscillator: number;
  relativeStrengthVNIndex: number;
  relativeStrengthSector: number;
  pivot: number;
  support: number;
  resistance: number;
  baseWeeks: number;
  higherHighHigherLow: boolean;
  ma200Slope: 'Up' | 'Flat' | 'Down';
  currentPosition?: {
    quantity: number;
    entryPrice: number;
    daysHeld: number;
  };
  news: QuantNewsItem[];
  earnings: EarningsData;
}

export interface DemoPosition {
  ticker: string;
  sector: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  trailingStop: number;
  target1: number;
  target2: number;
  aiReason: string;
  daysHeld: number;
}

export interface ClosedTrade {
  ticker: string;
  action: 'Buy' | 'Sell';
  entry: number;
  exit: number;
  quantity: number;
  pnl: number;
  holdingPeriod: number;
  setupType: string;
}

