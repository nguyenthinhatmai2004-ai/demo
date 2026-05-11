import type { AllocationMode, MacroIndicator } from '../data/strategicData';

const byId = (indicators: MacroIndicator[], id: string) => indicators.find((item) => item.id === id)?.value ?? 0;

export const calculateCreditLeverageScore = (creditToGdp: number): number => {
  if (creditToGdp < 80) return 90;
  if (creditToGdp <= 110) return 75;
  if (creditToGdp <= 130) return 45;
  return 25;
};

export const calculateFiscalRoomScore = (publicDebtToGdp: number): number => {
  if (publicDebtToGdp < 40) return 90;
  if (publicDebtToGdp <= 55) return 72;
  if (publicDebtToGdp <= 65) return 52;
  return 28;
};

export const calculateInflationPressureScore = (cpi: number, cpiPressure: number, ppi: number): number => {
  const cpiScore = cpi < 3 ? 88 : cpi <= 4 ? 76 : cpi <= 5 ? 52 : 25;
  const pressurePenalty = cpiPressure >= 4.5 ? 18 : cpiPressure >= 3.8 ? 6 : 0;
  const ppiPenalty = ppi >= 5 ? 16 : ppi >= 3.5 ? 8 : 0;
  return Math.max(20, Math.round(cpiScore - pressurePenalty - ppiPenalty));
};

export const calculateGrowthScore = (gdpGrowth: number): number => {
  if (gdpGrowth < 4) return 25;
  if (gdpGrowth < 5.5) return 55;
  if (gdpGrowth <= 7) return 85;
  return 80;
};

export const calculateVietnamMacroScore = (indicators: MacroIndicator[]): number => {
  const credit = calculateCreditLeverageScore(byId(indicators, 'credit_to_gdp'));
  const fiscal = calculateFiscalRoomScore(byId(indicators, 'public_debt_to_gdp'));
  const inflation = calculateInflationPressureScore(
    byId(indicators, 'cpi_current'),
    byId(indicators, 'cpi_pressure'),
    byId(indicators, 'ppi')
  );
  const growth = calculateGrowthScore(byId(indicators, 'gdp_growth'));
  return Math.round(0.3 * credit + 0.2 * fiscal + 0.25 * inflation + 0.25 * growth);
};

export const classifyMarketRegime = (score: number): string => {
  if (score >= 80) return 'Strong Risk-on';
  if (score >= 65) return 'Selective Risk-on';
  if (score >= 50) return 'Neutral';
  if (score >= 35) return 'Defensive';
  return 'Risk-off';
};

export const classifyEconomicCycle = (indicators: MacroIndicator[]): string => {
  const credit = byId(indicators, 'credit_to_gdp');
  const debt = byId(indicators, 'public_debt_to_gdp');
  const cpi = byId(indicators, 'cpi_current');
  const pressure = byId(indicators, 'cpi_pressure');
  const gdp = byId(indicators, 'gdp_growth');

  if (gdp < 4) return 'Contraction';
  if (gdp >= 5.5 && cpi < 4 && pressure < 4.5 && credit < 110 && debt < 50) return 'Early Expansion';
  if (gdp >= 5.5 && cpi <= 4 && credit <= 125 && debt < 55) return 'Mid Cycle';
  if (gdp >= 5.5 && (credit > 120 || pressure >= 3.8)) return 'Mid-cycle nghiêng Late-cycle';
  return 'Late Cycle';
};

export const calculateCreditTankScore = (indicators: MacroIndicator[]): number => {
  const credit = byId(indicators, 'credit_to_gdp');
  const gdp = byId(indicators, 'gdp_growth');
  const cpi = byId(indicators, 'cpi_current');
  const pressure = byId(indicators, 'cpi_pressure');
  const ppi = byId(indicators, 'ppi');
  const debt = byId(indicators, 'public_debt_to_gdp');

  let score = 60;
  if (credit < 110) score += 15;
  if (credit >= 110 && credit <= 130) score -= 15;
  if (credit > 130) score -= 30;
  if (gdp > 5.5) score += 12;
  if (cpi >= 4 || pressure >= 4) score -= 8;
  if (ppi > 3.5) score -= 8;
  if (debt < 40) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const classifyCreditTank = (score: number): string => {
  if (score <= 30) return 'Bồn cạn / Risk-off';
  if (score <= 50) return 'Bồn yếu / Cẩn trọng';
  if (score <= 70) return 'Bồn trung tính / Giải ngân chọn lọc';
  if (score <= 85) return 'Bồn đầy / Risk-on';
  return 'Bồn quá nóng / Late-cycle euphoria';
};

export const generateSuggestedAllocation = (mode: AllocationMode) => {
  const allocations = {
    Conservative: { stocks: '40% - 50%', cash: '40% - 50%', realEstate: '0% - 10%', margin: '0%' },
    Balanced: { stocks: '55% - 65%', cash: '25% - 35%', realEstate: '0% - 15%', margin: '0% - 5%' },
    Aggressive: { stocks: '65% - 75%', cash: '15% - 25%', realEstate: '0% - 15%', margin: '0% - 10%' }
  };
  return allocations[mode];
};

export const generateSectorAllocation = () => ({
  overweight: [
    { sector: 'Công nghệ', tickers: 'FPT', reason: 'Ít phụ thuộc tín dụng nội địa, hưởng lợi AI và chuyển đổi số.' },
    { sector: 'Chứng khoán', tickers: 'SSI, HCM, VCI, VND', reason: 'Hưởng lợi khi risk-on chọn lọc, thanh khoản tăng và kỳ vọng nâng hạng.' },
    { sector: 'Ngân hàng chất lượng', tickers: 'VCB, MBB, TCB, ACB', reason: 'GDP tốt hỗ trợ tín dụng, ưu tiên CASA tốt và nợ xấu thấp.' },
    { sector: 'Vật liệu / đầu tư công', tickers: 'HPG, CTD, HHV, VCG', reason: 'Nợ công thấp tạo dư địa tài khóa và hạ tầng.' }
  ],
  neutral: [
    { sector: 'Bất động sản chọn lọc', tickers: 'VHM, KDH, NLG', reason: 'Có thể phục hồi nếu lãi suất thấp và pháp lý cải thiện.' },
    { sector: 'Tiêu dùng', tickers: 'MWG, PNJ, MSN, VNM', reason: 'GDP tốt hỗ trợ tiêu dùng nhưng CPI gần 4% cần theo dõi.' }
  ],
  underweight: [
    { sector: 'Bất động sản đòn bẩy cao', tickers: 'Penny BĐS', reason: 'Nhạy với tín dụng khi tín dụng/GDP đã 125%.' },
    { sector: 'Penny / đầu cơ', tickers: 'Thanh khoản thấp', reason: 'Dễ bị hút tiền khi thị trường chuyển risk-off.' },
    { sector: 'Doanh nghiệp nợ vay lớn', tickers: 'Đòn bẩy cao', reason: 'Rủi ro khi lạm phát tăng và lãi suất quay đầu.' }
  ]
});
