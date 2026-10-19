import type { Asset, Project, Vars } from '../types';
import { VAR_BY_KEY } from './variables';

// بيانات توضيحية لاستعراض النظام فقط. ليست أعدادًا حقيقية ولا أموالًا فعلية ولا عقارات مملوكة.

const DEMO_VARS: Vars = {
  subscription_start: '2027-01',
  monthly_contribution: 400,
  subscription_years: 8,
  founding_support: 20000,
  annual_donations: 5000,
  loan_max_amount: 20000,
  loan_avg_amount: 10000,
  loan_requests_per_year: 4,
  loan_term_months: 24,
  loan_pool_pct: 30,
  aid_annual_budget: 40000,
  operating_expenses_annual: 15000,
  min_cash_reserve: 50000,
  reinvest_share: 20,
  endowment_target: 1800000,
  endowments_target_count: 2,
  board_members_count: 5,
  board_term_years: 4,
  board_max_terms: 2,
  board_meetings_per_year: 4,
  board_quorum_pct: 60,
  majority_ordinary_pct: 50,
  majority_critical_pct: 75,
  candidate_min_age: 25,
  adult_age: 18,
  late_suspend_months: 6,
  pause_max_months: 6,
  loan_cooldown_months: 12,
  review_cycle_years: 5,
  appeal_days: 30,
};

const demoAssets = (): Asset[] => {
  const base = {
    location: '',
    area: null,
    units: null,
    fundingSource: 'من الاشتراكات (توضيحي)',
    ownership: 'none' as const,
    deedNumber: '',
    waqfDoc: 'none' as const,
    waqfConditions: '',
    nazir: '',
    distribution: '',
    notes: 'بيان توضيحي غير حقيقي',
  };
  return [
    {
      ...base,
      id: 'demo-asset-1',
      name: 'عمارة سكنية (مثال توضيحي)',
      type: 'residential',
      status: 'targeted',
      units: 8,
      targetCost: 1200000,
      estimatedValue: 1200000,
      fundingAvailable: null,
      targetYear: 2032,
      annualGrossIncome: 120000,
      occupancy: 90,
      annualMaintenance: 12000,
      annualOpex: 8000,
      growthRate: null,
      reservePct: 10,
      holding: 'waqf',
    },
    {
      ...base,
      id: 'demo-asset-2',
      name: 'محلات تجارية (مثال توضيحي)',
      type: 'commercial',
      status: 'idea',
      units: 4,
      targetCost: 450000,
      estimatedValue: 450000,
      fundingAvailable: null,
      targetYear: 2036,
      annualGrossIncome: 54000,
      occupancy: 85,
      annualMaintenance: 4500,
      annualOpex: 3000,
      growthRate: null,
      reservePct: 10,
      holding: 'fund',
    },
  ];
};

export const applyDemo = (p: Project): Project => ({
  ...p,
  vars: { ...p.vars, ...DEMO_VARS },
  groups: p.groups.map((g) =>
    g.gender === 'male'
      ? { ...g, target: 40, participation: 85, actual: null }
      : g.gender === 'female'
        ? { ...g, target: 35, participation: 85, actual: null }
        : g,
  ),
  assets: [...p.assets.filter((a) => !a.id.startsWith('demo-')), ...demoAssets()],
  demo: true,
});

export const clearDemo = (p: Project): Project => ({
  ...p,
  vars: {
    ...p.vars,
    ...Object.fromEntries(Object.keys(DEMO_VARS).filter((k) => k in VAR_BY_KEY).map((k) => [k, VAR_BY_KEY[k].def])),
  },
  groups: p.groups.map((g) => ({ ...g, target: null, participation: 100, actual: null })),
  assets: p.assets.filter((a) => !a.id.startsWith('demo-')),
  demo: false,
});
