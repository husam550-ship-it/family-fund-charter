import { describe, expect, it } from 'vitest';
import type { Asset, Project } from '../types';
import { createDefaultProject } from '../data/defaults';
import { simulate, stressTest } from './simulate';
import { evaluateOption, fundableAssets, requiredContribution } from './reverse';
import { loanStats, repaymentSchedule, sustainableLoansPerYear } from './loans';
import { runReview } from './review';
import { fairnessFindings } from './fairness';
import { completionPercent, evaluateRequirements } from './progress';
import { commitmentEndLabel } from './subscriptions';

// مشروع بتحصيل كامل وتضخم صفري لتسهيل التحقق اليدوي من الأرقام
const base = (): Project => {
  const p = createDefaultProject();
  p.vars = {
    ...p.vars,
    subscription_start: '2027-01',
    monthly_contribution: 100,
    subscription_years: 10,
    regularity_rate: 100,
    late_rate: 0,
    late_recovery_rate: 0,
    exemption_rate: 0,
    horizon_years: 12,
    min_cash_reserve: 0,
    operating_expenses_annual: 0,
    aid_annual_budget: 0,
  };
  p.groups = p.groups.map((g) => ({ ...g, target: 10, participation: 100 }));
  for (const s of Object.values(p.scenarios)) {
    s.collectionDelta = 0;
    s.inflation = 0;
    s.propertyGrowth = 0;
    s.rentGrowth = 0;
    s.occupancyDelta = 0;
    s.loanDefault = 0;
    s.subscriberGrowth = 0;
  }
  return p;
};

const asset = (o: Partial<Asset>): Asset => ({
  id: 'a1', name: 'أصل', type: 'residential', status: 'targeted', location: '', area: null, units: null,
  targetCost: 100000, estimatedValue: 100000, fundingAvailable: null, targetYear: null, fundingSource: '',
  annualGrossIncome: null, occupancy: null, annualMaintenance: null, annualOpex: null, growthRate: null, reservePct: null,
  ownership: 'none', deedNumber: '', waqfDoc: 'none', waqfConditions: '', nazir: '', distribution: '', holding: 'fund', notes: '',
  ...o,
});

describe('الاشتراكات', () => {
  it('يحسب الاشتراكات المحصلة من الفئات الفعالة', () => {
    const r = simulate(base(), 'base');
    // فئتان × 10 أفراد × 100 ريال × 12 شهرًا
    expect(r.years[0].subscriptions).toBeCloseTo(2 * 10 * 100 * 12);
    expect(r.totalCommitment).toBe(2 * 10 * 100 * 120);
    expect(r.endLabel).toBe('ديسمبر 2036');
    expect(r.years[9].subscriptions).toBeCloseTo(24000);
    expect(r.years[10].subscriptions).toBe(0); // انتهى الالتزام
  });

  it('نسبة التحصيل تخفض الواردات', () => {
    const p = base();
    p.scenarios.base.collectionDelta = -20;
    expect(simulate(p, 'base').years[0].subscriptions).toBeCloseTo(24000 * 0.8);
  });

  it('اختلاف عدد المشتركين بين الفئات ينعكس على الإيراد', () => {
    const p = base();
    p.groups[0].target = 30;
    expect(simulate(p, 'base').years[0].subscriptions).toBeCloseTo((30 + 10) * 100 * 12);
  });

  it('مدة مختلفة لكل فئة تغيّر الالتزام الكلي دون حذف الفئة الأخرى', () => {
    const p = base();
    p.vars.duration_mode = 'by_gender';
    p.groups[0].years = 10;
    p.groups[1].years = 8;
    const r = simulate(p, 'base');
    expect(r.totalCommitment).toBe(10 * 100 * 120 + 10 * 100 * 96);
    expect(r.endLabel).toBe('ديسمبر 2036');
    expect(r.years[8].subscriptions).toBeCloseTo(10 * 100 * 12); // الفئة الثانية انتهت بعد 8 سنوات
  });

  it('انتهاء الالتزام بتاريخ محدد', () => {
    const p = base();
    p.vars.end_mode = 'fixed_date';
    p.vars.commitment_end_date = '2030-12';
    const r = simulate(p, 'base');
    expect(r.endLabel).toBe('ديسمبر 2030');
    expect(r.years[4].subscriptions).toBe(0);
  });

  it('عند غياب المدة لا يُفترض شيء ويُنبَّه المستخدم', () => {
    const p = base();
    p.vars.subscription_years = null;
    const r = simulate(p, 'base');
    expect(r.years[0].subscriptions).toBe(0);
    expect(r.issues.join(' ')).toContain('مدة الاشتراك');
    expect(commitmentEndLabel(p)).toBeNull();
  });
});

