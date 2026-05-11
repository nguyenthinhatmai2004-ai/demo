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

export const newsProviders = ['cafef', 'vietstock', 'nguoiquansat', 'tinnhanhchungkhoan'] as const;

const baseNews = (
  ticker: string,
  source: QuantNewsItem['source'],
  category: QuantNewsItem['category'],
  sentiment: QuantNewsItem['sentiment'],
  title: string,
  summary: string,
  metrics: Record<string, number | string>
): QuantNewsItem => ({
  id: `${source}-${ticker}-${category}`.toLowerCase().replace(/\s+/g, '-'),
  source,
  ticker,
  title,
  summary,
  url: '#',
  publishedAt: 'Demo Data / Needs Live API',
  category,
  sentiment,
  impact: sentiment.includes('Positive') ? 'Medium-term catalyst' : sentiment.includes('Negative') ? 'Risk event' : 'One-off noise',
  relatedMetrics: metrics
});

const makeStock = (
  ticker: string,
  company: string,
  exchange: Exchange,
  sector: string,
  close: number,
  changePct: number,
  volumeRatio: number,
  trendBias: number,
  news: QuantNewsItem[],
  earnings: EarningsData,
  position?: QuantStock['currentPosition']
): QuantStock => {
  const avgVolume20 = Math.round(1_500_000 + trendBias * 18_000);
  const volume = Math.round(avgVolume20 * volumeRatio);
  const ma200 = close * (trendBias > 70 ? 0.82 : trendBias > 55 ? 0.94 : 1.08);
  const ma50 = close * (trendBias > 70 ? 0.92 : trendBias > 55 ? 0.98 : 1.05);
  const ma20 = close * (trendBias > 70 ? 0.97 : trendBias > 55 ? 1.0 : 1.03);

  return {
    ticker,
    company,
    exchange,
    sector,
    industry: sector,
    open: Math.round(close * (1 - changePct / 100 / 2)),
    high: Math.round(close * 1.025),
    low: Math.round(close * 0.975),
    close,
    changePct,
    volume,
    avgVolume20,
    valueTraded: Math.round(volume * close),
    marketCap: `${Math.round(close * 1_000_000 / 1_000_000)} nghìn tỷ`,
    freeFloat: 35 + (trendBias % 30),
    foreignRoom: 8 + (trendBias % 22),
    ma20: Math.round(ma20),
    ma50: Math.round(ma50),
    ma100: Math.round((ma50 + ma200) / 2),
    ma150: Math.round((ma50 + ma200 * 1.2) / 2.2),
    ma200: Math.round(ma200),
    ema20: Math.round(ma20 * 1.005),
    ema50: Math.round(ma50 * 1.003),
    rsi14: Math.min(78, Math.max(35, trendBias - 6 + Math.round(changePct * 2))),
    macd: trendBias > 60 ? 1.8 : -0.6,
    macdSignal: trendBias > 60 ? 1.1 : -0.2,
    atr14: Math.round(close * 0.035),
    obvTrend: trendBias > 68 ? 'Up' : trendBias > 52 ? 'Flat' : 'Down',
    mfi: Math.min(86, Math.max(30, trendBias + 4)),
    cmf: trendBias > 65 ? 0.18 : trendBias > 50 ? 0.04 : -0.12,
    volumeOscillator: Math.round((volumeRatio - 1) * 100),
    relativeStrengthVNIndex: trendBias,
    relativeStrengthSector: trendBias - 3,
    pivot: Math.round(close * (trendBias > 76 ? 0.995 : 1.045)),
    support: Math.round(close * 0.92),
    resistance: Math.round(close * 1.04),
    baseWeeks: trendBias > 60 ? 5 : 3,
    higherHighHigherLow: trendBias > 62,
    ma200Slope: trendBias > 65 ? 'Up' : trendBias > 50 ? 'Flat' : 'Down',
    currentPosition: position,
    news,
    earnings
  };
};

