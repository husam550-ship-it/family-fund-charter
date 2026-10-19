import type { Asset, ContribGroup, Project, ScenarioId } from '../types';
import { baseCollection, numVar, startYm } from './subscriptions';
import { simulate } from './simulate';
import type { SimResult } from './simulate';

// الحاسبة العكسية ومقارنة الخيارات. تعتمد على المحرك نفسه فلا تختلف أرقامها عن المحاكاة.

const blankAsset = (i: number, cost: number): Asset => ({
  id: `syn-${i}`,
  name: `أصل افتراضي ${i + 1}`,
  type: 'residential',
  status: 'targeted',
  location: '',
  area: null,
  units: null,
  targetCost: cost,
  estimatedValue: cost,
  fundingAvailable: null,
  targetYear: null,
  fundingSource: '',
  annualGrossIncome: null,
  occupancy: null,
  annualMaintenance: null,
  annualOpex: null,
  growthRate: null,
  reservePct: null,
  ownership: 'none',
  deedNumber: '',
  waqfDoc: 'none',
  waqfConditions: '',
  nazir: '',
  distribution: '',
  holding: 'fund',
  notes: '',
});

const synthGroup = (subscribers: number): ContribGroup => ({
  id: 'syn-group',
  name: 'المشتركون',
  gender: 'mixed',
  target: subscribers,
  participation: 100,
  monthlyAmount: null,
  years: null,
  joinOffsetMonths: 0,
  actual: null,
});

export interface ReverseTarget {
  subscribers: number;
  years: number;
  assetCount: number;
  assetCost: number;
  reserve: number;
  horizonYears: number;
}

const synth = (p: Project, t: ReverseTarget, monthly: number, assetCount: number): Project => ({
  ...p,
  vars: {
    ...p.vars,
    monthly_contribution: monthly,
    subscription_years: t.years,
    duration_mode: 'uniform',
    end_mode: 'years',
    horizon_years: t.horizonYears,
    min_cash_reserve: t.reserve,
    subscription_start: startYm(p),
  },
  groups: [synthGroup(t.subscribers)],
  assets: Array.from({ length: assetCount }, (_, i) => blankAsset(i, t.assetCost)),
  loanLedger: [],
});

const meets = (r: SimResult, t: ReverseTarget): boolean =>
  r.purchases.length === t.assetCount &&
  r.years[r.years.length - 1].endCash >= t.reserve &&
  r.shortfallYears.length === 0;

export interface ReverseResult {
  feasible: boolean;
  monthly: number | null;
  analytic: number | null;
  currentMonthly: number | null;
  shortfallAtCurrent: number | null;
  assumptions: string[];
}

/** قيمة الاشتراك الشهري التقريبية اللازمة لتحقيق الأهداف */
export const requiredContribution = (p: Project, t: ReverseTarget, scenario: ScenarioId = 'base'): ReverseResult => {
  const coll = Math.min(100, Math.max(0, baseCollection(p) + p.scenarios[scenario].collectionDelta)) / 100;
  const ops = (numVar(p, 'operating_expenses_annual') ?? 0) + (numVar(p, 'aid_annual_budget') ?? 0);
  const support = numVar(p, 'founding_support') ?? 0;
  const donations = (numVar(p, 'annual_donations') ?? 0) * t.years;
  const needTotal = t.assetCount * t.assetCost + t.reserve + ops * t.years - support - donations;
  const denom = t.subscribers * 12 * t.years * coll;
  const analytic = denom > 0 ? Math.max(0, needTotal / denom) : null;

  const ok = (m: number): boolean => meets(simulate(synth(p, t, m, t.assetCount), scenario), t);
  const hi0 = 10_000_000 / Math.max(1, t.subscribers);
  let feasible = ok(hi0);
  let monthly: number | null = null;
  if (feasible) {
    let lo = 0;
    let hi = hi0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) hi = mid;
      else lo = mid;
    }
    monthly = Math.ceil(hi);
  } else {
    feasible = false;
  }

  const current = numVar(p, 'monthly_contribution');
  let shortfall: number | null = null;
  if (current != null) {
    const r = simulate(synth(p, t, current, t.assetCount), scenario);
    shortfall = r.notPurchased.length * t.assetCost;
  }
  return {
    feasible,
    monthly,
    analytic,
    currentMonthly: current,
    shortfallAtCurrent: shortfall,
    assumptions: [
      `نسبة التحصيل في السيناريو: ${(coll * 100).toFixed(0)}%`,
      'يُحتسب الشراء بأسعار تتضخم بحسب افتراض نمو الأسعار في السيناريو',
      'تُطبق مصروفات التشغيل والمساعدات والقروض كما أدخلتها في المشروع',
      'لا تُحتسب عوائد الأصول المفترضة (دخل الأصل صفر) تحفظًا',
      `الشراء مشروط بالإبقاء على احتياطي لا يقل عن ${Math.round(t.reserve).toLocaleString('en-US')} ريال`,
    ],
  };
};

export interface FundableResult {
  count: number;
  years: { n: number; label: string }[];
  firstLabel: string | null;
}

/** عدد الأصول الممكن تمويلها بقيمة اشتراك ومدة وعدد مشتركين معلومين */
export const fundableAssets = (
  p: Project,
  t: Omit<ReverseTarget, 'assetCount'> & { monthly: number },
  scenario: ScenarioId = 'base',
): FundableResult => {
  const full: ReverseTarget = { ...t, assetCount: 30 };
  const r = simulate(synth(p, full, t.monthly, 30), scenario);
  return {
    count: r.purchases.length,
    years: r.purchases.map((x, i) => ({ n: i + 1, label: x.label })),
    firstLabel: r.purchases[0]?.label ?? null,
  };
};

export interface OptionResult {
  perSubscriber: number;
  totalCommitment: number;
  totalCollected: number;
  endLabel: string | null;
  purchased: number;
  targeted: number;
  finalNetWorth: number;
  finalCash: number;
  index: number | null;
  coverage: number | null;
}

/** أثر خيار (قيمة ومدة) على المشروع الحالي بفئاته وأصوله */
export const evaluateOption = (p: Project, monthly: number, years: number, scenario: ScenarioId = 'base'): OptionResult => {
  const q: Project = {
    ...p,
    vars: { ...p.vars, monthly_contribution: monthly, subscription_years: years, duration_mode: 'uniform', end_mode: 'years' },
  };
  const r = simulate(q, scenario);
  const last = r.years[r.years.length - 1];
  return {
    perSubscriber: monthly * 12 * years,
    totalCommitment: r.totalCommitment,
    totalCollected: r.totalCollected,
    endLabel: r.endLabel,
    purchased: r.purchases.length,
    targeted: q.assets.length,
    finalNetWorth: last.netWorth,
    finalCash: last.endCash,
    index: r.sustainabilityIndex,
    coverage: r.finalCoverage,
  };
};