describe('الأصول العقارية', () => {
  const funded = (): Project => {
    const p = base();
    p.vars.founding_support = 500000;
    return p;
  };

  it('شراء العقار ينقص النقد ويضيف أصلًا ولا يُعد مصروفًا تشغيليًا', () => {
    const p = funded();
    const without = simulate(p, 'base');
    p.assets = [asset({})];
    const r = simulate(p, 'base');
    expect(r.purchases).toHaveLength(1);
    expect(r.years[0].purchases).toBeCloseTo(100000);
    expect(r.years[0].assetsValue).toBeCloseTo(100000);
    expect(r.years[0].endCash).toBeCloseTo(without.years[0].endCash - 100000);
    expect(r.years[0].operating).toBe(0); // لا يدخل في المصروفات التشغيلية
    expect(r.years[0].operatingCashFlow).toBeCloseTo(without.years[0].operatingCashFlow);
    expect(r.years[0].netWorth).toBeCloseTo(without.years[0].netWorth); // لا اختفاء للأصل من الميزانية
  });

  it('يحترم الاحتياطي الأدنى فلا يشتري إذا كانت السيولة غير كافية', () => {
    const p = funded();
    p.vars.min_cash_reserve = 450000;
    p.vars.founding_support = 500000;
    p.groups.forEach((g) => (g.target = 0));
    p.assets = [asset({ targetCost: 100000 })];
    expect(simulate(p, 'base').purchases).toHaveLength(0);
    p.vars.min_cash_reserve = 300000;
    expect(simulate(p, 'base').purchases).toHaveLength(1);
  });

  it('لا يشتري قبل انتهاء الاشتراكات إذا قُرر ذلك', () => {
    const p = funded();
    p.assets = [asset({})];
    p.vars.allow_purchase_before_end = 'no';
    const r = simulate(p, 'base');
    expect(r.purchases[0].month).toBeGreaterThanOrEqual(r.endMonth as number);
  });

  it('السنة المستهدفة تؤخر الشراء', () => {
    const p = funded();
    p.assets = [asset({ targetYear: 2031 })];
    expect(simulate(p, 'base').purchases[0].label).toBe('يناير 2031');
  });

  it('الأصل الممول جزئيًا يحتاج نقدًا أقل', () => {
    const p = funded();
    p.groups.forEach((g) => (g.target = 0));
    p.vars.founding_support = 60000;
    p.assets = [asset({ fundingAvailable: 50000 })];
    expect(simulate(p, 'base').purchases).toHaveLength(1);
  });

  it('تغيير الإيجار يحدّث الدخل وتغطية النشاط', () => {
    const p = funded();
    p.vars.operating_expenses_annual = 5000;
    p.assets = [asset({ annualGrossIncome: 10000, occupancy: 100, annualMaintenance: 1000 })];
    const a = simulate(p, 'base');
    expect(a.years[1].assetIncome).toBeCloseTo(9000);
    p.assets = [asset({ annualGrossIncome: 20000, occupancy: 100, annualMaintenance: 1000 })];
    const b = simulate(p, 'base');
    expect(b.years[1].assetIncome).toBeCloseTo(19000);
    expect(b.years[1].coverage!).toBeGreaterThan(a.years[1].coverage!);
  });

  it('انخفاض الإشغال يخفض الدخل (اختبار ضغط)', () => {
    const p = funded();
    p.vars.operating_expenses_annual = 5000;
    p.assets = [asset({ annualGrossIncome: 20000, occupancy: 100 })];
    const { base: a, stressed: b } = stressTest(p, 'base', 0, 25);
    expect(b.years[1].assetIncome).toBeLessThan(a.years[1].assetIncome);
  });

  it('الأصل المملوك مسبقًا يولّد دخلًا دون صرف نقدي', () => {
    const p = base();
    p.assets = [asset({ status: 'owned', annualGrossIncome: 12000, occupancy: 100 })];
    const r = simulate(p, 'base');
    expect(r.years[0].purchases).toBe(0);
    expect(r.years[0].assetIncome).toBeCloseTo(12000);
    expect(r.years[0].assetsValue).toBeCloseTo(100000);
  });
});

