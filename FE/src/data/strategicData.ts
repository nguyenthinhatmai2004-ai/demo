export type StatusVi = 'Tốt' | 'Cẩn trọng' | 'Rủi ro' | 'Cẩn trọng nhẹ';
export type AllocationMode = 'Conservative' | 'Balanced' | 'Aggressive';

export interface MacroIndicator {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: StatusVi;
  category: string;
  description: string;
}

export interface SecondaryMacroIndicator {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: StatusVi;
}

export interface StrategicStock {
  ticker: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  marketCap: string;
  liquidity: string;
  liquidityScore: number;
  macroFitScore: number;
  cycleFit: string;
  creditSensitivity: 'Thấp' | 'Trung bình' | 'Cao';
  inflationSensitivity: 'Thấp' | 'Trung bình' | 'Cao';
  canslim: {
    c: number;
    a: number;
    n: number;
    s: number;
    l: number;
    i: number;
    m: number;
  };
  sepa: {
    trendTemplate: number;
    baseQuality: number;
    breakoutQuality: number;
    riskReward: number;
    status: string;
  };
  catalystScore: number;
  relativeStrengthScore: number;
  riskRewardScore: number;
  setupStatus: string;
  pivotPrice: number;
  buyZone: string;
  stopLoss: number;
  target1: number;
  target2: number;
  positionSizePct: string;
  lastUpdated: string;
}

export const coreMacroIndicators: MacroIndicator[] = [
  {
    id: 'credit_to_gdp',
    name: 'Dư nợ tín dụng / GDP',
    value: 125,
    unit: '%',
    status: 'Rủi ro',
    category: 'Credit Leverage',
    description: 'Đo mức độ đòn bẩy của nền kinh tế. Tỷ lệ càng cao, nền kinh tế càng phụ thuộc vào tín dụng.'
  },
  {
    id: 'public_debt_to_gdp',
    name: 'Nợ công / GDP',
    value: 37,
    unit: '%',
    status: 'Tốt',
    category: 'Fiscal Room',
    description: 'Đo dư địa tài khóa của Chính phủ. Nợ công thấp giúp Chính phủ còn khả năng hỗ trợ tăng trưởng.'
  },
  {
    id: 'cpi_current',
    name: 'CPI hiện tại',
    value: 3.2,
    unit: '%',
    status: 'Tốt',
    category: 'Inflation',
    description: 'Đo lạm phát tiêu dùng hiện tại.'
  },
  {
    id: 'cpi_pressure',
    name: 'CPI áp lực / dự phóng',
    value: 3.9,
    unit: '%',
    status: 'Cẩn trọng',
    category: 'Inflation',
    description: 'Đo áp lực lạm phát có thể tăng trong thời gian tới.'
  },
  {
    id: 'ppi',
    name: 'PPI',
    value: 2.1,
    unit: '%',
    status: 'Cẩn trọng',
    category: 'Inflation Pipeline',
    description: 'Đo áp lực giá sản xuất, chi phí đầu vào của doanh nghiệp.'
  },
  {
    id: 'gdp_growth',
    name: 'Tăng trưởng GDP',
    value: 6.8,
    unit: '%',
    status: 'Tốt',
    category: 'Growth',
    description: 'Đo sức khỏe chu kỳ kinh tế.'
  }
];

export const secondaryMacroIndicators: SecondaryMacroIndicator[] = [
  { id: 'policy_rate', name: 'Lãi suất điều hành', value: 4.5, unit: '%', status: 'Tốt' },
  { id: 'usd_vnd', name: 'Tỷ giá USD/VND', value: 25450, unit: 'VND', status: 'Cẩn trọng' },
  { id: 'dxy', name: 'Chỉ số USD', value: 104.2, unit: '', status: 'Cẩn trọng' },
  { id: 'us_bond_yield', name: 'Lợi suất Trái phiếu Mỹ', value: 4.25, unit: '%', status: 'Cẩn trọng' },
  { id: 'vn_bond_yield', name: 'Lợi suất TP Chính phủ VN', value: 2.85, unit: '%', status: 'Tốt' },
  { id: 'market_pe', name: 'P/E Thị trường', value: 14.2, unit: 'x', status: 'Cẩn trọng' },
  { id: 'm2_growth', name: 'Cung tiền M2', value: 10.5, unit: '%', status: 'Cẩn trọng' },
  { id: 'industrial_production', name: 'Sản xuất công nghiệp', value: 7.8, unit: '%', status: 'Tốt' }
];

