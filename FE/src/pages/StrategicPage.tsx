import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  Download,
  Gauge,
  Layers3,
  RefreshCw,
  Search,
  Shield,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import {
  coreMacroIndicators,
  riskManagementRules,
  secondaryMacroIndicators,
  strategicStocks
} from '../data/strategicData';
import type { AllocationMode, MacroIndicator, SecondaryMacroIndicator, StrategicStock } from '../data/strategicData';
import {
  calculateCreditLeverageScore,
  calculateCreditTankScore,
  calculateFiscalRoomScore,
  calculateGrowthScore,
  calculateInflationPressureScore,
  calculateVietnamMacroScore,
  classifyCreditTank,
  classifyEconomicCycle,
  classifyMarketRegime,
  generateSectorAllocation,
  generateSuggestedAllocation
} from '../utils/macroScoring';
import {
  calculateCANSLIMScore,
  calculateSEPAScore,
  calculateTotalAlphaScore,
  classifyAlphaScore,
  generateAIVerdict,
  getCatalystBadges
} from '../utils/stockScoring';
import { generateMacroVerdict, generateRiskWarning, generateStockThesis } from '../utils/aiVerdict';

const DISCLAIMER =
  'Thông tin chỉ phục vụ phân tích nội bộ, không phải khuyến nghị đầu tư. Cần kết hợp thêm dữ liệu thị trường, kỹ thuật, dòng tiền và quản trị rủi ro trước khi ra quyết định.';

const statusClass = (status: string) => {
  if (status.includes('Tốt')) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  if (status.includes('Rủi ro')) return 'border-rose-500/25 bg-rose-500/10 text-rose-300';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
};

const regimeClass = (regime: string) => {
  if (regime.includes('Risk-off') || regime.includes('Defensive')) return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
  if (regime.includes('Selective')) return 'text-blue-300 bg-blue-500/10 border-blue-500/25';
  if (regime.includes('Risk-on')) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  return 'text-slate-300 bg-slate-500/10 border-slate-500/25';
};

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const scoreForIndicator = (indicator: MacroIndicator) => {
  if (indicator.id === 'credit_to_gdp') return calculateCreditLeverageScore(indicator.value);
  if (indicator.id === 'public_debt_to_gdp') return calculateFiscalRoomScore(indicator.value);
  if (indicator.id === 'gdp_growth') return calculateGrowthScore(indicator.value);
  return calculateInflationPressureScore(3.2, 3.9, 2.1);
};

