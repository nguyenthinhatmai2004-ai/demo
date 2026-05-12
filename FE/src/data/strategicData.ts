export type StatusVi = 'Tá»‘t' | 'Cáº©n trá»ng' | 'Rá»§i ro' | 'Cáº©n trá»ng nháº¹';
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
  creditSensitivity: 'Tháº¥p' | 'Trung bÃ¬nh' | 'Cao';
  inflationSensitivity: 'Tháº¥p' | 'Trung bÃ¬nh' | 'Cao';
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

