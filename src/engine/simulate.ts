import type { Asset, Project, ScenarioId } from '../types';
import { addMonths, clamp, parseYm, ymLabel } from '../lib/format';
import { SCENARIO_ORDER } from '../data/structures';
import { baseCollection, commitmentEnd, groupPlans, numVar, startKnown, startYm, totalCommitment } from './subscriptions';

// محرك المحاكاة الشهرية. كل الأرقام تقديرية ولا تُعد ضمانًا ولا أموالًا محصلة.
// مبادئ المحاسبة المطبقة:
//  - الاشتراكات المحصلة = اشتراكات الفئات الفعالة × نسبة التحصيل.
//  - أصل القرض المسترد ليس إيرادًا؛ يخفض رصيد القروض ويزيد النقد.
//  - شراء العقار ليس مصروفًا تشغيليًا؛ يخفض النقد ويضيف أصلًا بقيمته.
//  - صافي الإيجار = الإيجار بعد الشغور ثم المصاريف والصيانة.

export interface SimYear {
  index: number;
  label: string;
  subscriptions: number;
  founding: number;
  donations: number;
  loanRepayments: number;
  assetIncome: number;
  operating: number;
  aid: number;
  loansDisbursed: number;
  purchases: number;
  externalFunding: number;
  netCashFlow: number;
  /** التدفق التشغيلي: دون أصل القروض وشراء الأصول */
  operatingCashFlow: number;
  endCash: number;
  loansOutstanding: number;
  writtenOff: number;
  assetsValue: number;
  endowedValue: number;
  reserve: number;
  netWorth: number;
  distributable: number;
  need: number;
  coverage: number | null;
  activeSubscribers: number;
  cumulativeSubscriptions: number;
}

export interface PurchaseRec {
  assetId: string;
  name: string;
  month: number;
  year: number;
  label: string;
  cost: number;
  holding: Asset['holding'];
}

export interface SimResult {
  scenarioId: ScenarioId;
  startYm: string;
  horizonYears: number;
  years: SimYear[];
  endMonth: number | null;
  endLabel: string | null;
  totalCommitment: number;
  totalCollected: number;
  purchases: PurchaseRec[];
  notPurchased: { assetId: string; name: string }[];
  finalCoverage: number | null;
  sustainabilityIndex: number | null;
  indexParts: { coverage: number; liquidity: number; assets: number };
  requiredCapital: number | null;
  fundingGap: number | null;
  shortfallYears: number[];
  belowReserveYears: number[];
  loans: { planned: number; disbursed: number; repaid: number; writtenOff: number; outstandingEnd: number; unmet: number };
  issues: string[];
}

const MAX_YEARS = 30;

interface Runtime {
  asset: Asset;
  boughtAt: number | null;
  cost: number;
  base: number;
}

const isExisting = (a: Asset): boolean => a.status === 'owned' || a.status === 'waqf_documented';

/** صافي دخل الأصل السنوي (بالأسعار الحالية) لتقدير العائد المتوقع */
export const assetNetAnnual = (a: Asset, portfolioReturn: number, occupancyDelta = 0): number => {
  if (a.type === 'portfolio') return ((a.targetCost ?? a.estimatedValue ?? 0) * portfolioReturn) / 100 - (a.annualOpex ?? 0);
  const occ = clamp((a.occupancy ?? 100) + occupancyDelta, 0, 100) / 100;
  return (a.annualGrossIncome ?? 0) * occ - (a.annualMaintenance ?? 0) - (a.annualOpex ?? 0);
};

