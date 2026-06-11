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
  catalysts?: string[];
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