describe('القروض', () => {
  const lending = (): Project => {
    const p = base();
    p.vars.founding_support = 100000;
    p.vars.loan_avg_amount = 10000;
    p.vars.loan_requests_per_year = 2;
    p.vars.loan_term_months = 12;
    p.vars.loan_pool_pct = 50;
    return p;
  };

  it('أصل القرض المسترد ليس ربحًا: القيمة الإجمالية لا تتغير بالإقراض بلا تعثر', () => {
    const p = lending();
    const noLoans = simulate({ ...p, vars: { ...p.vars, loan_requests_per_year: 0 } }, 'base');
    const r = simulate(p, 'base');
    expect(r.years[0].loansDisbursed).toBeGreaterThan(0);
    expect(r.years[0].loansOutstanding).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) expect(r.years[i].netWorth).toBeCloseTo(noLoans.years[i].netWorth);
    expect(r.years[0].assetIncome).toBe(0);
    expect(r.years[0].operatingCashFlow).toBeCloseTo(noLoans.years[0].operatingCashFlow);
  });

  it('التعثر يخفض القيمة الإجمالية بمقدار المشطوب', () => {
    const p = lending();
    p.scenarios.base.loanDefault = 10;
    const clean = simulate(lending(), 'base');
    const r = simulate(p, 'base');
    expect(r.loans.writtenOff).toBeGreaterThan(0);
    expect(r.years[5].netWorth).toBeCloseTo(clean.years[5].netWorth - r.years[5].writtenOff);
  });

  it('يكتشف نقص السيولة عند تجاوز المخصصات', () => {
    const p = lending();
    p.vars.loan_requests_per_year = 100;
    p.vars.loan_pool_pct = 100;
    p.vars.min_cash_reserve = 20000;
    p.groups.forEach((g) => (g.target = 0));
    const r = simulate(p, 'base');
    expect(r.loans.unmet).toBeGreaterThan(0);
    expect(runReview(p).byKind.financial.some((c) => c.id === 'loans-unmet')).toBe(true);
  });

  it('المصروفات التشغيلية الكبيرة تسبب رصيدًا سالبًا ويُنبَّه إليه', () => {
    const p = base();
    p.vars.operating_expenses_annual = 100000;
    const r = simulate(p, 'base');
    expect(r.shortfallYears.length).toBeGreaterThan(0);
    expect(runReview(p).byKind.financial.some((c) => c.id === 'liquidity-shortfall')).toBe(true);
  });

  it('القرض المقيد بعينه يُجدول ويُسترد دون ربح', () => {
    const p = base();
    p.vars.founding_support = 50000;
    p.loanLedger = [{ id: 'l1', label: 'قرض', amount: 12000, startYm: '2027-03', termMonths: 12 }];
    const r = simulate(p, 'base');
    expect(r.years[0].loansDisbursed).toBeCloseTo(12000);
    expect(r.loans.repaid).toBeCloseTo(12000);
    expect(r.years[2].loansOutstanding).toBeCloseTo(0);
  });

  it('جدول الاسترداد أقساط متساوية بلا زيادة', () => {
    const s = repaymentSchedule(12000, 12);
    expect(s).toHaveLength(12);
    expect(s[0].principal).toBe(1000);
    expect(s[11].balance).toBeCloseTo(0);
    expect(s.reduce((a, b) => a + b.principal, 0)).toBeCloseTo(12000);
  });

  it('طاقة الإقراض المستدامة تقل بزيادة المدة والمبلغ', () => {
    const a = sustainableLoansPerYear(100000, 10000, 12)!;
    expect(sustainableLoansPerYear(100000, 10000, 24)!).toBeLessThan(a);
    expect(sustainableLoansPerYear(100000, 20000, 12)!).toBeLessThan(a);
    expect(loanStats(lending()).poolEndYear1).not.toBeNull();
  });
});

describe('الحاسبة العكسية ومقارنة الخيارات', () => {
  it('الاشتراك المطلوب يزيد بزيادة تكلفة العقار', () => {
    const p = base();
    const t = { subscribers: 20, years: 10, assetCount: 1, assetCost: 200000, reserve: 0, horizonYears: 12 };
    const a = requiredContribution(p, t);
    const b = requiredContribution(p, { ...t, assetCost: 400000 });
    expect(a.feasible && b.feasible).toBe(true);
    expect(b.monthly!).toBeGreaterThan(a.monthly!);
    // 200000 / (20 × 120 شهرًا) ≈ 83.3
    expect(a.monthly!).toBeGreaterThanOrEqual(84);
    expect(a.monthly!).toBeLessThan(120);
  });

  it('عدد الأصول الممكنة يزيد بزيادة الاشتراك', () => {
    const p = base();
    const t = { subscribers: 20, years: 10, assetCost: 200000, reserve: 0, horizonYears: 12 };
    const low = fundableAssets(p, { ...t, monthly: 100 });
    const high = fundableAssets(p, { ...t, monthly: 300 });
    expect(high.count).toBeGreaterThan(low.count);
    expect(high.firstLabel).not.toBeNull();
  });

  it('مقارنة الخيارات تعتمد المحرك نفسه', () => {
    const p = base();
    const a = evaluateOption(p, 100, 10);
    const c = evaluateOption(p, 200, 6);
    expect(a.perSubscriber).toBe(12000);
    expect(c.perSubscriber).toBe(14400);
    expect(c.totalCommitment).toBe(2 * 10 * 200 * 72);
  });
});