export const simulate = (p: Project, scenarioId: ScenarioId): SimResult => {
  const issues: string[] = [];
  const sc = p.scenarios[scenarioId];
  const horizon = clamp(Math.round(numVar(p, 'horizon_years') ?? 20), 1, MAX_YEARS);
  const N = horizon * 12;
  const start = startYm(p);
  const sp = parseYm(start) as { y: number; m: number };
  if (!startKnown(p)) issues.push('لم يُحدد تاريخ بداية الاشتراكات؛ استُخدم الشهر الحالي لغرض الحساب.');

  const plans = groupPlans(p);
  const withMembers = plans.filter((g) => g.count > 0);
  if (withMembers.length === 0) issues.push('لم تُدخل أعداد مشتركين مستهدفة في أي فئة.');
  if (numVar(p, 'monthly_contribution') == null && plans.every((g) => g.amount <= 0)) issues.push('قيمة الاشتراك الشهري غير محددة.');
  for (const g of withMembers) if (g.amount > 0 && g.end == null) issues.push(`مدة الاشتراك أو تاريخ انتهاء الالتزام غير محدد للفئة «${g.name}».`);

  const coll = clamp(baseCollection(p) + sc.collectionDelta, 0, 100) / 100;
  const infl = sc.inflation / 100;
  const growth = sc.subscriberGrowth / 100;
  const minReserve = numVar(p, 'min_cash_reserve') ?? 0;
  const reinvest = clamp(numVar(p, 'reinvest_share') ?? 0, 0, 100) / 100;
  const allowBefore = p.vars.allow_purchase_before_end !== 'no';
  const endIdx = commitmentEnd(plans);
  const endMonth = endIdx;
  const gateMonth = endIdx ?? 0;

  const opsAnnual = numVar(p, 'operating_expenses_annual') ?? 0;
  const aidAnnual = numVar(p, 'aid_annual_budget') ?? 0;
  const donations = numVar(p, 'annual_donations') ?? 0;
  const foundingSupport = numVar(p, 'founding_support') ?? 0;
  const foundingPayment = numVar(p, 'founding_payment') ?? 0;

  const loanYear = (numVar(p, 'loan_requests_per_year') ?? 0) * (numVar(p, 'loan_avg_amount') ?? 0);
  const poolPct = clamp(numVar(p, 'loan_pool_pct') ?? 0, 0, 100) / 100;
  const term = Math.max(1, Math.round(numVar(p, 'loan_term_months') ?? 12));
  if (loanYear > 0 && numVar(p, 'loan_pool_pct') == null) issues.push('خُصص عدد وقيمة للقروض دون تحديد حد أعلى لرصيد القروض؛ لن تُصرف قروض في المحاكاة.');
  if (loanYear > 0 && numVar(p, 'loan_term_months') == null) issues.push('مدة سداد القروض غير محددة؛ افتُرضت 12 شهرًا.');
  const dr = sc.loanDefault / 100;

  const rep = new Array<number>(N + 1).fill(0);
  const scheduleRepay = (m: number, amount: number, months: number): void => {
    for (let k = 1; k <= months; k++) if (m + k < N) rep[m + k] += amount / months;
  };
  const ledgerAt = new Map<number, { amount: number; term: number }[]>();
  for (const e of p.loanLedger) {
    if (!e.amount || e.amount <= 0 || !parseYm(e.startYm)) continue;
    const idx = (parseYm(e.startYm)!.y - sp.y) * 12 + (parseYm(e.startYm)!.m - sp.m);
    if (idx < 0 || idx >= N) continue;
    const list = ledgerAt.get(idx) ?? [];
    list.push({ amount: e.amount, term: Math.max(1, Math.round(e.termMonths ?? 12)) });
    ledgerAt.set(idx, list);
  }

  const rts: Runtime[] = p.assets.map((a) => {
    const existing = isExisting(a);
    const v = existing ? (a.estimatedValue ?? a.targetCost ?? 0) : 0;
    return { asset: a, boughtAt: existing ? 0 : null, cost: v, base: v };
  });
  const queue = rts.filter((r) => r.boughtAt == null);
  let qi = 0;

  const pg = sc.propertyGrowth / 100;
  const priceFor = (a: Asset, m: number): number =>
    (a.targetCost ?? 0) * (a.type === 'portfolio' ? 1 : Math.pow(1 + pg, m / 12));
  const earliest = (a: Asset): number =>
    a.targetYear != null ? Math.max(0, (a.targetYear - sp.y) * 12 - sp.m) : 0;

  const valueOf = (r: Runtime, m: number): number => {
    if (r.boughtAt == null) return 0;
    if (r.asset.type === 'portfolio') return r.base;
    return r.base * Math.pow(1 + pg, Math.max(0, m - r.boughtAt) / 12);
  };

  const incomeOf = (r: Runtime, m: number): { net: number; provision: number } => {
    if (r.boughtAt == null) return { net: 0, provision: 0 };
    const a = r.asset;
    const y = Math.floor(m / 12);
    const opex = (a.annualOpex ?? 0) * Math.pow(1 + infl, y);
    let netAnnual: number;
    if (a.type === 'portfolio') {
      netAnnual = (r.base * sc.portfolioReturn) / 100 - opex;
    } else {
      const rg = (a.growthRate ?? sc.rentGrowth) / 100;
      const occ = clamp((a.occupancy ?? 100) + sc.occupancyDelta, 0, 100) / 100;
      const gross = (a.annualGrossIncome ?? 0) * Math.pow(1 + rg, y);
      const maint = (a.annualMaintenance ?? 0) * Math.pow(1 + infl, y);
      netAnnual = gross * occ - maint - opex;
    }
    const net = netAnnual / 12;
    const provision = (Math.max(0, net) * (a.reservePct ?? 0)) / 100;
    return { net, provision };
  };

  const years: SimYear[] = [];
  const purchases: PurchaseRec[] = [];
  let cash = 0;
  let loansOut = 0;
  let writtenOffCum = 0;
  let maintReserve = 0;
  let cumSubs = 0;
  let loanPlannedTotal = 0;
  let loanDisbursedTotal = 0;
  let loanRepaidTotal = 0;
  let acc = blank();

  function blank() {
    return {
      subscriptions: 0, founding: 0, donations: 0, loanRepayments: 0, assetIncome: 0, operating: 0, aid: 0,
      loansDisbursed: 0, purchases: 0, externalFunding: 0, provision: 0, active: 0,
    };
  }

  for (let m = 0; m < N; m++) {
    const y = Math.floor(m / 12);
    const idxGrowth = Math.pow(1 + growth, y);

    // 1) الواردات
    let subs = 0;
    let founding = 0;
    let active = 0;
    for (const g of plans) {
      if (g.count <= 0) continue;
      const c = g.count * idxGrowth;
      if (g.end != null && g.amount > 0 && m >= g.begin && m < g.end) {
        subs += c * g.amount * coll;
        active += c;
      }
      if (m === g.begin) founding += g.count * foundingPayment * coll;
    }
    if (m === 0) founding += foundingSupport;
    const don = donations / 12;

    let assetNet = 0;
    let provision = 0;
    let assetsValue = 0;
    let endowed = 0;
    for (const r of rts) {
      const inc = incomeOf(r, m);
      assetNet += inc.net;
      provision += inc.provision;
    }
    maintReserve += provision;

    const repay = rep[m];
    const repayCash = repay * (1 - dr);
    const written = repay * dr;
    loansOut = Math.max(0, loansOut - repay);
    writtenOffCum += written;
    loanRepaidTotal += repayCash;

    // 2) الصرف
    const ops = (opsAnnual / 12) * Math.pow(1 + infl, y);
    const aid = (aidAnnual / 12) * Math.pow(1 + infl, y);

    cash += subs + founding + don + repayCash + assetNet - ops - aid;

    // 3) القروض: المخطط عامةً ثم القروض المحددة بعينها
    let disb = 0;
    const planned = (loanYear / 12) * Math.pow(1 + infl, y);
    loanPlannedTotal += planned;
    if (planned > 0) {
      const room = Math.max(0, poolPct * (cash + loansOut) - loansOut);
      const lendable = Math.max(0, cash - minReserve - maintReserve);
      disb = Math.min(planned, room, lendable);
      if (disb > 0) {
        scheduleRepay(m, disb, term);
        cash -= disb;
        loansOut += disb;
      }
    }
    for (const e of ledgerAt.get(m) ?? []) {
      scheduleRepay(m, e.amount, e.term);
      cash -= e.amount;
      loansOut += e.amount;
      disb += e.amount;
      loanPlannedTotal += e.amount;
    }
    loanDisbursedTotal += disb;

    // 4) شراء الأصول بالترتيب، أصل واحد في الشهر على الأكثر
    let bought = 0;
    let external = 0;
    if (qi < queue.length) {
      const r = queue[qi];
      const price = priceFor(r.asset, m);
      const need = Math.max(0, price - (r.asset.fundingAvailable ?? 0));
      const free = cash - minReserve - maintReserve;
      if (price > 0 && m >= earliest(r.asset) && (allowBefore || m >= gateMonth) && free >= need) {
        cash -= need;
        external = Math.min(price, r.asset.fundingAvailable ?? 0);
        r.boughtAt = m;
        r.cost = price;
        r.base = price;
        bought = price;
        qi += 1;
        purchases.push({
          assetId: r.asset.id,
          name: r.asset.name,
          month: m,
          year: Math.floor(m / 12) + 1,
          label: ymLabel(addMonths(start, m)),
          cost: price,
          holding: r.asset.holding,
        });
      }
    }

    for (const r of rts) {
      const v = valueOf(r, m);
      assetsValue += v;
      if (r.asset.holding === 'waqf') endowed += v;
    }

    cumSubs += subs;
    acc.subscriptions += subs;
    acc.founding += founding;
    acc.donations += don;
    acc.loanRepayments += repayCash;
    acc.assetIncome += assetNet;
    acc.operating += ops;
    acc.aid += aid;
    acc.loansDisbursed += disb;
    acc.purchases += bought;
    acc.externalFunding += external;
    acc.provision += provision;
    acc.active = active;

    if (m % 12 === 11) {
      const inflow = acc.subscriptions + acc.founding + acc.donations + acc.loanRepayments + acc.assetIncome + acc.externalFunding;
      const outflow = acc.operating + acc.aid + acc.loansDisbursed + acc.purchases;
      const need = acc.operating + acc.aid;
      const distributable = Math.max(0, acc.assetIncome - acc.provision) * (1 - reinvest);
      years.push({
        index: y + 1,
        label: String(sp.y + y),
        subscriptions: acc.subscriptions,
        founding: acc.founding,
        donations: acc.donations,
        loanRepayments: acc.loanRepayments,
        assetIncome: acc.assetIncome,
        operating: acc.operating,
        aid: acc.aid,
        loansDisbursed: acc.loansDisbursed,
        purchases: acc.purchases,
        externalFunding: acc.externalFunding,
        netCashFlow: inflow - outflow,
        operatingCashFlow: acc.subscriptions + acc.founding + acc.donations + acc.assetIncome - need,
        endCash: cash,
        loansOutstanding: loansOut,
        writtenOff: writtenOffCum,
        assetsValue,
        endowedValue: endowed,
        reserve: minReserve + maintReserve,
        netWorth: cash + loansOut + assetsValue,
        distributable,
        need,
        coverage: need > 0 ? distributable / need : null,
        activeSubscribers: acc.active,
        cumulativeSubscriptions: cumSubs,
      });
      acc = blank();
    }
  }

  const last = years[years.length - 1];
  const finalCoverage = last.coverage;
  const shortfallYears = years.filter((r) => r.endCash < 0).map((r) => Number(r.label));
  const belowReserveYears = years.filter((r) => r.endCash < minReserve).map((r) => Number(r.label));
  const targeted = p.assets.length;
  const reached = rts.filter((r) => r.boughtAt != null).length;

  const coverageScore = clamp(finalCoverage ?? 0, 0, 1);
  const liquidityScore = years.filter((r) => r.endCash >= minReserve && r.endCash >= 0).length / years.length;
  const assetsScore = targeted > 0 ? reached / targeted : 0;
  const hasNeed = last.need > 0;
  const sustainabilityIndex = hasNeed ? Math.round(100 * (0.5 * coverageScore + 0.3 * liquidityScore + 0.2 * assetsScore)) : null;
  if (!hasNeed) issues.push('لم تُدخل مصروفات تشغيلية أو ميزانية مساعدات؛ لا يمكن حساب تغطية النشاط ومؤشر الاستدامة.');

  // الفجوة التمويلية للوصول إلى الاستدامة
  let requiredCapital: number | null = null;
  let fundingGap: number | null = null;
  if (hasNeed) {
    const costs = p.assets.reduce((s, a) => s + (a.targetCost ?? a.estimatedValue ?? 0), 0);
    const nets = p.assets.reduce((s, a) => s + assetNetAnnual(a, sc.portfolioReturn, sc.occupancyDelta), 0);
    const yieldRate = costs > 0 ? nets / costs : sc.portfolioReturn / 100;
    const share = 1 - reinvest;
    if (yieldRate > 0 && share > 0) {
      requiredCapital = last.need / (yieldRate * share);
      const free = Math.max(0, last.endCash - last.reserve);
      fundingGap = Math.max(0, requiredCapital - (last.assetsValue + free));
    }
  }

  const notPurchased = rts.filter((r) => r.boughtAt == null).map((r) => ({ assetId: r.asset.id, name: r.asset.name }));
  if (notPurchased.length > 0) issues.push(`لا تسمح التدفقات المتوقعة بشراء ${notPurchased.length} من الأصول المستهدفة خلال أفق ${horizon} سنة.`);
  if (shortfallYears.length > 0) issues.push(`يصبح الرصيد النقدي سالبًا في السنوات: ${shortfallYears.join('، ')}.`);

  return {
    scenarioId,
    startYm: start,
    horizonYears: horizon,
    years,
    endMonth,
    endLabel: endIdx != null && endIdx > 0 ? ymLabel(addMonths(start, endIdx - 1)) : null,
    totalCommitment: totalCommitment(plans),
    totalCollected: cumSubs,
    purchases,
    notPurchased,
    finalCoverage,
    sustainabilityIndex,
    indexParts: { coverage: coverageScore, liquidity: liquidityScore, assets: assetsScore },
    requiredCapital,
    fundingGap,
    shortfallYears,
    belowReserveYears,
    loans: {
      planned: loanPlannedTotal,
      disbursed: loanDisbursedTotal,
      repaid: loanRepaidTotal,
      writtenOff: writtenOffCum,
      outstandingEnd: loansOut,
      unmet: Math.max(0, loanPlannedTotal - loanDisbursedTotal),
    },
    issues,
  };
};

export const simulateAll = (p: Project): Record<ScenarioId, SimResult> =>
  Object.fromEntries(SCENARIO_ORDER.map((id) => [id, simulate(p, id)])) as Record<ScenarioId, SimResult>;

/** أثر التعثر وانخفاض الإيجارات على السيناريو الأساسي */
export const stressTest = (
  p: Project,
  id: ScenarioId,
  extraDefaultPts: number,
  occupancyDropPts: number,
): { base: SimResult; stressed: SimResult } => {
  const base = simulate(p, id);
  const s = p.scenarios[id];
  const stressed = simulate(
    { ...p, scenarios: { ...p.scenarios, [id]: { ...s, loanDefault: s.loanDefault + extraDefaultPts, occupancyDelta: s.occupancyDelta - occupancyDropPts } } },
    id,
  );
  return { base, stressed };
};
