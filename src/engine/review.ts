import type { Project } from '../types';
import type { SectionId } from '../data/checklist';
import { activeFlags, clauseMap, clauseText, clauseVarKeys } from '../lib/clauses';
import { money, monthsBetween, parseYm } from '../lib/format';
import { labelOf } from './context';
import { sumShare, sumWeight } from './progress';
import { assetNetAnnual, simulateAll } from './simulate';
import type { SimResult } from './simulate';
import { baseCollection, numVar, startYm } from './subscriptions';

// محرك الفحص: يكشف النواقص والتعارضات قبل إصدار الميثاق.

export type CheckKind = 'review' | 'conflict' | 'open' | 'financial' | 'legal';
export type CheckSeverity = 'high' | 'medium' | 'low';

export interface Check {
  id: string;
  kind: CheckKind;
  severity: CheckSeverity;
  title: string;
  detail: string;
  section: SectionId;
  clauseIds: string[];
}

const SAFEGUARDS = ['FIN-02', 'FIN-08', 'FIN-12', 'FIN-13', 'FIN-16', 'AID-07', 'BRD-04', 'BRD-08'];

const CONFLICTS: { flag: string; against: string[]; text: string }[] = [
  { flag: 'open_ended', against: ['SUB-05', 'SUB-06'], text: 'استمرار الاشتراكات حتى بلوغ الهدف يتعارض مع بند عدم التمديد وهدف الاستدامة المستقل عن نهاية الالتزام.' },
  { flag: 'forced_extension', against: ['SUB-05', 'SUB-06'], text: 'التمديد بقرار الهيئة يتعارض مع بند عدم التمديد المنفرد أو التلقائي.' },
  { flag: 'weighted_by_money', against: ['FND-04'], text: 'الأصوات الموزونة بالمساهمة تتعارض مع بند أن المساهمة لا تمنح سلطة إدارية.' },
  { flag: 'money_privilege', against: ['FND-04'], text: 'امتيازات الفئات الأعلى مساهمة تتعارض مع بند أن المساهمة لا تمنح سلطة إدارية.' },
  { flag: 'aid_contributors_only', against: ['FND-07', 'FND-08'], text: 'قصر المساعدة على المشتركين يتعارض مع عدم سقوط الحقوق الإنسانية وعدم الإقصاء.' },
  { flag: 'loan_contributors_only', against: ['FND-08'], text: 'قصر القروض على المشتركين يتعارض مع بند عدم الإقصاء.' },
  { flag: 'membership_requires_payment', against: ['FND-08', 'MEM-08'], text: 'ربط العضوية بالاشتراك يتعارض مع عدم الإقصاء والعضوية التكافلية لغير المشترك.' },
  { flag: 'binds_future_generations', against: ['SUB-05'], text: 'إلزام الأجيال التالية تلقائيًا يتعارض مع بند عدم التمديد التلقائي.' },
];

/** متغيرات مالية أساسية يلزم إدخالها قبل إصدار الميثاق */
const REQUIRED_VARS = [
  'subscription_start',
  'monthly_contribution',
  'subscription_years',
  'min_cash_reserve',
  'operating_expenses_annual',
  'aid_annual_budget',
];

export interface ReviewResult {
  checks: Check[];
  byKind: Record<CheckKind, Check[]>;
  sims: Record<'conservative' | 'base' | 'optimistic', SimResult>;
}