const coreCards = [
  {
    ids: ['credit_to_gdp'],
    title: 'Dư nợ tín dụng / GDP',
    meaning:
      'Tín dụng/GDP 125% cho thấy nền kinh tế đang sử dụng đòn bẩy cao. Điều này vẫn có thể hỗ trợ tăng trưởng ngắn hạn, nhưng làm giảm dư địa bơm tín dụng thêm.',
    equityImpact: 'Không nên mua đuổi cổ phiếu đầu cơ. Chỉ ưu tiên doanh nghiệp leader, có lợi nhuận thật, dòng tiền thật.',
    realEstateImpact: 'Cẩn trọng với bất động sản dùng đòn bẩy cao. Chỉ xem xét tài sản tốt, pháp lý sạch, vay nợ thấp.',
    warning: 'Đòn bẩy hệ thống cao, tránh all-in.'
  },
  {
    ids: ['public_debt_to_gdp'],
    title: 'Nợ công / GDP',
    meaning:
      'Nợ công/GDP 37% là điểm sáng lớn. Chính phủ còn dư địa tài khóa để hỗ trợ tăng trưởng, đặc biệt qua đầu tư công và hạ tầng.',
    equityImpact: 'Tích cực cho nhóm đầu tư công, hạ tầng, vật liệu, xây dựng, khu công nghiệp.',
    realEstateImpact: 'Tích cực gián tiếp qua hạ tầng và khu vực hưởng lợi đầu tư công.',
    warning: 'Dư địa tài khóa là điểm đỡ chính.'
  },
  {
    ids: ['cpi_current', 'cpi_pressure', 'ppi'],
    title: 'CPI / PPI',
    meaning:
      'CPI 3.2% vẫn trong vùng kiểm soát, nhưng CPI áp lực 3.9% đã gần vùng cẩn trọng. PPI 2.1% cho thấy chi phí đầu vào chưa quá căng nhưng cần theo dõi.',
    equityImpact: 'Lạm phát chưa đủ xấu để siết chính sách, nhưng không còn dư địa nới lỏng quá mạnh.',
    realEstateImpact: 'Lãi suất có thể còn hỗ trợ, nhưng nếu CPI vượt 4.5%-5% thì bất động sản sẽ chịu áp lực.',
    warning: 'Theo dõi CPI áp lực sát vùng 4%.'
  },
  {
    ids: ['gdp_growth'],
    title: 'Tăng trưởng GDP',
    meaning:
      'GDP 6.8% cho thấy nền kinh tế vẫn tăng trưởng tốt. Tuy nhiên, do tín dụng/GDP đã ở mức cao, đây không phải môi trường early-cycle dễ tiền.',
    equityImpact: 'Tích cực cho lợi nhuận doanh nghiệp, nhưng nên ưu tiên nhóm có tăng trưởng thật.',
    realEstateImpact: 'Hỗ trợ nhu cầu thực, nhưng không đủ để biện minh cho việc mua đuổi tài sản đầu cơ.',
    warning: 'Tăng trưởng tốt nhưng phải kiểm tra đòn bẩy.'
  }
];