export const quantStocks: QuantStock[] = [
  makeStock('FPT', 'FPT Corp', 'HOSE', 'Công nghệ', 135200, 2.3, 2.15, 88, [
    baseNews('FPT', 'cafef', 'Profit Surge', 'Very Positive', 'FPT báo lợi nhuận tăng mạnh nhờ AI và xuất khẩu phần mềm', 'Lợi nhuận core business tăng, biên dịch vụ công nghệ cải thiện.', { profitGrowthYoY: 31 }),
    baseNews('FPT', 'nguoiquansat', 'Contract Win', 'Positive', 'FPT ký hợp đồng chuyển đổi số lớn tại Nhật', 'Catalyst trung hạn, cần xác nhận bằng giá và volume.', { contractValue: 'large' })
  ], { profitGrowthYoY: 31, revenueGrowthYoY: 24, grossMarginChange: 1.8, netMarginChange: 1.1, epsGrowthYoY: 28, coreBusinessQuality: 'High Quality' }, { quantity: 650, entryPrice: 126000, daysHeld: 18 }),
  makeStock('HPG', 'Hòa Phát', 'HOSE', 'Thép / vật liệu', 28500, 1.6, 1.72, 74, [
    baseNews('HPG', 'vietstock', 'Sector Tailwind', 'Positive', 'Thép hưởng lợi từ đầu tư công và phục hồi xây dựng', 'Catalyst ngành tích cực nhưng biên lợi nhuận còn cần theo dõi.', { steelCycle: 'recovery' })
  ], { profitGrowthYoY: 46, revenueGrowthYoY: 18, grossMarginChange: 2.2, netMarginChange: 1.3, epsGrowthYoY: 41, coreBusinessQuality: 'Medium Quality' }),
  makeStock('SSI', 'SSI Securities', 'HOSE', 'Chứng khoán', 38100, 3.1, 2.45, 82, [
    baseNews('SSI', 'tinnhanhchungkhoan', 'Sector Tailwind', 'Positive', 'Thanh khoản thị trường tăng, nhóm chứng khoán hút tiền', 'Tin tích cực nhưng phải đi cùng xu hướng VN-Index.', { liquidityGrowth: 22 })
  ], { profitGrowthYoY: 58, revenueGrowthYoY: 35, grossMarginChange: 2.5, netMarginChange: 2.1, epsGrowthYoY: 53, coreBusinessQuality: 'High Quality' }, { quantity: 1800, entryPrice: 35200, daysHeld: 9 }),
  makeStock('VCI', 'Vietcap', 'HOSE', 'Chứng khoán', 46800, 2.4, 2.05, 78, [
    baseNews('VCI', 'cafef', 'Profit Surge', 'Positive', 'VCI ghi nhận lợi nhuận môi giới và IB phục hồi', 'Catalyst theo chu kỳ risk-on chọn lọc.', { profitGrowthYoY: 44 })
  ], { profitGrowthYoY: 44, revenueGrowthYoY: 29, grossMarginChange: 1.4, netMarginChange: 1.0, epsGrowthYoY: 39, coreBusinessQuality: 'Medium Quality' }),
  makeStock('VND', 'VNDirect', 'HOSE', 'Chứng khoán', 22700, 1.8, 1.58, 70, [
    baseNews('VND', 'vietstock', 'Restructuring', 'Neutral', 'VNDirect tái cấu trúc nền tảng giao dịch', 'Theo dõi thêm phản ứng khách hàng và thanh khoản.', { platform: 'upgrade' })
  ], { profitGrowthYoY: 28, revenueGrowthYoY: 20, grossMarginChange: 0.8, netMarginChange: 0.4, epsGrowthYoY: 25, coreBusinessQuality: 'Medium Quality' }),
  makeStock('VCB', 'Vietcombank', 'HOSE', 'Ngân hàng', 92400, 0.7, 1.2, 68, [
    baseNews('VCB', 'cafef', 'Dividend', 'Neutral', 'VCB duy trì chất lượng tài sản tốt', 'Ngân hàng leader nhưng tín dụng/GDP cao cần quản trị rủi ro.', { npl: 0.9 })
  ], { profitGrowthYoY: 18, revenueGrowthYoY: 12, grossMarginChange: 0.2, netMarginChange: 0.1, epsGrowthYoY: 17, coreBusinessQuality: 'High Quality' }),
  makeStock('MBB', 'MB Bank', 'HOSE', 'Ngân hàng', 24800, 1.2, 1.45, 72, [
    baseNews('MBB', 'nguoiquansat', 'Profit Surge', 'Positive', 'MBB duy trì tăng trưởng lợi nhuận và CASA tốt', 'Catalyst chất lượng tài sản, nhưng cần theo dõi nợ xấu.', { casa: 'high' })
  ], { profitGrowthYoY: 26, revenueGrowthYoY: 18, grossMarginChange: 0.7, netMarginChange: 0.5, epsGrowthYoY: 24, coreBusinessQuality: 'High Quality' }),
  makeStock('TCB', 'Techcombank', 'HOSE', 'Ngân hàng', 48600, 1.0, 1.32, 69, [
    baseNews('TCB', 'vietstock', 'Margin Expansion', 'Positive', 'TCB cải thiện NIM và phí dịch vụ', 'Tích cực nhưng nhạy với bất động sản.', { nim: 'improving' })
  ], { profitGrowthYoY: 22, revenueGrowthYoY: 17, grossMarginChange: 0.5, netMarginChange: 0.6, epsGrowthYoY: 21, coreBusinessQuality: 'Medium Quality' }),
  makeStock('ACB', 'ACB', 'HOSE', 'Ngân hàng', 27800, 0.8, 1.18, 66, [
    baseNews('ACB', 'cafef', 'Dividend', 'Neutral', 'ACB duy trì cổ tức và nợ xấu thấp', 'Leader phòng thủ trong nhóm ngân hàng.', { npl: 'low' })
  ], { profitGrowthYoY: 16, revenueGrowthYoY: 11, grossMarginChange: 0.2, netMarginChange: 0.2, epsGrowthYoY: 15, coreBusinessQuality: 'High Quality' }),
  makeStock('MWG', 'Mobile World', 'HOSE', 'Tiêu dùng', 61500, 1.4, 1.65, 73, [
    baseNews('MWG', 'tinnhanhchungkhoan', 'Restructuring', 'Positive', 'MWG phục hồi biên lợi nhuận sau tái cấu trúc', 'Catalyst có thể kéo dài nếu doanh thu xác nhận.', { margin: 'recovering' })
  ], { profitGrowthYoY: 62, revenueGrowthYoY: 15, grossMarginChange: 2.8, netMarginChange: 1.9, epsGrowthYoY: 59, coreBusinessQuality: 'Medium Quality' }),
  makeStock('PNJ', 'PNJ', 'HOSE', 'Tiêu dùng', 98200, 0.6, 1.08, 64, [
    baseNews('PNJ', 'cafef', 'Revenue Surge', 'Neutral', 'PNJ tăng doanh thu bán lẻ trang sức', 'Tích cực nhưng sức mua cần xác nhận thêm.', { revenueGrowthYoY: 17 })
  ], { profitGrowthYoY: 14, revenueGrowthYoY: 17, grossMarginChange: 0.4, netMarginChange: 0.1, epsGrowthYoY: 13, coreBusinessQuality: 'High Quality' }),
  makeStock('MSN', 'Masan', 'HOSE', 'Tiêu dùng', 74200, -0.5, 0.82, 48, [
    baseNews('MSN', 'vietstock', 'Debt Risk', 'Negative', 'MSN chịu áp lực chi phí tài chính', 'Tin rủi ro, chưa đủ điều kiện mua nếu thiếu volume xác nhận.', { leverage: 'high' })
  ], { profitGrowthYoY: -8, revenueGrowthYoY: 6, grossMarginChange: -0.4, netMarginChange: -0.9, epsGrowthYoY: -10, coreBusinessQuality: 'Low Quality' }),
  makeStock('VHM', 'Vinhomes', 'HOSE', 'Bất động sản', 46200, -1.3, 1.9, 42, [
    baseNews('VHM', 'nguoiquansat', 'Legal Risk', 'Negative', 'Bất động sản còn chờ tháo gỡ pháp lý', 'Cần tránh mua đuổi khi tín dụng/GDP cao.', { legal: 'pending' })
  ], { profitGrowthYoY: -12, revenueGrowthYoY: -9, grossMarginChange: -1.5, netMarginChange: -1.1, epsGrowthYoY: -14, coreBusinessQuality: 'Medium Quality' }),
  makeStock('KDH', 'Khang Điền', 'HOSE', 'Bất động sản', 35600, 0.4, 1.12, 56, [
    baseNews('KDH', 'cafef', 'Policy Tailwind', 'Neutral', 'KDH hưởng lợi nếu pháp lý dự án được tháo gỡ', 'Theo dõi, chưa phải catalyst giao dịch ngay.', { policy: 'watch' })
  ], { profitGrowthYoY: 12, revenueGrowthYoY: 8, grossMarginChange: 0.3, netMarginChange: 0.2, epsGrowthYoY: 10, coreBusinessQuality: 'Medium Quality' }),
  makeStock('NLG', 'Nam Long', 'HOSE', 'Bất động sản', 39800, 0.9, 1.28, 59, [
    baseNews('NLG', 'vietstock', 'Sector Tailwind', 'Neutral', 'Nhà ở vừa túi tiền có dấu hiệu phục hồi', 'Cần breakout và volume xác nhận.', { demand: 'recovering' })
  ], { profitGrowthYoY: 18, revenueGrowthYoY: 12, grossMarginChange: 0.6, netMarginChange: 0.2, epsGrowthYoY: 16, coreBusinessQuality: 'Medium Quality' }),
  makeStock('CTD', 'Coteccons', 'HOSE', 'Xây dựng / đầu tư công', 72400, 2.0, 1.88, 76, [
    baseNews('CTD', 'tinnhanhchungkhoan', 'Contract Win', 'Positive', 'CTD trúng gói thầu xây dựng lớn', 'Catalyst tốt nếu backlog chuyển thành lợi nhuận.', { backlog: 'large' })
  ], { profitGrowthYoY: 71, revenueGrowthYoY: 31, grossMarginChange: 2.4, netMarginChange: 1.7, epsGrowthYoY: 66, coreBusinessQuality: 'High Quality' }),
  makeStock('HHV', 'Đèo Cả', 'HOSE', 'Hạ tầng', 14600, 1.1, 1.55, 67, [
    baseNews('HHV', 'cafef', 'Policy Tailwind', 'Positive', 'HHV hưởng lợi từ đầu tư công và PPP', 'Catalyst ngành, cần kiểm tra nợ vay.', { publicInvestment: 'positive' })
  ], { profitGrowthYoY: 33, revenueGrowthYoY: 19, grossMarginChange: 1.0, netMarginChange: 0.5, epsGrowthYoY: 29, coreBusinessQuality: 'Medium Quality' }),
  makeStock('VCG', 'Vinaconex', 'HNX', 'Xây dựng / đầu tư công', 22100, 1.7, 1.7, 71, [
    baseNews('VCG', 'vietstock', 'Contract Win', 'Positive', 'VCG tham gia nhiều dự án hạ tầng', 'Tích cực nếu dòng tiền dự án cải thiện.', { projectPipeline: 'strong' })
  ], { profitGrowthYoY: 38, revenueGrowthYoY: 22, grossMarginChange: 1.3, netMarginChange: 0.8, epsGrowthYoY: 34, coreBusinessQuality: 'Medium Quality' })
];

