import type { MacroIndicator, StrategicStock } from '../data/strategicData';
import { calculateVietnamMacroScore, classifyEconomicCycle, classifyMarketRegime } from './macroScoring';
import { calculateCANSLIMScore, calculateSEPAScore, calculateTotalAlphaScore } from './stockScoring';

export const generateMacroVerdict = (indicators: MacroIndicator[]): string => {
  const score = calculateVietnamMacroScore(indicators);
  const regime = classifyMarketRegime(score);
  const cycle = classifyEconomicCycle(indicators);
  return `Việt Nam đang ở trạng thái ${regime}, thuộc pha ${cycle}. Tăng trưởng GDP vẫn tốt, lạm phát còn trong vùng kiểm soát và nợ công thấp là điểm hỗ trợ lớn. Tuy nhiên tín dụng/GDP 125% cho thấy nền kinh tế đã sử dụng nhiều đòn bẩy, nên không nên all-in hoặc mua đuổi. Chiến lược phù hợp là mua chọn lọc cổ phiếu leader có CANSLIM + SEPA tốt, ưu tiên doanh nghiệp có lợi nhuận thật, catalyst rõ, nền giá đẹp và quản trị rủi ro chặt.`;
};

export const generateRiskWarning = (): string[] => [
  'Tín dụng/GDP vượt 130%: giảm tỷ trọng tài sản rủi ro.',
  'CPI vượt 4.5%-5%: giảm nhóm nhạy cảm lãi suất.',
  'GDP giảm dưới 5.5%: giảm cổ phiếu chu kỳ.',
  'VN-Index mất MA200: dừng mua mới, chuyển phòng thủ.',
  'Cổ phiếu thủng stop loss 7%-8% hoặc failed breakout: bán kỷ luật.',
  'Catalyst không còn hiệu lực: hạ thesis và giảm tỷ trọng.'
];

export const generateStockThesis = (stock: StrategicStock): string[] => [
  `Luận điểm: ${stock.company} phù hợp với bối cảnh ${stock.cycleFit.toLowerCase()}.`,
  `Macro Fit: ${stock.macroFitScore}/100, nhạy tín dụng ${stock.creditSensitivity.toLowerCase()}, nhạy lạm phát ${stock.inflationSensitivity.toLowerCase()}.`,
  `CANSLIM: ${calculateCANSLIMScore(stock)}/100, SEPA: ${calculateSEPAScore(stock)}/100, Total Alpha: ${calculateTotalAlphaScore(stock)}/100.`,
  `Điều kiện mua: chỉ mua trong vùng ${stock.buyZone} khi volume xác nhận và thị trường không risk-off.`,
  `Điều kiện bán: cắt lỗ quanh ${stock.stopLoss.toLocaleString('vi-VN')} hoặc khi catalyst mất hiệu lực.`,
  `Kịch bản: Bull case hướng tới ${stock.target2.toLocaleString('vi-VN')}; base case ${stock.target1.toLocaleString('vi-VN')}; bear case thủng stop loss.`,
  `Position size gợi ý: ${stock.positionSizePct}. Không có đảm bảo lợi nhuận, phải quản trị rủi ro.`
];