export const strategicStocks: StrategicStock[] = [
  {
    ticker: 'FPT',
    company: 'FPT Corp',
    sector: 'Công nghệ',
    price: 135200,
    changePct: 1.8,
    marketCap: '189 nghìn tỷ',
    liquidity: 'Cao',
    liquidityScore: 88,
    macroFitScore: 92,
    cycleFit: 'Leader ít phụ thuộc tín dụng',
    creditSensitivity: 'Thấp',
    inflationSensitivity: 'Thấp',
    canslim: { c: 90, a: 92, n: 96, s: 82, l: 94, i: 86, m: 74 },
    sepa: { trendTemplate: 90, baseQuality: 84, breakoutQuality: 82, riskReward: 78, status: 'Ready to Buy' },
    catalystScore: 95,
    relativeStrengthScore: 93,
    riskRewardScore: 78,
    setupStatus: 'Ready to Buy',
    pivotPrice: 134500,
    buyZone: '134.5 - 139.0',
    stopLoss: 125000,
    target1: 158000,
    target2: 172000,
    positionSizePct: '8% - 12%',
    lastUpdated: 'Demo Data / Needs Live API'
  },
  {
    ticker: 'SSI',
    company: 'SSI Securities',
    sector: 'Chứng khoán',
    price: 38100,
    changePct: 2.4,
    marketCap: '71 nghìn tỷ',
    liquidity: 'Rất cao',
    liquidityScore: 94,
    macroFitScore: 84,
    cycleFit: 'Hưởng lợi selective risk-on',
    creditSensitivity: 'Trung bình',
    inflationSensitivity: 'Trung bình',
    canslim: { c: 82, a: 78, n: 88, s: 90, l: 86, i: 82, m: 74 },
    sepa: { trendTemplate: 84, baseQuality: 80, breakoutQuality: 76, riskReward: 75, status: 'Near Pivot' },
    catalystScore: 90,
    relativeStrengthScore: 88,
    riskRewardScore: 75,
    setupStatus: 'Near Pivot',
    pivotPrice: 39200,
    buyZone: '39.2 - 40.5',
    stopLoss: 36200,
    target1: 45500,
    target2: 50000,
    positionSizePct: '6% - 10%',
    lastUpdated: 'Demo Data / Needs Live API'
  },
  {
    ticker: 'HPG',
    company: 'Hòa Phát',
    sector: 'Vật liệu / đầu tư công',
    price: 28500,
    changePct: 0.9,
    marketCap: '166 nghìn tỷ',
    liquidity: 'Cao',
    liquidityScore: 89,
    macroFitScore: 86,
    cycleFit: 'Đầu tư công và chu kỳ thép',
    creditSensitivity: 'Trung bình',
    inflationSensitivity: 'Cao',
    canslim: { c: 76, a: 72, n: 82, s: 84, l: 80, i: 78, m: 74 },
    sepa: { trendTemplate: 76, baseQuality: 86, breakoutQuality: 68, riskReward: 80, status: 'Under Accumulation' },
    catalystScore: 88,
    relativeStrengthScore: 80,
    riskRewardScore: 80,
    setupStatus: 'Under Accumulation',
    pivotPrice: 30200,
    buyZone: '30.2 - 31.4',
    stopLoss: 28100,
    target1: 35000,
    target2: 38800,
    positionSizePct: '5% - 8%',
    lastUpdated: 'Demo Data / Needs Live API'
  },
  {
    ticker: 'VCB',
    company: 'Vietcombank',
    sector: 'Ngân hàng chất lượng',
    price: 92400,
    changePct: 0.4,
    marketCap: '520 nghìn tỷ',
    liquidity: 'Cao',
    liquidityScore: 86,
    macroFitScore: 82,
    cycleFit: 'GDP tốt, tín dụng tăng nhưng cần kiểm soát nợ xấu',
    creditSensitivity: 'Cao',
    inflationSensitivity: 'Trung bình',
    canslim: { c: 78, a: 84, n: 72, s: 76, l: 82, i: 90, m: 74 },
    sepa: { trendTemplate: 74, baseQuality: 78, breakoutQuality: 66, riskReward: 72, status: 'Near Pivot' },
    catalystScore: 78,
    relativeStrengthScore: 77,
    riskRewardScore: 72,
    setupStatus: 'Near Pivot',
    pivotPrice: 95000,
    buyZone: '95.0 - 98.0',
    stopLoss: 88400,
    target1: 108000,
    target2: 116000,
    positionSizePct: '5% - 9%',
    lastUpdated: 'Demo Data / Needs Live API'
  },
  {
    ticker: 'VHM',
    company: 'Vinhomes',
    sector: 'Bất động sản chọn lọc',
    price: 46200,
    changePct: -0.7,
    marketCap: '201 nghìn tỷ',
    liquidity: 'Cao',
    liquidityScore: 84,
    macroFitScore: 62,
    cycleFit: 'Chọn lọc do tín dụng/GDP cao',
    creditSensitivity: 'Cao',
    inflationSensitivity: 'Cao',
    canslim: { c: 58, a: 64, n: 70, s: 72, l: 60, i: 82, m: 74 },
    sepa: { trendTemplate: 58, baseQuality: 66, breakoutQuality: 52, riskReward: 68, status: 'Wait for Confirmation' },
    catalystScore: 76,
    relativeStrengthScore: 58,
    riskRewardScore: 68,
    setupStatus: 'Wait for Confirmation',
    pivotPrice: 49800,
    buyZone: '49.8 - 51.5',
    stopLoss: 46200,
    target1: 57000,
    target2: 63000,
    positionSizePct: '0% - 5%',
    lastUpdated: 'Demo Data / Needs Live API'
  },
  {
    ticker: 'MWG',
    company: 'Mobile World',
    sector: 'Tiêu dùng',
    price: 61500,
    changePct: 1.1,
    marketCap: '90 nghìn tỷ',
    liquidity: 'Cao',
    liquidityScore: 82,
    macroFitScore: 74,
    cycleFit: 'GDP hỗ trợ tiêu dùng, CPI cần theo dõi',
    creditSensitivity: 'Trung bình',
    inflationSensitivity: 'Trung bình',
    canslim: { c: 80, a: 70, n: 78, s: 78, l: 76, i: 74, m: 74 },
    sepa: { trendTemplate: 78, baseQuality: 74, breakoutQuality: 70, riskReward: 76, status: 'Near Pivot' },
    catalystScore: 74,
    relativeStrengthScore: 76,
    riskRewardScore: 76,
    setupStatus: 'Near Pivot',
    pivotPrice: 62800,
    buyZone: '62.8 - 65.0',
    stopLoss: 58400,
    target1: 72000,
    target2: 79000,
    positionSizePct: '4% - 7%',
    lastUpdated: 'Demo Data / Needs Live API'
  }
];

export const riskManagementRules = [
  'Không mua nếu Market Regime = Risk-off.',
  'Không mua nếu VN-Index dưới MA200.',
  'Không mua nếu cổ phiếu dưới MA200.',
  'Không mua nếu cổ phiếu extended quá 10% so với pivot.',
  'Cắt lỗ khi giảm 7%-8% từ điểm mua.',
  'Không bình quân giá xuống.',
  'Chỉ gia tăng tỷ trọng khi cổ phiếu đi đúng hướng.',
  'Nếu tín dụng/GDP > 130%, giảm tỷ trọng tài sản rủi ro.',
  'Nếu CPI > 4.5%-5%, giảm nhóm nhạy cảm lãi suất.',
  'Nếu GDP giảm dưới 5.5%, giảm cổ phiếu chu kỳ.',
  'Nếu PPI tăng mạnh, kiểm tra biên lợi nhuận doanh nghiệp.',
  'Không để một cổ phiếu vượt 15% NAV.',
  'Không để một ngành vượt 35% NAV.',
  'Không dùng margin cao trong pha Mid-cycle nghiêng Late-cycle.',
  'Chỉ mua cổ phiếu có catalyst + CANSLIM + SEPA + volume xác nhận.'
];