export const runReview = (p: Project): ReviewResult => {
  const cm = clauseMap(p);
  const flags = activeFlags(p);
  const sims = simulateAll(p);
  const base = sims.base;
  const checks: Check[] = [];
  const add = (c: Omit<Check, 'clauseIds'> & { clauseIds?: string[] }): void => {
    checks.push({ ...c, clauseIds: c.clauseIds ?? [] });
  };
  const title = (id: string): string => cm.get(id)?.title ?? id;

  // 1) بند أساسي مستبعد
  for (const c of p.clauses) {
    if (c.core && c.status === 'excluded') {
      add({ id: `core-excluded:${c.id}`, kind: 'review', severity: 'high', title: `بند أساسي مستبعد: ${c.title}`, detail: 'البنود الأساسية تدخل في معايير اكتمال الميثاق. أعد إدراجه أو سجّل مبررًا وبديلًا.', section: 'library', clauseIds: [c.id] });
    }
  }

  // 2) متغيرات مالية فارغة
  for (const k of REQUIRED_VARS) {
    if (p.vars[k] == null || p.vars[k] === '') {
      add({ id: `var-empty:${k}`, kind: 'financial', severity: 'medium', title: `متغير مالي فارغ: ${labelOf(k)}`, detail: 'يؤثر في الحسابات والنصوص المرتبطة به.', section: 'simulation' });
    }
  }
  // بند معتمد يعتمد على متغير فارغ
  for (const c of p.clauses) {
    if (c.status !== 'approved') continue;
    const empty = clauseVarKeys(c, clauseText(c)).filter((k) => k in p.vars && (p.vars[k] == null || p.vars[k] === ''));
    if (empty.length > 0) {
      add({ id: `approved-empty-var:${c.id}`, kind: 'conflict', severity: 'high', title: `بند معتمد بمتغيرات فارغة: ${c.title}`, detail: `المتغيرات غير المُدخلة: ${empty.map(labelOf).join('، ')}. سيظهر في الوثيقة تنبيه «يُستكمل».`, section: 'library', clauseIds: [c.id] });
    }
  }

  // 3) اختياران متناقضان
  for (const r of CONFLICTS) {
    const sources = flags.get(r.flag) ?? [];
    const approvedAgainst = r.against.filter((id) => cm.get(id)?.status === 'approved');
    if (sources.length > 0 && approvedAgainst.length > 0) {
      add({ id: `conflict:${r.flag}`, kind: 'conflict', severity: 'high', title: 'اختياران متناقضان', detail: `${r.text} (${sources.map((c) => c.title).join('، ')} ↔ ${approvedAgainst.map(title).join('، ')})`, section: 'library', clauseIds: [...sources.map((c) => c.id), ...approvedAgainst] });
    }
  }

  // 4) قرار جوهري لم يعتمد
  for (const c of p.clauses) {
    if (c.core && (c.status === 'discuss' || c.status === 'postponed')) {
      add({ id: `open:${c.id}`, kind: 'open', severity: 'medium', title: `قرار جوهري لم يُعتمد: ${c.title}`, detail: c.status === 'postponed' ? 'مؤجل.' : 'يحتاج مناقشة.', section: 'library', clauseIds: [c.id] });
    }
  }

  // 5) غياب ضابط مهم (بند ضابط مستبعد)
  for (const id of SAFEGUARDS) {
    if (cm.get(id)?.status === 'excluded') {
      add({ id: `safeguard:${id}`, kind: 'conflict', severity: 'high', title: `غياب ضابط مهم: ${title(id)}`, detail: 'هذا البند ضابط مالي أو نظامي أساسي، واستبعاده يترك الصندوق دون حماية.', section: 'library', clauseIds: [id] });
    }
  }

  // 6) تعارض مدة الاشتراك مع تاريخ الانتهاء
  const fixed = p.vars.commitment_end_date;
  const years = numVar(p, 'subscription_years');
  if (typeof fixed === 'string' && parseYm(fixed) && years != null) {
    const start = startYm(p);
    const grace = Math.round(numVar(p, 'grace_months') ?? 0);
    const byYears = grace + Math.round(years * 12);
    const byDate = monthsBetween(start, fixed) + 1;
    if (byYears !== byDate) {
      add({ id: 'end-mismatch', kind: 'conflict', severity: 'high', title: 'تعارض بين مدة الاشتراك وتاريخ انتهاء الالتزام', detail: `المدة المحددة (${years} سنة) تنتهي بعد ${byYears} شهرًا من البداية، بينما التاريخ المحدد يقع بعد ${byDate} شهرًا. اجعل أحدهما هو المرجع.`, section: 'subscriptions', clauseIds: ['SUB-04'] });
    }
  }

  // 7) مصروفات الإقراض والتكافل مقابل السيولة
  if (base.shortfallYears.length > 0) {
    add({ id: 'liquidity-shortfall', kind: 'financial', severity: 'high', title: 'نقص سيولة: الرصيد النقدي سالب', detail: `في السنوات: ${base.shortfallYears.join('، ')}. خفّض المصروفات أو مخصصات القروض أو أجّل شراء الأصول.`, section: 'simulation' });
  } else if (base.belowReserveYears.length > 0 && (numVar(p, 'min_cash_reserve') ?? 0) > 0) {
    add({ id: 'below-reserve', kind: 'financial', severity: 'medium', title: 'الرصيد النقدي يقل عن الاحتياطي الأدنى', detail: `في السنوات: ${base.belowReserveYears.join('، ')}.`, section: 'simulation' });
  }
  if (base.loans.unmet > 1) {
    add({ id: 'loans-unmet', kind: 'financial', severity: 'medium', title: 'طلب الإقراض المخطط يتجاوز السيولة المتاحة', detail: `المخطط ${money(base.loans.planned)} والمصروف فعليًا ${money(base.loans.disbursed)}؛ الفرق ${money(base.loans.unmet)} لن يُلبى بحسب حد رصيد القروض والاحتياطي.`, section: 'loans' });
  }

  // 8) أصول لا تسمح التدفقات بشرائها
  for (const a of base.notPurchased) {
    add({ id: `asset-unaffordable:${a.assetId}`, kind: 'financial', severity: 'high', title: `أصل مستهدف لا تسمح التدفقات بشرائه: ${a.name}`, detail: 'لا يتحقق الشراء ضمن الأفق في السيناريو الأساسي مع الإبقاء على الاحتياطي الأدنى.', section: 'assets' });
  }

  // 9-10) صلاحية دون جهة اعتماد، ولجنة دون اختصاصات
  for (const l of p.approvalLimits) {
    if (l.limit != null && l.approver.trim() === '') {
      add({ id: `limit-no-approver:${l.id}`, kind: 'conflict', severity: 'high', title: `صلاحية مالية دون جهة اعتماد: ${l.level}`, detail: 'حدد الجهة التي تعتمد ما يتجاوز الحد.', section: 'finance' });
    }
  }
  for (const c of p.committees) {
    if (c.duties.trim() === '') {
      add({ id: `committee-no-duties:${c.id}`, kind: 'review', severity: 'medium', title: `لجنة دون اختصاصات واضحة: ${c.name}`, detail: 'اكتب اختصاصات اللجنة وصلاحياتها.', section: 'board' });
    }
  }

  // 11) قرارات دون آلية تظلم
  const decisionsApproved = ['LON-01', 'AID-01'].some((id) => cm.get(id)?.status === 'approved');
  if (decisionsApproved && !['FND-06', 'CON-10'].every((id) => cm.get(id)?.status === 'approved')) {
    add({ id: 'no-appeal-mechanism', kind: 'review', severity: 'high', title: 'قرارات القروض والمساعدات معتمدة دون آلية تظلم معتمدة', detail: 'اعتمد بند حق التظلم وبند لجنة التظلمات.', section: 'rights', clauseIds: ['FND-06', 'CON-10'] });
  }

  // 12) أصول دون خطة صيانة
  for (const a of p.assets) {
    if (a.type !== 'land' && !(a.annualMaintenance && a.annualMaintenance > 0) && !(a.reservePct && a.reservePct > 0)) {
      add({ id: `asset-no-maint:${a.id}`, kind: 'review', severity: 'medium', title: `أصل دون خطة صيانة: ${a.name}`, detail: 'أدخل الصيانة السنوية أو نسبة مخصص احتياطي.', section: 'assets' });
    }
  }

  // 13) خطة انتقال المجلس
  if (cm.get('BRD-17')?.status !== 'approved') {
    add({ id: 'no-transition', kind: 'open', severity: 'medium', title: 'غياب خطة انتقال مجلس الأمناء', detail: 'اعتمد بند الانتقال بين المجالس وتسليم الأعمال.', section: 'board', clauseIds: ['BRD-17'] });
  }

  // 14) اختلاف تعريف المستفيد بين الأقسام
  const member = p.tiers.find((t) => t.id === 'tier-member');
  if (member && (flags.get('aid_contributors_only')?.length ?? 0) > 0 && member.rights.aid !== 'no') {
    add({ id: 'beneficiary-mismatch:aid', kind: 'conflict', severity: 'high', title: 'اختلاف تعريف المستفيد بين الأقسام (المساعدات)', detail: 'جدول حقوق العضوية يمنح المنتسب غير المشترك مساعدة، بينما بند مختار يقصرها على المشتركين.', section: 'membership', clauseIds: (flags.get('aid_contributors_only') ?? []).map((c) => c.id) });
  }
  if (member && (flags.get('loan_contributors_only')?.length ?? 0) > 0 && member.rights.loan !== 'no') {
    add({ id: 'beneficiary-mismatch:loan', kind: 'conflict', severity: 'medium', title: 'اختلاف تعريف المستفيد بين الأقسام (القروض)', detail: 'جدول الحقوق يتيح للمنتسب التقدم للقروض، بينما بند مختار يقصرها على المشتركين.', section: 'membership', clauseIds: (flags.get('loan_contributors_only') ?? []).map((c) => c.id) });
  }

  // 15) تغير متغير مؤثر بعد اعتماد البند
  for (const c of p.clauses) {
    if (c.status !== 'approved' || !c.approvedVars) continue;
    const changed = Object.keys(c.approvedVars).filter((k) => c.approvedVars![k] !== p.vars[k]);
    if (changed.length > 0) {
      add({ id: `var-changed:${c.id}`, kind: 'conflict', severity: 'medium', title: `تغير متغير مؤثر بعد اعتماد البند: ${c.title}`, detail: `تغيّر: ${changed.map(labelOf).join('، ')}. راجع البند وأعد اعتماده.`, section: 'library', clauseIds: [c.id] });
    }
  }

  // مجاميع النسب
  const sums: [string, string, number, SectionId][] = [
    ['loan-weights', 'مجموع أوزان المفاضلة', sumWeight(p.loanFactors), 'loans'],
    ['loan-tracks', 'مجموع نسب مسارات القروض', sumShare(p.loanTracks), 'loans'],
    ['activity-budget', 'مجموع نسب أنشطة التكافل', sumShare(p.activityBudget), 'aid'],
    ['returns-allocation', 'مجموع توزيع العوائد', sumShare(p.returnsAllocation), 'endowments'],
  ];
  for (const [id, label, total, section] of sums) {
    if (Math.abs(total - 100) > 0.01) {
      add({ id: `sum:${id}`, kind: 'conflict', severity: 'high', title: `${label} لا يساوي 100%`, detail: `المجموع الحالي ${total.toFixed(1)}%.`, section });
    }
  }
  const reg = (numVar(p, 'regularity_rate') ?? 0) + (numVar(p, 'late_rate') ?? 0) + (numVar(p, 'exemption_rate') ?? 0);
  if (reg > 100.01) {
    add({ id: 'collection-over-100', kind: 'review', severity: 'medium', title: 'نسب الانتظام والتأخر والإعفاء تتجاوز 100%', detail: `المجموع ${reg.toFixed(0)}%، ونسبة التحصيل المشتقة ${baseCollection(p).toFixed(0)}%.`, section: 'subscriptions' });
  }

  // مصدر تمويل المساعدات
  for (const a of p.aidTypes) {
    const fund = p.fundTypes.find((f) => f.id === a.fundId);
    if (fund && !fund.uses.aid) {
      add({ id: `aid-fund:${a.id}`, kind: 'conflict', severity: 'high', title: `مصدر تمويل لا يسمح بالمساعدات: ${a.name}`, detail: `«${fund.name}» غير مسموح بصرفه على المساعدات في جدول الفصل بين الأموال.`, section: 'aid' });
    }
  }
  const loansShare = p.returnsAllocation.find((r) => r.id === 'ra-loans');
  const waqfFund = p.fundTypes.find((f) => f.id === 'fund-waqf');
  if (loansShare && loansShare.share > 0 && waqfFund && !waqfFund.uses.loans) {
    add({ id: 'returns-loans-waqf', kind: 'review', severity: 'medium', title: 'توزيع جزء من عوائد الوقف على الإقراض', detail: 'جدول الفصل بين الأموال لا يسمح بصرف الأموال الوقفية على القروض. راجع شروط الواقف أو عدّل التوزيع.', section: 'endowments' });
  }

  // أصول: اتساق حالة التوثيق الوقفي
  for (const a of p.assets) {
    if (a.status === 'waqf_documented' && (a.waqfDoc !== 'documented' || a.deedNumber.trim() === '')) {
      add({ id: `waqf-inconsistent:${a.id}`, kind: 'conflict', severity: 'high', title: `أصل موسوم «وقف موثق» دون توثيق مكتمل: ${a.name}`, detail: 'لا يُعد الأصل وقفًا رسميًا إلا بعد التوثيق والتسجيل. أدخل حالة التوثيق ورقم الصك أو غيّر الحالة.', section: 'assets' });
    }
    if (a.status === 'owned' && a.ownership !== 'deed') {
      add({ id: `owned-no-deed:${a.id}`, kind: 'review', severity: 'low', title: `أصل مملوك دون إثبات ملكية: ${a.name}`, detail: 'أدخل حالة الملكية ورقم الصك.', section: 'assets' });
    }
    const net = assetNetAnnual(a, p.scenarios.base.portfolioReturn);
    if (a.targetCost && a.targetCost > 0 && net <= 0 && a.type !== 'land') {
      add({ id: `asset-no-yield:${a.id}`, kind: 'financial', severity: 'medium', title: `أصل بلا صافي عائد: ${a.name}`, detail: 'صافي الدخل المتوقع صفر أو سالب؛ راجع الإيراد والصيانة والمصروفات.', section: 'assets' });
    }
  }

  // حدود نظامية متحقق منها
  const seats = numVar(p, 'board_members_count');
  if (seats != null && seats < 3) {
    add({ id: 'legal-board-min', kind: 'conflict', severity: 'high', title: 'عدد أعضاء المجلس أقل من الحد النظامي', detail: 'النص المطّلع عليه يشترط ألا يقل عدد أعضاء مجلس الأمناء عن ثلاثة.', section: 'board', clauseIds: ['BRD-11'] });
  }
  const meets = numVar(p, 'board_meetings_per_year');
  if (meets != null && meets < 2) {
    add({ id: 'legal-meetings-min', kind: 'conflict', severity: 'high', title: 'اجتماعات المجلس أقل من الحد النظامي', detail: 'النص المطّلع عليه يشترط ألا تقل اجتماعات المجلس عن اجتماعين في السنة.', section: 'board', clauseIds: ['BRD-21'] });
  }
  if (p.vars.namesake_status === 'deceased' && (flags.get('family_named')?.length ?? 0) > 0) {
    add({ id: 'legal-naming-deceased', kind: 'legal', severity: 'high', title: 'تسمية باسم صاحب اسم متوفى', detail: 'تشترط القواعد المطّلع عليها أن يكون صاحب الاسم حيًا عند التسمية باسم شخص. فكّر في تسمية رسمية مختلفة أو اسم عام، واستوضح من المركز.', section: 'identity', clauseIds: ['FND-01'] });
  }
  if (p.vars.namesake_status === 'unknown' && (flags.get('family_named')?.length ?? 0) > 0) {
    add({ id: 'legal-naming-unknown', kind: 'legal', severity: 'medium', title: 'حالة صاحب الاسم لم تُحدد', detail: 'تؤثر حياة صاحب الاسم في إمكان التسمية باسمه. حدد الحالة في قسم الهوية.', section: 'identity', clauseIds: ['FND-01'] });
  }

  // بنود تحتاج مراجعة نظامية
  for (const c of p.clauses) {
    if (c.legalCheck && c.status !== 'excluded') {
      add({ id: `legal:${c.id}`, kind: 'legal', severity: c.status === 'approved' ? 'medium' : 'low', title: c.title, detail: c.legalRef || 'يحتاج تحققًا نظاميًا قبل الاعتماد النهائي.', section: 'library', clauseIds: [c.id] });
    }
  }

  const byKind: Record<CheckKind, Check[]> = { review: [], conflict: [], open: [], financial: [], legal: [] };
  for (const c of checks) byKind[c.kind].push(c);
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  for (const k of Object.keys(byKind) as CheckKind[]) byKind[k].sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  return { checks, byKind, sims };
};
