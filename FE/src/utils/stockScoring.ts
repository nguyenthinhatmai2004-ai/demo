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

const tickerCatalystBadges: Record<string, string[]> = {
  FPT: ['AI Factory và hợp đồng công nghệ quốc tế', 'Viễn thông và giáo dục giữ nền dòng tiền'],
  HPG: ['Dung Quất 2 ramp-up', 'Spread thép và tái tích trữ'],
  DGC: ['Chu kỳ giá phốt pho vàng', 'Dự án hóa chất mới'],
  SSI: ['Thanh khoản thị trường và nâng hạng', 'Deal ECM/IB quay lại'],
  VCI: ['Pipeline ngân hàng đầu tư', 'Tự doanh và brokerage hồi phục'],
  VND: ['Margin và thị phần môi giới', 'Tái định vị sau giai đoạn rủi ro vận hành'],
  VCB: ['Chất lượng tài sản và CASA', 'Tăng vốn và room tín dụng'],
  MBB: ['Hệ sinh thái số và CASA', 'Tín dụng bán lẻ/quốc phòng ổn định'],
  TCB: ['CASA phục hồi', 'Trái phiếu và bất động sản giảm áp lực'],
  ACB: ['Bán lẻ chất lượng cao', 'Cổ tức tiền mặt/cổ phiếu'],
  MWG: ['Bách Hóa Xanh hòa vốn và mở rộng', 'Điện máy/điện thoại hồi phục'],
  PNJ: ['Sức mua trang sức và mở cửa hàng', 'Giá vàng ổn định'],
  MSN: ['WinCommerce cải thiện biên', 'Giảm đòn bẩy và tái cấu trúc danh mục'],
  VNM: ['Biên sữa phục hồi', 'Xuất khẩu và thị phần nội địa'],
  VIC: ['VinFast và tiến độ gọi vốn', 'Bàn giao bất động sản và dịch vụ'],
  VHM: ['Bàn giao đại dự án', 'Pháp lý và presales'],
  KDH: ['Mở bán dự án thấp tầng', 'Bảng cân đối lành mạnh'],
  NLG: ['Bàn giao Akari/Waterpoint', 'Presales phục hồi'],
  CTD: ['Backlog xây dựng mới', 'Biên gộp hồi phục'],
  HHV: ['Đầu tư công và PPP giao thông', 'Lưu lượng thu phí'],
  VCG: ['Backlog hạ tầng', 'Bất động sản và thoái vốn']
};

export const getCatalystBadges = (stockOrTicker: StrategicStock | string, sector = ''): string[] => {
  const stock = typeof stockOrTicker === 'string' ? undefined : stockOrTicker;
  const ticker = (typeof stockOrTicker === 'string' ? stockOrTicker : stockOrTicker.ticker).toUpperCase();
  const resolvedSector = stock?.sector ?? sector;
  const fromApi = stock?.catalysts?.filter((item) => item.trim()).slice(0, 4) ?? [];
  if (fromApi.length > 0) return fromApi;
  if (tickerCatalystBadges[ticker]) return tickerCatalystBadges[ticker];

  const badges: string[] = [];
  if (['VIC', 'VHM', 'HPG', 'FPT', 'MSN', 'VCB', 'SSI', 'VNM', 'SAB'].includes(ticker)) badges.push('Nâng hạng / ETF');
  if (resolvedSector.includes('Công nghệ')) badges.push('Hợp đồng chuyển đổi số', 'AI và cloud');
  if (resolvedSector.includes('Chứng khoán')) badges.push('Thanh khoản thị trường', 'Dư nợ margin');
  if (resolvedSector.includes('Ngân hàng')) badges.push('Room tín dụng', 'CASA / NIM');
  if (resolvedSector.includes('Vật liệu') || resolvedSector.includes('Thép')) badges.push('Đầu tư công', 'Chu kỳ hàng hóa');
  if (resolvedSector.includes('Bất động sản')) badges.push('Pháp lý dự án', 'Presales');
  if (resolvedSector.includes('Tiêu dùng')) badges.push('Sức mua nội địa', 'Biên lợi nhuận');
  return badges;
};