export const CoreMacroIndicatorCard: React.FC<{
  title: string;
  indicators: MacroIndicator[];
  meaning: string;
  equityImpact: string;
  realEstateImpact: string;
  warning: string;
}> = ({ title, indicators, meaning, equityImpact, realEstateImpact, warning }) => {
  const primary = indicators[0];
  const score = title === 'CPI / PPI' ? 70 : scoreForIndicator(primary);
  const status = title === 'CPI / PPI' ? 'Cẩn trọng nhẹ' : primary.status;

  return (
    <article className="terminal-card p-6 rounded-2xl flex flex-col gap-5 min-h-[360px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">{primary.category}</p>
          <h3 className="text-lg font-black text-white mt-1">{title}</h3>
        </div>
        <span className={`px-3 py-1 rounded-lg border text-[10px] font-black ${statusClass(status)}`}>{status}</span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {indicators.map((indicator) => (
            <div key={indicator.id}>
              <p className="text-[10px] text-slate-500 font-bold">{indicator.name}</p>
              <p className="text-3xl font-black text-white tabular-nums">
                {formatNumber(indicator.value)}
                <span className="text-sm text-slate-500 ml-1">{indicator.unit}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-bold">Score</p>
          <p className="text-2xl font-black text-blue-300">{score}/100</p>
        </div>
      </div>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${score}%` }} />
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs leading-relaxed">
        <p className="text-slate-300">{meaning}</p>
        <p className="text-slate-400"><span className="text-emerald-300 font-bold">Cổ phiếu:</span> {equityImpact}</p>
        <p className="text-slate-400"><span className="text-amber-300 font-bold">Bất động sản:</span> {realEstateImpact}</p>
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-xl border border-slate-800 bg-black/20 px-3 py-2 text-[11px] text-slate-300">
        <AlertTriangle size={14} className="text-amber-300 shrink-0" />
        {warning}
      </div>
    </article>
  );
};

export const VietnamMacroCycleCore: React.FC = () => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black text-blue-300 uppercase">Demo Data / Needs Live API</p>
        <h2 className="text-2xl font-black text-white">Vietnam Macro Cycle Core</h2>
      </div>
      <p className="text-xs text-slate-400 max-w-2xl">
        Core decision chỉ dựa trên tín dụng/GDP, nợ công/GDP, CPI/PPI và tăng trưởng GDP. Các chỉ số phụ chỉ dùng làm cảnh báo.
      </p>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {coreCards.map((card) => (
        <CoreMacroIndicatorCard
          key={card.title}
          title={card.title}
          indicators={coreMacroIndicators.filter((indicator) => card.ids.includes(indicator.id))}
          meaning={card.meaning}
          equityImpact={card.equityImpact}
          realEstateImpact={card.realEstateImpact}
          warning={card.warning}
        />
      ))}
    </div>
  </section>
);

export const MacroScoreGauge: React.FC = () => {
  const score = calculateVietnamMacroScore(coreMacroIndicators);
  const regime = classifyMarketRegime(score);
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-blue-300">
          <Gauge size={20} />
          <h3 className="font-black text-sm">Vietnam Macro Score</h3>
        </div>
        <span className={`px-3 py-1 rounded-lg border text-[10px] font-black ${regimeClass(regime)}`}>{regime}</span>
      </div>
      <div className="flex items-end gap-4">
        <span className="text-6xl font-black text-white">{score}</span>
        <span className="text-xl font-black text-slate-500 mb-2">/100</span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        Việt Nam vẫn có nền tăng trưởng tốt và dư địa tài khóa tích cực, nhưng tín dụng/GDP cao khiến hệ thống không còn ở trạng thái dễ tiền toàn diện. Chiến lược phù hợp là mua chọn lọc, không all-in.
      </p>
    </section>
  );
};

export const EconomicCycleEngine: React.FC = () => {
  const cycle = classifyEconomicCycle(coreMacroIndicators);
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center gap-3 text-orange-300">
        <Layers3 size={20} />
        <h3 className="font-black text-sm">Economic Cycle Engine</h3>
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase">Pha chu kỳ</p>
        <p className="text-3xl font-black text-orange-300">{cycle}</p>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        GDP 6.8% cho thấy tăng trưởng vẫn tốt, CPI 3.2% còn kiểm soát, nợ công/GDP 37% là điểm sáng lớn. Tuy nhiên tín dụng/GDP 125% cho thấy nền kinh tế đã sử dụng nhiều đòn bẩy. Do đó chiến lược phù hợp là Selective Risk-on: mua cổ phiếu dẫn đầu, tăng trưởng thật, catalyst rõ và điểm mua kỹ thuật tốt.
      </p>
    </section>
  );
};

export const CreditTankCard: React.FC = () => {
  const score = calculateCreditTankScore(coreMacroIndicators);
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center gap-3 text-cyan-300">
        <BarChart3 size={20} />
        <h3 className="font-black text-sm">Credit Tank</h3>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Credit Tank Score</p>
          <p className="text-5xl font-black text-white">{score}</p>
        </div>
        <span className="text-right text-xs font-bold text-cyan-300 max-w-[160px]">{classifyCreditTank(score)}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        Tăng trưởng GDP còn tốt và nợ công thấp là điểm hỗ trợ, nhưng tín dụng/GDP 125% cho thấy nền kinh tế đã dùng nhiều đòn bẩy. Chỉ nên giải ngân chọn lọc vào cổ phiếu dẫn đầu, không mua đuổi tài sản đầu cơ.
      </p>
    </section>
  );
};

export const SuggestedAllocationCard: React.FC = () => {
  const [mode, setMode] = useState<AllocationMode>('Balanced');
  const allocation = generateSuggestedAllocation(mode);
  const rows = [
    ['Cổ phiếu', allocation.stocks, 'bg-emerald-400'],
    ['Tiền mặt', allocation.cash, 'bg-blue-400'],
    ['Bất động sản chọn lọc', allocation.realEstate, 'bg-amber-400'],
    ['Margin', allocation.margin, 'bg-rose-400']
  ];
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-emerald-300">
          <Target size={20} />
          <h3 className="font-black text-sm">Suggested Allocation</h3>
        </div>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as AllocationMode)}
          className="bg-black/30 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-200"
        >
          <option>Conservative</option>
          <option>Balanced</option>
          <option>Aggressive</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-4">
            <div className={`h-1.5 w-10 rounded-full ${color}`} />
            <p className="text-[10px] text-slate-500 font-bold mt-3">{label}</p>
            <p className="text-lg font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Do Vietnam Macro Score khoảng 70/100, có thể duy trì risk-on chọn lọc. Tập trung cổ phiếu leader, hạn chế penny và bất động sản đòn bẩy cao.
      </p>
    </section>
  );
};

export const BuySellDecisionFramework: React.FC = () => (
  <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
    <div className="flex items-center gap-3 text-emerald-300">
      <CheckCircle2 size={20} />
      <h3 className="font-black text-sm">Buy / Sell Decision Framework</h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="font-black text-emerald-300">Có thể mua cổ phiếu chọn lọc</p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          Macro Score &gt; 65, GDP &gt; 5.5%, CPI &lt; 4%, nợ công/GDP &lt; 50%, tín dụng/GDP chưa vượt 130%. Chỉ mua cổ phiếu đạt CANSLIM + SEPA.
        </p>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="font-black text-amber-300">Không mua đuổi / không all-in</p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          Tín dụng/GDP &gt; 120% và CPI áp lực gần 4% yêu cầu tránh penny, tránh cổ phiếu extended, tránh bất động sản dùng đòn bẩy cao.
        </p>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="font-black text-blue-300">Bất động sản chọn lọc</p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          Có thể phục hồi chọn lọc nếu lãi suất thấp và pháp lý cải thiện, nhưng không mua đuổi vì tín dụng/GDP đã 125%.
        </p>
      </div>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <p className="font-black text-rose-300">Giảm tỷ trọng khi trigger xấu</p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          CPI vượt 4.5%-5%, tín dụng/GDP vượt 130%, GDP dưới 5.5%, VN-Index mất MA200 hoặc cổ phiếu thủng stop loss 7%-8%.
        </p>
      </div>
    </div>
  </section>
);

export const SectorStrategyPanel: React.FC = () => {
  const allocation = generateSectorAllocation();
  const groups = [
    ['Overweight', allocation.overweight, 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5'],
    ['Neutral', allocation.neutral, 'text-blue-300 border-blue-500/20 bg-blue-500/5'],
    ['Underweight', allocation.underweight, 'text-rose-300 border-rose-500/20 bg-rose-500/5']
  ] as const;
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center gap-3 text-blue-300">
        <TrendingUp size={20} />
        <h3 className="font-black text-sm">Sector Strategy</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groups.map(([title, sectors, color]) => (
          <div key={title} className={`rounded-xl border p-4 ${color}`}>
            <p className="font-black">{title}</p>
            <div className="mt-4 flex flex-col gap-3">
              {sectors.map((item) => (
                <div key={item.sector}>
                  <p className="text-sm font-black text-white">{item.sector}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{item.tickers}</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export const SecondaryMacroWarnings: React.FC<{ indicators: SecondaryMacroIndicator[] }> = ({ indicators }) => (
  <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-amber-300">
        <AlertTriangle size={20} />
        <h3 className="font-black text-sm">Secondary Macro Warnings</h3>
      </div>
      <span className="text-[10px] text-slate-500 font-bold">Phụ, không lấn át core</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {indicators.map((indicator) => (
        <div key={indicator.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
          <p className="text-[10px] text-slate-500 font-bold">{indicator.name}</p>
          <p className="text-sm font-black text-white mt-1">
            {formatNumber(indicator.value)} <span className="text-slate-500">{indicator.unit}</span>
          </p>
          <span className={`inline-flex mt-2 px-2 py-0.5 rounded border text-[9px] font-bold ${statusClass(indicator.status)}`}>{indicator.status}</span>
        </div>
      ))}
    </div>
  </section>
);

export const CatalystBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-200">{label}</span>
);

export const CANSLIMScoreCard: React.FC<{ stock: StrategicStock }> = ({ stock }) => {
  const score = calculateCANSLIMScore(stock);
  return (
    <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
      <p className="text-[10px] text-slate-500 font-bold">CANSLIM Score</p>
      <p className="text-3xl font-black text-white">{score}</p>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {Object.entries(stock.canslim).map(([key, value]) => (
          <div key={key} title={`${key.toUpperCase()}: ${value}`} className="h-14 rounded bg-slate-800 overflow-hidden flex items-end">
            <div className="w-full bg-blue-500" style={{ height: `${value}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SEPAScoreCard: React.FC<{ stock: StrategicStock }> = ({ stock }) => {
  const score = calculateSEPAScore(stock);
  return (
    <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
      <p className="text-[10px] text-slate-500 font-bold">SEPA Score</p>
      <p className="text-3xl font-black text-white">{score}</p>
      <p className="mt-2 text-xs font-bold text-emerald-300">{stock.sepa.status}</p>
      <p className="mt-2 text-xs text-slate-400">Trend Template, nền giá, breakout và risk/reward phải cùng xác nhận.</p>
    </div>
  );
};

export const WatchlistFilters: React.FC<{
  query: string;
  sector: string;
  setup: string;
  sortBy: string;
  onQuery: (value: string) => void;
  onSector: (value: string) => void;
  onSetup: (value: string) => void;
  onSortBy: (value: string) => void;
}> = ({ query, sector, setup, sortBy, onQuery, onSector, onSetup, onSortBy }) => {
  const sectors = ['Tất cả', ...Array.from(new Set(strategicStocks.map((stock) => stock.sector)))];
  const setups = ['Tất cả', ...Array.from(new Set(strategicStocks.map((stock) => stock.setupStatus)))];
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Tìm ticker"
          className="w-full bg-black/30 border border-slate-800 rounded-xl py-3 pl-10 pr-3 text-xs text-white focus:outline-none focus:border-blue-500"
        />
      </div>
      <select value={sector} onChange={(event) => onSector(event.target.value)} className="bg-black/30 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white">
        {sectors.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={setup} onChange={(event) => onSetup(event.target.value)} className="bg-black/30 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white">
        {setups.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={sortBy} onChange={(event) => onSortBy(event.target.value)} className="bg-black/30 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white">
        <option value="total">Sort Total Alpha</option>
        <option value="canslim">Sort CANSLIM</option>
        <option value="sepa">Sort SEPA</option>
        <option value="macro">Sort Macro Fit</option>
      </select>
    </div>
  );
};

export const StrategicAlphaBoard: React.FC<{ onSelectStock: (stock: StrategicStock) => void }> = ({ onSelectStock }) => {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('Tất cả');
  const [setup, setSetup] = useState('Tất cả');
  const [sortBy, setSortBy] = useState('total');
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => {
    const scored = strategicStocks
      .filter((stock) => stock.ticker.includes(query.toUpperCase()) || stock.company.toLowerCase().includes(query.toLowerCase()))
      .filter((stock) => sector === 'Tất cả' || stock.sector === sector)
      .filter((stock) => setup === 'Tất cả' || stock.setupStatus === setup);

    const valueForSort = (stock: StrategicStock) => {
      if (sortBy === 'canslim') return calculateCANSLIMScore(stock);
      if (sortBy === 'sepa') return calculateSEPAScore(stock);
      if (sortBy === 'macro') return stock.macroFitScore;
      return calculateTotalAlphaScore(stock);
    };

    return scored.sort((a, b) => valueForSort(b) - valueForSort(a));
  }, [query, sector, setup, sortBy]);

  const exportCsv = () => {
    const headers = ['Rank', 'Ticker', 'Company', 'Sector', 'Total Alpha', 'CANSLIM', 'SEPA', 'Macro Fit', 'AI Verdict'];
    const lines = rows.map((stock, index) => [
      index + 1,
      stock.ticker,
      stock.company,
      stock.sector,
      calculateTotalAlphaScore(stock),
      calculateCANSLIMScore(stock),
      calculateSEPAScore(stock),
      stock.macroFitScore,
      generateAIVerdict(stock)
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'strategic-alpha-board-v1.3.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const refreshData = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 550);
  };

  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white">Strategic Alpha Board</h3>
          <p className="text-xs text-slate-500 mt-1">Demo Data / Needs Live API. Click ticker để mở Stock Detail Drawer.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold text-slate-200 hover:border-blue-500">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={refreshData} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white active:scale-95">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh Data
          </button>
        </div>
      </div>

      <WatchlistFilters
        query={query}
        sector={sector}
        setup={setup}
        sortBy={sortBy}
        onQuery={setQuery}
        onSector={setSector}
        onSetup={setSetup}
        onSortBy={setSortBy}
      />

      {loading && <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-200">Đang refresh dữ liệu demo...</div>}
      {!loading && rows.length === 0 && <div className="rounded-xl border border-slate-800 bg-black/20 p-6 text-sm text-slate-400">Không có cổ phiếu phù hợp bộ lọc.</div>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto max-h-[620px] custom-scrollbar">
          <table className="w-full min-w-[2100px] text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-slate-950">
              <tr className="text-[10px] text-slate-500 font-black">
                {[
                  'Rank', 'Ticker', 'Company', 'Sector', 'Price', 'Change %', 'Market Cap', 'Liquidity', 'Macro Fit Score',
                  'Cycle Fit', 'Credit Sensitivity', 'Inflation Sensitivity', 'CANSLIM Score', 'SEPA Score', 'Catalyst Score',
                  'Relative Strength', 'Setup Status', 'Pivot Price', 'Buy Zone', 'Stop Loss', 'Target 1', 'Target 2',
                  'Risk / Reward', 'Position Size %', 'AI Verdict', 'Last Updated'
                ].map((head) => (
                  <th key={head} className="px-3 py-3 border-b border-slate-800 whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((stock, index) => {
                const total = calculateTotalAlphaScore(stock);
                return (
                  <tr key={stock.ticker} className="group hover:bg-slate-900/70">
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-400">#{index + 1}</td>
                    <td className="px-3 py-4 border-b border-slate-900">
                      <button onClick={() => onSelectStock(stock)} className="font-black text-blue-300 hover:text-white">{stock.ticker}</button>
                    </td>
                    <td className="px-3 py-4 border-b border-slate-900 text-white font-bold">{stock.company}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.sector}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-white tabular-nums">{formatNumber(stock.price)}</td>
                    <td className={`px-3 py-4 border-b border-slate-900 tabular-nums ${stock.changePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{stock.changePct >= 0 ? '+' : ''}{stock.changePct}%</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.marketCap}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.liquidity}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-blue-300 font-black">{stock.macroFitScore}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300 max-w-[180px]">{stock.cycleFit}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.creditSensitivity}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.inflationSensitivity}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-emerald-300 font-black">{calculateCANSLIMScore(stock)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-cyan-300 font-black">{calculateSEPAScore(stock)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-amber-300 font-black">{stock.catalystScore}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-200 font-black">{stock.relativeStrengthScore}</td>
                    <td className="px-3 py-4 border-b border-slate-900">
                      <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-200">{stock.setupStatus}</span>
                    </td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{formatNumber(stock.pivotPrice)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.buyZone}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-rose-300">{formatNumber(stock.stopLoss)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-emerald-300">{formatNumber(stock.target1)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-emerald-300">{formatNumber(stock.target2)}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.riskRewardScore}/100</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300">{stock.positionSizePct}</td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-300 max-w-[260px]">
                      <span className="text-blue-300 font-black">{total}</span> {classifyAlphaScore(total)}. {generateAIVerdict(stock)}
                    </td>
                    <td className="px-3 py-4 border-b border-slate-900 text-slate-500">{stock.lastUpdated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const AIStrategicAnalystPanel: React.FC<{ selectedStock: StrategicStock | null; onSelectStock: (stock: StrategicStock) => void }> = ({ selectedStock, onSelectStock }) => {
  const [memoGenerated, setMemoGenerated] = useState(false);
  const stock = selectedStock ?? strategicStocks[0];
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-cyan-300">
          <Brain size={20} />
          <h3 className="font-black text-sm">AI Strategic Analyst</h3>
        </div>
        <button onClick={() => setMemoGenerated(true)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white">Generate AI Strategy Memo</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="text-[10px] text-slate-500 font-bold">Macro Verdict</p>
          <p className="text-sm text-slate-200 leading-relaxed mt-2">{generateMacroVerdict(coreMacroIndicators)}</p>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="text-[10px] text-slate-500 font-bold">Action Plan</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            <li>Tuần này: chỉ giải ngân khi VN-Index giữ xu hướng và cổ phiếu vào vùng mua.</li>
            <li>Quan sát: CPI áp lực, tỷ giá, volume breakout và distribution day.</li>
            <li>Tăng tỷ trọng: khi leader breakout volume xác nhận.</li>
            <li>Giảm tỷ trọng: khi CPI vượt 4.5% hoặc VN-Index mất MA200.</li>
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-emerald-300">Buy / Sell Bias</p>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">Có thể mua cổ phiếu, nhưng chỉ mua leader có CANSLIM + SEPA đạt chuẩn. Không mua đuổi cổ phiếu đã tăng xa nền giá. Bất động sản chỉ chọn tài sản tốt, pháp lý sạch, đòn bẩy thấp.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-blue-300">Sector Call</p>
          <p className="text-xs text-slate-300 mt-2">Overweight: công nghệ, chứng khoán, ngân hàng chất lượng, đầu tư công. Neutral: bất động sản chọn lọc, tiêu dùng. Underweight: penny, BĐS đòn bẩy cao.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-rose-300">Risk Triggers</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {generateRiskWarning().slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-white">Stock Thesis: {stock.ticker}</p>
          <button onClick={() => onSelectStock(stock)} className="text-xs font-bold text-cyan-300 hover:text-white">Ask AI About This Stock</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {getCatalystBadges(stock.ticker, stock.sector).map((badge) => <CatalystBadge key={badge} label={badge} />)}
        </div>
        <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
          {generateStockThesis(stock).map((line) => <li key={line} className="rounded-lg bg-slate-950/60 p-3">{line}</li>)}
        </ul>
      </div>
      {memoGenerated && <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">{DISCLAIMER}</p>}
    </section>
  );
};

export const StockDetailDrawer: React.FC<{ stock: StrategicStock | null; onClose: () => void }> = ({ stock, onClose }) => {
  if (!stock) return null;
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60">
      <aside className="h-full w-full max-w-xl overflow-y-auto custom-scrollbar border-l border-slate-800 bg-slate-950 p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-slate-500 font-bold">{stock.sector}</p>
            <h3 className="text-4xl font-black text-white">{stock.ticker}</h3>
            <p className="text-sm text-slate-400">{stock.company}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 p-3 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <CANSLIMScoreCard stock={stock} />
          <SEPAScoreCard stock={stock} />
        </div>
        <div className="mt-6 rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="font-black text-white">AI Stock Thesis</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
            {generateStockThesis(stock).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {getCatalystBadges(stock.ticker, stock.sector).map((badge) => <CatalystBadge key={badge} label={badge} />)}
        </div>
        <p className="mt-6 text-[11px] text-slate-500 leading-relaxed">{DISCLAIMER}</p>
      </aside>
    </div>
  );
};

export const RiskManagementPanel: React.FC = () => (
  <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
    <div className="flex items-center gap-3 text-rose-300">
      <Shield size={20} />
      <h3 className="font-black text-sm">Risk Management Rules</h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {riskManagementRules.map((rule, index) => (
        <div key={rule} className="rounded-xl border border-slate-800 bg-black/20 p-3 text-xs text-slate-300">
          <span className="mr-2 text-rose-300 font-black">{index + 1}.</span>{rule}
        </div>
      ))}
    </div>
  </section>
);

export const AlertCenter: React.FC = () => (
  <section className="terminal-card p-7 rounded-2xl flex flex-col gap-4">
    <div className="flex items-center gap-3 text-amber-300">
      <AlertTriangle size={20} />
      <h3 className="font-black text-sm">Alert Center</h3>
    </div>
    {generateRiskWarning().map((warning) => (
      <div key={warning} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 text-xs text-slate-300">{warning}</div>
    ))}
  </section>
);

export const SectorHeatmap: React.FC = () => {
  const sectors = generateSectorAllocation();
  const tiles = [
    ...sectors.overweight.map((item) => ({ ...item, tone: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-200' })),
    ...sectors.neutral.map((item) => ({ ...item, tone: 'bg-blue-500/10 border-blue-500/20 text-blue-200' })),
    ...sectors.underweight.map((item) => ({ ...item, tone: 'bg-rose-500/10 border-rose-500/20 text-rose-200' }))
  ];
  return (
    <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
      <h3 className="font-black text-sm text-white">Sector Heatmap</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <div key={tile.sector} className={`rounded-xl border p-4 ${tile.tone}`}>
            <p className="text-sm font-black">{tile.sector}</p>
            <p className="text-[10px] text-slate-400 mt-1">{tile.tickers}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const PortfolioExposureCard: React.FC = () => (
  <section className="terminal-card p-7 rounded-2xl flex flex-col gap-5">
    <h3 className="font-black text-sm text-white">Portfolio Exposure</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        ['Cổ phiếu', '60%', 'text-emerald-300'],
        ['Tiền mặt', '30%', 'text-blue-300'],
        ['BĐS chọn lọc', '5%', 'text-amber-300'],
        ['Margin', '5%', 'text-rose-300']
      ].map(([label, value, color]) => (
        <div key={label} className="rounded-xl border border-slate-800 bg-black/20 p-4">
          <p className="text-[10px] text-slate-500 font-bold">{label}</p>
          <p className={`text-3xl font-black ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  </section>
);

export const StrategicPage: React.FC<{ activeTicker: string }> = ({ activeTicker }) => {
  const [selectedStock, setSelectedStock] = useState<StrategicStock | null>(null);
  const activeStock = strategicStocks.find((stock) => stock.ticker === activeTicker.toUpperCase()) ?? strategicStocks[0];

  return (
    <div className="flex flex-col gap-8">
      <section className="terminal-card p-7 rounded-2xl bg-slate-950/70">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black text-emerald-300 uppercase">Version 1.3 / Strategic Fund Dashboard</p>
            <h1 className="text-3xl md:text-5xl font-black text-white mt-2">Strategic Vietnam Macro & Growth Equity</h1>
            <p className="text-sm text-slate-400 mt-4 max-w-4xl leading-relaxed">
              Việt Nam đang ở trạng thái Selective Risk-on, thuộc pha Mid-cycle nghiêng Late-cycle. Dashboard ưu tiên quyết định thực chiến dựa trên 4 nhóm lõi: tín dụng/GDP, nợ công/GDP, CPI/PPI và GDP.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-blue-200">
            <ChevronDown size={16} />
            <span className="text-xs font-black">Market Regime: Selective Risk-on</span>
          </div>
        </div>
      </section>

      <VietnamMacroCycleCore />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <MacroScoreGauge />
        <EconomicCycleEngine />
        <CreditTankCard />
        <SuggestedAllocationCard />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BuySellDecisionFramework />
        <SecondaryMacroWarnings indicators={secondaryMacroIndicators} />
      </div>

      <SectorStrategyPanel />
      <AIStrategicAnalystPanel selectedStock={selectedStock ?? activeStock} onSelectStock={setSelectedStock} />
      <StrategicAlphaBoard onSelectStock={setSelectedStock} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RiskManagementPanel />
        <div className="flex flex-col gap-6">
          <PortfolioExposureCard />
          <AlertCenter />
        </div>
      </div>

      <SectorHeatmap />

      <footer className="rounded-2xl border border-slate-800 bg-black/30 p-5 text-xs text-slate-500 leading-relaxed">
        {DISCLAIMER}
      </footer>

      <StockDetailDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
};

export default StrategicPage;