describe('الفحص والعدالة', () => {
  const pick = (p: Project, id: string, alt: string, status: 'approved' | 'discuss' = 'discuss'): void => {
    const c = p.clauses.find((x) => x.id === id)!;
    c.selectedAlt = alt;
    c.status = status;
  };

  it('يكتشف اختيارين متناقضين', () => {
    const p = createDefaultProject();
    pick(p, 'SUB-05', 'a', 'approved');
    pick(p, 'SUB-04', 'd');
    const r = runReview(p);
    expect(r.byKind.conflict.some((c) => c.id === 'conflict:open_ended')).toBe(true);
    expect(fairnessFindings(p).some((f) => f.rule === 'open-ended')).toBe(true);
  });

  it('ينبه إلى قصر المساعدة على المشتركين وإلى اختلاف تعريف المستفيد', () => {
    const p = createDefaultProject();
    pick(p, 'AID-05', 'c');
    expect(fairnessFindings(p).some((f) => f.rule === 'aid-contributors')).toBe(true);
    expect(runReview(p).byKind.conflict.some((c) => c.id === 'beneficiary-mismatch:aid')).toBe(true);
  });

  it('يكتشف غياب التظلم وتعارض المصالح عند استبعادهما', () => {
    const p = createDefaultProject();
    pick(p, 'FND-06', 'a');
    p.clauses.find((c) => c.id === 'FND-06')!.status = 'excluded';
    p.clauses.find((c) => c.id === 'BRD-04')!.status = 'excluded';
    const f = fairnessFindings(p).map((x) => x.rule);
    expect(f).toContain('no-appeal');
    expect(f).toContain('no-conflict');
  });

  it('يكتشف تفاوت المساهمة بين الفئات', () => {
    const p = base();
    p.vars.duration_mode = 'by_gender';
    p.groups[0].years = 10;
    p.groups[1].years = 6;
    const f = fairnessFindings(p).find((x) => x.rule === 'duration-gap')!;
    expect(f).toBeTruthy();
    expect(f.impact).toContain('فرق');
  });

  it('تغير متغير بعد الاعتماد يظهر تنبيهًا', () => {
    const p = base();
    const c = p.clauses.find((x) => x.id === 'SUB-02')!;
    c.status = 'approved';
    c.approvedVars = { monthly_contribution: 100, subscription_years: 10 };
    p.vars.monthly_contribution = 120;
    expect(runReview(p).byKind.conflict.some((x) => x.id === 'var-changed:SUB-02')).toBe(true);
  });

  it('يكتشف أصلًا موسومًا وقفًا موثقًا دون توثيق، وحدودًا نظامية للمجلس', () => {
    const p = base();
    p.assets = [asset({ status: 'waqf_documented' })];
    p.vars.board_members_count = 2;
    p.vars.board_meetings_per_year = 1;
    const ids = runReview(p).checks.map((c) => c.id);
    expect(ids).toContain('waqf-inconsistent:a1');
    expect(ids).toContain('legal-board-min');
    expect(ids).toContain('legal-meetings-min');
  });

  it('يرصد تسمية باسم متوفى', () => {
    const p = createDefaultProject();
    p.vars.namesake_status = 'deceased';
    pick(p, 'FND-01', 'a');
    expect(runReview(p).byKind.legal.some((c) => c.id === 'legal-naming-deceased')).toBe(true);
  });

  it('نسبة الاكتمال مبنية على متطلبات: صفر عند البداية ولا تقفز بإدخال نص فقط', () => {
    const p = createDefaultProject();
    expect(completionPercent(evaluateRequirements(p))).toBe(0);
    p.vars.monthly_contribution = 100;
    expect(completionPercent(evaluateRequirements(p))).toBe(0);
    pick(p, 'MEM-01', 'a', 'approved');
    expect(completionPercent(evaluateRequirements(p))).toBeGreaterThan(0);
  });

  it('مجاميع النسب لا تساوي 100% تُعد تعارضًا', () => {
    const p = createDefaultProject();
    p.loanFactors[0].weight = 40;
    expect(runReview(p).byKind.conflict.some((c) => c.id === 'sum:loan-weights')).toBe(true);
  });
});