export const demoPositions: DemoPosition[] = [
  {
    ticker: 'FPT',
    sector: 'Công nghệ',
    entryPrice: 126000,
    currentPrice: 135200,
    quantity: 650,
    stopLoss: 125000,
    trailingStop: 130000,
    target1: 152000,
    target2: 172000,
    aiReason: 'Mua demo vì uptrend, breakout pivot, volume 2.1x Avg20 và catalyst lợi nhuận tăng mạnh.',
    daysHeld: 18
  },
  {
    ticker: 'SSI',
    sector: 'Chứng khoán',
    entryPrice: 35200,
    currentPrice: 38100,
    quantity: 1800,
    stopLoss: 32700,
    trailingStop: 36600,
    target1: 43000,
    target2: 50000,
    aiReason: 'Mua demo vì nhóm chứng khoán hút tiền, trend score cao, volume xác nhận.',
    daysHeld: 9
  }
];

export const closedTrades: ClosedTrade[] = [
  { ticker: 'HPG', action: 'Sell', entry: 26200, exit: 28500, quantity: 2500, pnl: 5750000, holdingPeriod: 14, setupType: 'Pullback to MA50' },
  { ticker: 'VHM', action: 'Sell', entry: 48800, exit: 45200, quantity: 1200, pnl: -4320000, holdingPeriod: 7, setupType: 'False Breakout' },
  { ticker: 'MWG', action: 'Sell', entry: 55200, exit: 61200, quantity: 900, pnl: 5400000, holdingPeriod: 21, setupType: 'Earnings Surprise Momentum' }
];

export const marketUniverseSummary = {
  hose: 404,
  hnx: 326,
  upcom: 884,
  scanned: 'HOSE + HNX + UPCOM',
  mode: 'Demo scanner universe / Needs Live API for full-market scan'
};
