import type { CategoryId, Clause, Meeting, Project, ScenarioId } from '../types';
import { CATEGORIES } from '../data/clauses';
import { DOC_DEFS } from '../data/defaults';
import { SCENARIO_ORDER } from '../data/structures';
import { buildContext, MISSING_RE, resolveText } from '../engine/context';
import type { Ctx } from '../engine/context';
import { runReview } from '../engine/review';
import { simulateAll } from '../engine/simulate';
import type { SimResult } from '../engine/simulate';
import { evaluateRequirements, clauseCounts } from '../engine/progress';
import { groupPlans } from '../engine/subscriptions';
import { fairnessFindings } from '../engine/fairness';
import { clauseText, STATUS_LABEL } from '../lib/clauses';
import { dateLabel, money, num, pct } from '../lib/format';
import { decisionNumber } from '../lib/actions';
import { RIGHT_LABELS } from '../data/structures';
import { assetNetAnnual } from '../engine/simulate';
import type { Block, Doc, DocOptions } from './types';

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const DISCLAIMER =
  'هذه الوثيقة مسودة مولّدة من منصة بناء الميثاق لأغراض النقاش والمراجعة. لا تُعد معتمدة قبل موافقة أصحاب الصلاحية، ولا تغني عن الترخيص والمراجعة القانونية والشرعية والمالية.';
const NUMBERS_NOTE = 'جميع الأرقام الواردة تقديرية مبنية على افتراضات قابلة للتعديل، وليست أموالًا محصلة ولا نتائج مضمونة.';

interface Env {
  p: Project;
  ctx: Ctx;
  sims: Record<ScenarioId, SimResult>;
  R: (t: string) => string;
  include: boolean;
  num: { n: number };
}

const clausesOf = (e: Env, cats: CategoryId[] | null, ids?: string[]): Clause[] =>
  e.p.clauses
    .filter((c) => c.status !== 'excluded')
    .filter((c) => (ids ? ids.includes(c.id) : cats ? cats.includes(c.category) : true))
    .filter((c) => c.status === 'approved' || e.include)
    .sort((a, b) => (ids ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.order - b.order));

const clauseBlocks = (e: Env, list: Clause[]): Block[] =>
  list.map((c) => ({
    t: 'clause',
    n: ++e.num.n,
    id: c.id,
    title: c.title,
    text: e.R(clauseText(c)),
    status: c.status === 'approved' ? 'approved' : 'proposed',
  }));

const statusNote = (e: Env): Block => ({
  t: 'note',
  kind: 'info',
  text: e.include
    ? 'البنود الموسومة «معتمد» اتُّخذ فيها قرار، أما الموسومة «مقترح» فصياغات مقترحة لم تُعتمد بعد وتظهر للنقاش. وتُستبعد من الوثيقة البنود التي استُبعدت من الميثاق.'
    : 'تتضمن الوثيقة البنود المعتمدة فقط.',
});

const sectionWithClauses = (e: Env, heading: string, cats: CategoryId[] | null, ids?: string[]): Block[] => {
  const list = clausesOf(e, cats, ids);
  return [{ t: 'h', level: 2, text: heading }, ...(list.length ? clauseBlocks(e, list) : [{ t: 'p', text: 'لا توجد بنود معتمدة أو مقترحة في هذا الباب بعد.' } as Block])];
};

const kv = (rows: [string, string][]): Block => ({ t: 'table', head: ['البند', 'القيمة'], rows: rows.map(([a, b]) => [a, b]) });

const money0 = (n: number | null | undefined): string => (n == null ? '—' : money(n));

const val = (e: Env, key: string): string => e.ctx[key] ?? '—';

const identityBlocks = (e: Env): Block[] => {
  const out: Block[] = [{ t: 'h', level: 2, text: 'الهوية والرؤية والأهداف' }];
  const notConfirmed: string[] = [];
  for (const g of e.p.identity.groups) {
    const sel = g.options.filter((o) => g.selected.includes(o.id));
    if (sel.length === 0) continue;
    if (!g.confirmed) notConfirmed.push(g.label);
    out.push({ t: 'h', level: 3, text: g.label });
    if (g.multi) out.push({ t: 'ul', items: sel.map((o) => e.R(o.text)) });
    else out.push({ t: 'p', text: e.R(sel[0].text) });
  }
  if (notConfirmed.length) out.push({ t: 'note', kind: 'warn', text: `عناصر لم يؤكدها فريق العمل بعد: ${notConfirmed.join('، ')}.` });
  return out;
};

const tiersTable = (e: Env): Block => {
  const sym = { yes: 'نعم', conditional: 'بشرط', no: 'لا', undecided: 'لم يُحسم' } as const;
  const keys = Object.keys(RIGHT_LABELS);
  return {
    t: 'table',
    head: ['الفئة', ...keys.map((k) => RIGHT_LABELS[k])],
    rows: e.p.tiers.map((t) => [t.name, ...keys.map((k) => sym[t.rights[k as keyof typeof t.rights]])]),
  };
};

const groupsTable = (e: Env): Block => {
  const plans = groupPlans(e.p);
  return {
    t: 'table',
    head: ['الفئة', 'العدد المتوقع', 'الاشتراك الشهري', 'المدة (شهرًا)', 'إجمالي الفرد', 'إجمالي الفئة'],
    rows: plans.map((g) => {
      const months = g.end != null ? g.end - g.begin : null;
      return [g.name, num(g.count), money0(g.amount || null), months != null ? num(months) : '—', months != null ? money(g.amount * months) : '—', months != null ? money(g.amount * months * g.count) : '—'];
    }),
  };
};

const limitsTable = (e: Env): Block => ({
  t: 'table',
  head: ['المستوى', 'سقف الصرف', 'جهة الاعتماد عند التجاوز', 'ملاحظة'],
  rows: e.p.approvalLimits.map((l) => [l.level, l.limit != null ? money(l.limit) : 'ما فوق الحد السابق', l.approver || '—', l.note || '—']),
});

const raciTable = (e: Env): Block => ({
  t: 'table',
  head: ['العملية', ...e.p.raciRoles.map((r) => r.name)],
  rows: e.p.raci.map((row) => [row.process, ...e.p.raciRoles.map((r) => row.cells[r.id] || '—')]),
});

const assetsTable = (e: Env): Block => ({
  t: 'table',
  head: ['الأصل', 'النوع', 'الحالة', 'التكلفة المستهدفة', 'التمويل المتوفر', 'المتبقي', 'صافي الإيراد السنوي (تقدير)', 'سنة الشراء المستهدفة'],
  rows: e.p.assets.map((a) => [
    a.name,
    a.type,
    { idea: 'فكرة', targeted: 'مستهدف', buying: 'قيد الشراء', owned: 'مملوك', waqf_documented: 'وقف موثق' }[a.status],
    money0(a.targetCost),
    money0(a.fundingAvailable),
    a.targetCost != null ? money(Math.max(0, a.targetCost - (a.fundingAvailable ?? 0))) : '—',
    money(assetNetAnnual(a, e.p.scenarios.base.portfolioReturn)),
    a.targetYear != null ? String(a.targetYear) : '—',
  ]),
});

// ───────── الوثائق

const charter = (e: Env): Block[] => {
  const blocks: Block[] = [statusNote(e), ...identityBlocks(e)];
  CATEGORIES.forEach((c, i) => {
    blocks.push(...sectionWithClauses(e, `الباب ${ORD[i]}: ${c.label}`, [c.id]));
  });
  return blocks;
};

const bylaws = (e: Env): Block[] => {
  const mark = (s: string): string => `[يُستكمل: ${s}]`;
  return [
    { t: 'note', kind: 'warn', text: 'مسودة استرشادية تُطابَق مع «الدليل الاسترشادي للائحة الأساسية للصندوق العائلي» المنشور لدى المركز الوطني لتنمية القطاع غير الربحي، ولا تحل محله. ويُعتمد نموذج المركز النهائي عند التأسيس.' },
    statusNote(e),
    { t: 'h', level: 2, text: 'الباب الأول: التعريفات والتأسيس والأغراض' },
    kv([
      ['اسم الصندوق', val(e, 'fund_name')],
      ['التسمية الرسمية المقترحة', e.ctx.fund_official_name ?? 'غير مختلفة / لم تُحدد'],
      ['نوع الصندوق', mark('شخصي / باسم فرد منتسب إليه / عام')],
      ['المؤسسون وبياناتهم', mark('أسماء المؤسسين وبياناتهم الشخصية (لا تُحفظ في هذه المنصة)')],
      ['المقر الرئيس ونطاق الخدمات', mark('المنطقة والمدينة والنطاق الجغرافي')],
      ['العائلة أو العوائل التي يخدمها الصندوق', mark('تحديد العائلة وصلة القرابة وفق نص اللائحة')],
    ]),
    ...clauseBlocks(e, clausesOf(e, null, ['FND-01', 'FND-09', 'FND-15'])),
    { t: 'h', level: 3, text: 'أهداف الصندوق' },
    { t: 'ul', items: (e.p.identity.groups.find((g) => g.id === 'strategic')?.options ?? []).filter((o) => e.p.identity.groups.find((g) => g.id === 'strategic')?.selected.includes(o.id)).map((o) => e.R(o.text)) },
    { t: 'h', level: 2, text: 'الباب الثاني: العضوية' },
    ...clauseBlocks(e, clausesOf(e, null, ['MEM-01', 'MEM-02', 'MEM-04', 'MEM-05', 'MEM-06', 'MEM-07', 'MEM-08', 'MEM-09', 'MEM-15', 'FND-12'])),
    { t: 'h', level: 3, text: 'فئات العضوية وحقوقها (مقترح)' },
    tiersTable(e),
    { t: 'h', level: 2, text: 'الباب الثالث: التنظيم الإداري ومجلس الأمناء' },
    ...clauseBlocks(e, clausesOf(e, null, ['BRD-01', 'BRD-10', 'BRD-11', 'BRD-12', 'BRD-13', 'BRD-15', 'BRD-16', 'BRD-07', 'BRD-17', 'BRD-18', 'BRD-19', 'BRD-21'])),
    { t: 'h', level: 2, text: 'الباب الرابع: موارد الصندوق والشؤون المالية' },
    ...clauseBlocks(e, clausesOf(e, null, ['SUB-01', 'FIN-01', 'FIN-02', 'FIN-03', 'FIN-08', 'FIN-13', 'FIN-15', 'AID-07', 'FIN-11'])),
    { t: 'h', level: 2, text: 'الباب الخامس: التعديل والحل' },
    ...clauseBlocks(e, clausesOf(e, null, ['CON-08', 'CON-05', 'CON-09'])),
    { t: 'note', kind: 'info', text: 'يلزم نظامًا موافقة الجهة المختصة على أي تعديل في اللائحة الأساسية قبل نفاذه، وللحل الاختياري إجراءات خاصة. راجع «المرجعية النظامية» في المنصة.' },
  ];
};

const contrib = (e: Env): Block[] => {
  const r = e.sims.base;
  return [
    statusNote(e),
    { t: 'h', level: 2, text: 'متغيرات الاشتراك' },
    kv([
      ['تاريخ بداية الاشتراكات', val(e, 'subscription_start')],
      ['الاشتراك الشهري', val(e, 'monthly_contribution')],
      ['الاشتراك السنوي', val(e, 'annual_contribution')],
      ['المدة', e.p.vars.subscription_years != null ? `${e.p.vars.subscription_years} سنة` : '—'],
      ['فترة السماح', `${e.p.vars.grace_months ?? 0} شهر`],
      ['نموذج المدة', val(e, 'duration_mode')],
      ['نموذج انتهاء الالتزام', val(e, 'end_mode')],
      ['تاريخ انتهاء الالتزام', r.endLabel ?? '—'],
      ['إجمالي الالتزامات التعاقدية (تقدير)', r.totalCommitment > 0 ? money(r.totalCommitment) : '—'],
    ]),
    { t: 'h', level: 2, text: 'جدول الاشتراكات المعتمد' },
    groupsTable(e),
    { t: 'note', kind: 'info', text: 'يُظهر الجدول إجمالي المساهمة الفعلية لكل فئة. واختلاف المدة بين الفئات، إن وُجد، لا يترتب عليه اختلاف في الحقوق الأساسية.' },
    ...sectionWithClauses(e, 'أحكام الاشتراكات والالتزامات', ['contributions']),
  ];
};

const loansDoc = (e: Env): Block[] => [
  statusNote(e),
  { t: 'h', level: 2, text: 'القروض الحسنة: المتغيرات' },
  kv([
    ['الحد الأعلى للقرض', val(e, 'loan_max_amount')],
    ['متوسط القرض المتوقع', val(e, 'loan_avg_amount')],
    ['عدد القروض المخطط سنويًا', val(e, 'loan_requests_per_year')],
    ['مدة السداد المعتادة (شهر)', val(e, 'loan_term_months')],
    ['الحد الأعلى لرصيد القروض من موارد الصندوق', val(e, 'loan_pool_pct')],
  ]),
  { t: 'note', kind: 'warn', text: 'يتطلب نشاط القرض الحسن التحقق من إمكان إدراجه ضمن أغراض الصندوق وموافقة الجهة المختصة عند اللزوم قبل العمل به.' },
  { t: 'h', level: 3, text: 'الأغراض والحدود' },
  {
    t: 'table',
    head: ['الغرض', 'الحد الأعلى', 'المدة (شهر)', 'الأولوية', 'المستندات', 'التكرار', 'الضمانات'],
    rows: e.p.loanPurposes.map((x) => [x.name, money0(x.maxAmount), x.termMonths != null ? String(x.termMonths) : '—', String(x.priority), x.docs || '—', x.maxRepeat || '—', x.collateral || '—']),
  },
  { t: 'h', level: 3, text: 'عوامل المفاضلة' },
  { t: 'table', head: ['العامل', 'الوزن'], rows: e.p.loanFactors.map((f) => [f.label, pct(f.weight, 1)]) },
  { t: 'h', level: 3, text: 'مسارات القروض' },
  { t: 'table', head: ['المسار', 'النسبة', 'الوصف'], rows: e.p.loanTracks.map((t) => [t.name, pct(t.share, 1), t.description]) },
  ...sectionWithClauses(e, 'أحكام القروض الحسنة', ['loans']),
  { t: 'h', level: 2, text: 'المساعدات والتكافل' },
  {
    t: 'table',
    head: ['النوع', 'التعريف', 'الأهلية', 'السقف', 'الاعتماد', 'المستندات', 'السرية', 'مصدر التمويل'],
    rows: e.p.aidTypes.map((a) => [a.name, a.definition, a.eligibility, money0(a.cap), a.approval, a.docs, a.confidentiality, e.p.fundTypes.find((f) => f.id === a.fundId)?.name ?? '—']),
  },
  { t: 'h', level: 3, text: 'نسب الأنشطة من ميزانية المساعدات' },
  { t: 'table', head: ['النشاط', 'النسبة'], rows: e.p.activityBudget.map((a) => [a.label, pct(a.share, 1)]) },
  { t: 'h', level: 3, text: 'الفصل بين الأموال' },
  {
    t: 'table',
    head: ['نوع المال', 'مسموح صرفه في'],
    rows: e.p.fundTypes.map((f) => [f.name, ([['aid', 'المساعدات'], ['loans', 'القروض'], ['ops', 'التشغيل'], ['investment', 'الاستثمار'], ['reserve', 'الاحتياطي']] as const).filter(([k]) => f.uses[k]).map(([, l]) => l).join('، ') || 'بحسب قيده فقط']),
  },
  ...sectionWithClauses(e, 'أحكام المساعدات والتكافل', ['aid']),
];

const boardDoc = (e: Env): Block[] => [
  statusNote(e),
  { t: 'h', level: 2, text: 'تكوين المجلس' },
  kv([
    ['عدد المقاعد', val(e, 'board_members_count')],
    ['مدة الدورة (سنة)', val(e, 'board_term_years')],
    ['الدورات المتتالية المسموح بها', val(e, 'board_max_terms')],
    ['اجتماعات المجلس السنوية', val(e, 'board_meetings_per_year')],
    ['النصاب', val(e, 'board_quorum_pct')],
    ['القرارات العادية', val(e, 'majority_ordinary_pct')],
    ['القرارات المصيرية', val(e, 'majority_critical_pct')],
    ['الحد الأدنى لسن الترشح', val(e, 'candidate_min_age')],
  ]),
  { t: 'h', level: 3, text: 'شروط عضوية المجلس' },
  {
    t: 'table',
    head: ['الشرط', 'الحالة'],
    rows: e.p.criteria.map((c) => [c.label, { undecided: 'لم يُحسم', required: 'شرط أساسي', preferred: 'مفضّل', none: 'غير مطلوب' }[c.mode]]),
  },
  ...sectionWithClauses(e, 'أحكام مجلس الأمناء والحوكمة', ['board']),
  ...clauseBlocks(e, clausesOf(e, null, ['MEM-12', 'MEM-13', 'MEM-14', 'CON-07', 'CON-08', 'CON-09', 'CON-10'])),
  { t: 'h', level: 2, text: 'اللجان' },
  ...e.p.committees.flatMap((c): Block[] => [
    { t: 'h', level: 3, text: c.name },
    kv([['الاختصاصات', c.duties || '—'], ['العضوية', c.members || '—'], ['مدة التكليف', c.term || '—'], ['الصلاحيات', c.powers || '—'], ['حدود التفويض', c.delegation || '—'], ['التقارير', c.reporting || '—'], ['التنحي عند تعارض المصالح', c.recusal || '—']]),
  ]),
  { t: 'h', level: 2, text: 'حدود الاعتماد المالي' },
  limitsTable(e),
  { t: 'note', kind: 'info', text: 'الأرقام أمثلة افتراضية قابلة للتعديل وليست أحكامًا نظامية.' },
  { t: 'h', level: 2, text: 'مصفوفة الصلاحيات RACI' },
  raciTable(e),
  { t: 'p', text: 'R: منفّذ · A: معتمد · C: مستشار · I: مُبلَّغ' },
];

const finpol = (e: Env): Block[] => [
  statusNote(e),
  { t: 'h', level: 2, text: 'المتغيرات المالية' },
  kv([
    ['المصروفات التشغيلية السنوية', val(e, 'operating_expenses_annual')],
    ['ميزانية المساعدات السنوية', val(e, 'aid_annual_budget')],
    ['الاحتياطي النقدي الأدنى', val(e, 'min_cash_reserve')],
    ['نسبة إعادة استثمار صافي العوائد', val(e, 'reinvest_share')],
    ['السماح بشراء أصل قبل انتهاء الاشتراكات', val(e, 'allow_purchase_before_end')],
  ]),
  ...sectionWithClauses(e, 'السياسات المالية والرقابية', ['finance']),
  ...sectionWithClauses(e, 'سياسة الاستثمار', null, ['END-01', 'END-05', 'END-06', 'END-08', 'END-11', 'END-17', 'END-20']),
  { t: 'h', level: 2, text: 'حدود الاعتماد المالي' },
  limitsTable(e),
  { t: 'h', level: 2, text: 'توزيع صافي العوائد (تصور)' },
  { t: 'table', head: ['المصرف', 'النسبة', 'ملاحظة'], rows: e.p.returnsAllocation.map((r) => [r.label, pct(r.share, 1), r.note || '—']) },
];

const endow = (e: Env): Block[] => [
  { t: 'note', kind: 'warn', text: 'لا يعني إدراج عقار في هذه الوثيقة أنه أصبح وقفًا مسجلًا رسميًا. وقف الأصل يتطلب وثيقة وقف موثقة وتسجيلًا لدى الجهة المختصة، وهذه الوثيقة تصور للنقاش وليست وثيقة وقف.' },
  statusNote(e),
  { t: 'h', level: 2, text: 'الأهداف الوقفية' },
  { t: 'ul', items: (e.p.identity.groups.find((g) => g.id === 'endowment')?.options ?? []).filter((o) => e.p.identity.groups.find((g) => g.id === 'endowment')?.selected.includes(o.id)).map((o) => e.R(o.text)) },
  kv([
    ['قيمة الأصول الوقفية المستهدفة', val(e, 'endowment_target')],
    ['عدد الأوقاف المستهدفة', val(e, 'endowments_target_count')],
    ['عدد الأصول المسجلة', String(e.p.assets.length)],
  ]),
  ...sectionWithClauses(e, 'أحكام الأوقاف والاستثمار', ['endowment']),
  { t: 'h', level: 2, text: 'سجل الأصول' },
  e.p.assets.length ? assetsTable(e) : { t: 'p', text: 'لا توجد أصول مسجلة بعد.' },
  { t: 'h', level: 2, text: 'مراحل الانتقال إلى الأوقاف' },
  { t: 'table', head: ['المرحلة', 'التفاصيل', 'الحالة', 'التوقيت'], rows: e.p.transitionPhases.map((x) => [x.title, x.detail, { todo: 'لم تبدأ', doing: 'جارية', done: 'منجزة' }[x.status], x.when || '—']) },
  { t: 'p', text: NUMBERS_NOTE },
];

const plan = (e: Env): Block[] => {
  const r = e.sims.base;
  const last = r.years[r.years.length - 1];
  return [
    { t: 'note', kind: 'warn', text: NUMBERS_NOTE + ' العوائد الاستثمارية وشراء العقارات غير مضمونة.' },
    { t: 'h', level: 2, text: 'الافتراضات' },
    kv([
      ['تاريخ بداية الاشتراكات', val(e, 'subscription_start')],
      ['أفق المحاكاة', `${r.horizonYears} سنة`],
      ['المشتركون المتوقعون', val(e, 'subscribers_total')],
      ['الاشتراك الشهري', val(e, 'monthly_contribution')],
      ['مدة الاشتراك', e.p.vars.subscription_years != null ? `${e.p.vars.subscription_years} سنة` : '—'],
      ['الدعم التأسيسي', val(e, 'founding_support')],
      ['التبرعات السنوية', val(e, 'annual_donations')],
      ['المصروفات التشغيلية السنوية', val(e, 'operating_expenses_annual')],
      ['ميزانية المساعدات السنوية', val(e, 'aid_annual_budget')],
      ['الاحتياطي النقدي الأدنى', val(e, 'min_cash_reserve')],
      ['نسبة إعادة الاستثمار', val(e, 'reinvest_share')],
    ]),
    { t: 'h', level: 3, text: 'افتراضات السيناريوهات' },
    {
      t: 'table',
      head: ['الافتراض', ...SCENARIO_ORDER.map((s) => e.p.scenarios[s].name)],
      rows: [
        ['تعديل نسبة التحصيل (نقطة)', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].collectionDelta, 2))],
        ['نمو المشتركين %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].subscriberGrowth, 2))],
        ['تعثر القروض %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].loanDefault, 2))],
        ['التضخم %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].inflation, 2))],
        ['نمو الإيجارات %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].rentGrowth, 2))],
        ['أثر الإشغال (نقطة)', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].occupancyDelta, 2))],
        ['نمو أسعار العقارات %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].propertyGrowth, 2))],
        ['عائد المحافظ %', ...SCENARIO_ORDER.map((s) => num(e.p.scenarios[s].portfolioReturn, 2))],
      ],
    },
    { t: 'h', level: 2, text: 'النتائج الرئيسة (السيناريو الأساسي)' },
    kv([
      ['مجموع الالتزامات التعاقدية', money(r.totalCommitment)],
      ['الاشتراكات المحصلة المتوقعة', money(r.totalCollected)],
      ['تاريخ انتهاء الاشتراكات', r.endLabel ?? '—'],
      ['الرصيد النقدي آخر الأفق', money(last.endCash)],
      ['القروض القائمة آخر الأفق', money(last.loansOutstanding)],
      ['القروض المستردة (أصل فقط)', money(r.loans.repaid)],
      ['قيمة الأصول المملوكة آخر الأفق', money(last.assetsValue)],
      ['منها المخطط وقفه بوثيقة مستقلة', money(last.endowedValue)],
      ['الاحتياطي آخر الأفق', money(last.reserve)],
      ['تغطية النشاط بالعوائد آخر الأفق', r.finalCoverage != null ? pct(r.finalCoverage * 100) : '—'],
      ['الفجوة التمويلية للاستدامة', r.fundingGap != null ? money(r.fundingGap) : '—'],
      ['مؤشر الاستدامة المالية', r.sustainabilityIndex != null ? `${r.sustainabilityIndex} من 100` : '—'],
    ]),
    { t: 'h', level: 3, text: 'السنة المحتملة لشراء كل عقار' },
    r.purchases.length + r.notPurchased.length === 0
      ? { t: 'p', text: 'لا أصول مستهدفة.' }
      : { t: 'table', head: ['الأصل', 'الشراء المحتمل', 'التكلفة التقديرية'], rows: [...r.purchases.map((x) => [x.name, x.label, money(x.cost)]), ...r.notPurchased.map((x) => [x.name, 'لا يتحقق ضمن الأفق', '—'])] },
    { t: 'h', level: 2, text: 'مقارنة السيناريوهات' },
    {
      t: 'table',
      head: ['المؤشر', ...SCENARIO_ORDER.map((s) => e.p.scenarios[s].name)],
      rows: [
        ['القيمة الإجمالية آخر الأفق', ...SCENARIO_ORDER.map((s) => money(e.sims[s].years[e.sims[s].years.length - 1].netWorth))],
        ['الأصول المشتراة', ...SCENARIO_ORDER.map((s) => `${e.sims[s].purchases.length} من ${e.sims[s].purchases.length + e.sims[s].notPurchased.length}`)],
        ['تغطية النشاط', ...SCENARIO_ORDER.map((s) => (e.sims[s].finalCoverage != null ? pct((e.sims[s].finalCoverage as number) * 100) : '—'))],
        ['مؤشر الاستدامة', ...SCENARIO_ORDER.map((s) => String(e.sims[s].sustainabilityIndex ?? '—'))],
      ],
    },
    { t: 'h', level: 2, text: 'الجدول السنوي (السيناريو الأساسي)' },
    {
      t: 'table',
      head: ['السنة', 'اشتراكات', 'صافي أصول', 'تشغيل', 'مساعدات', 'قروض مصروفة', 'شراء', 'النقد', 'قروض قائمة', 'أصول', 'تغطية'],
      rows: r.years.map((y) => [y.label, num(Math.round(y.subscriptions)), num(Math.round(y.assetIncome)), num(Math.round(y.operating)), num(Math.round(y.aid)), num(Math.round(y.loansDisbursed)), num(Math.round(y.purchases)), num(Math.round(y.endCash)), num(Math.round(y.loansOutstanding)), num(Math.round(y.assetsValue)), y.coverage != null ? pct(y.coverage * 100) : '—']),
    },
    ...(r.issues.length ? ([{ t: 'h', level: 3, text: 'ملاحظات على المدخلات' }, { t: 'ul', items: r.issues }] as Block[]) : []),
  ];
};

const meetingOf = (e: Env, id: string | null): Meeting | null => e.p.meetings.find((m) => m.id === id) ?? e.p.meetings[0] ?? null;

const agendaDoc = (e: Env, o: DocOptions): Block[] => {
  const m = meetingOf(e, o.meetingId);
  const reqs = evaluateRequirements(e.p).filter((r) => !r.done);
  const blocks: Block[] = [];
  if (m) {
    blocks.push(kv([['الاجتماع', m.title], ['التاريخ', m.date ? dateLabel(m.date) : '—'], ['المكان', m.place || '—']]));
    blocks.push({ t: 'h', level: 2, text: 'المواضيع' });
    blocks.push(
      m.agenda.length === 0
        ? { t: 'p', text: 'لم يُجهَّز جدول الأعمال بعد.' }
        : {
            t: 'table',
            head: ['#', 'الموضوع', 'السؤال المطروح', 'الخيارات', 'التوصية المبدئية', 'حالة المناقشة', 'المسؤول', 'الموعد'],
            rows: m.agenda.map((a, i) => [String(i + 1), a.title, e.R(a.question), a.optionsText || '—', a.recommendation || '—', { pending: 'لم يُناقش', discussing: 'قيد النقاش', decided: 'محسوم', postponed: 'مؤجل' }[a.state], a.owner || '—', a.targetDate ? dateLabel(a.targetDate) : '—']),
          },
    );
  } else {
    const list = e.p.clauses.filter((c) => c.status === 'discuss').sort((a, b) => Number(b.core) - Number(a.core) || a.order - b.order);
    blocks.push({ t: 'note', kind: 'info', text: 'لم يُنشأ اجتماع بعد؛ يعرض الجدول البنود التي تحتاج مناقشة (الأساسية أولًا).' });
    blocks.push({ t: 'table', head: ['#', 'الموضوع', 'السؤال', 'الخيارات'], rows: list.map((c, i) => [String(i + 1), c.title, c.questions[0] ?? c.title, c.alternatives.map((a) => a.label).join(' | ')]) });
  }
  blocks.push({ t: 'h', level: 2, text: 'لا تنسَ هذا السؤال' });
  blocks.push(reqs.length ? { t: 'ul', items: reqs.map((r) => r.req.question) } : { t: 'p', text: 'لا أسئلة جوهرية مفتوحة.' });
  return blocks;
};

const minutesDoc = (e: Env, o: DocOptions): Block[] => {
  const m = meetingOf(e, o.meetingId);
  if (!m) return [{ t: 'note', kind: 'warn', text: 'لا يوجد اجتماع مسجل. أنشئ اجتماعًا وسجّل قراراته من قسم «الاجتماعات».' }];
  const attendees = m.attendees.filter((x) => x.trim());
  return [
    kv([['الاجتماع', m.title], ['التاريخ', m.date ? dateLabel(m.date) : '—'], ['المكان', m.place || '—'], ['عدد الحضور', String(attendees.length)]]),
    ...(attendees.length ? ([{ t: 'h', level: 3, text: 'الحضور' }, { t: 'ul', items: attendees }] as Block[]) : []),
    { t: 'note', kind: 'info', text: 'نتائج التصويت المدونة هنا استشارية، ولا تُعد قرارًا نظاميًا ملزمًا تلقائيًا؛ وتُربط بإجراءات الاعتماد المعتمدة.' },
    { t: 'h', level: 2, text: 'القرارات' },
    m.decisions.length === 0
      ? { t: 'p', text: 'لم تُسجل قرارات.' }
      : {
          t: 'table',
          head: ['رقم القرار', 'الموضوع', 'القرار', 'المبررات', 'التحفظات والاعتراضات', 'المسؤول', 'الموعد', 'منجز'],
          rows: m.decisions.map((d) => [decisionNumber(d.number), d.title, d.kind === 'postpone' ? 'تأجيل' : d.kind === 'exclude' ? 'استبعاد من الميثاق' : e.R(d.text), d.rationale || '—', d.reservations || '—', d.owner || '—', d.dueDate ? dateLabel(d.dueDate) : '—', d.done ? 'نعم' : 'لا']),
        },
    ...(m.agenda.some((a) => a.vote.yes + a.vote.no + a.vote.abstain + a.vote.named.length > 0)
      ? ([
          { t: 'h', level: 2, text: 'التصويت الاستشاري' },
          {
            t: 'table',
            head: ['الموضوع', 'مؤيد', 'معارض', 'ممتنع'],
            rows: m.agenda
              .filter((a) => a.vote.yes + a.vote.no + a.vote.abstain + a.vote.named.length > 0)
              .map((a) => {
                const v = a.vote;
                const c = v.mode === 'counts' ? { y: v.yes, n: v.no, a: v.abstain } : { y: v.named.filter((x) => x.choice === 'yes').length, n: v.named.filter((x) => x.choice === 'no').length, a: v.named.filter((x) => x.choice === 'abstain').length };
                return [a.title, String(c.y), String(c.n), String(c.a)];
              }),
          },
        ] as Block[])
      : []),
    ...(m.minutes.trim() ? ([{ t: 'h', level: 2, text: 'المداولات' }, { t: 'p', text: m.minutes }] as Block[]) : []),
    { t: 'h', level: 2, text: 'متابعات للاجتماع القادم' },
    m.followUps.length === 0 ? { t: 'p', text: 'لا متابعات.' } : { t: 'table', head: ['المهمة', 'المسؤول', 'الموعد', 'منجزة'], rows: m.followUps.map((f) => [f.text, f.owner || '—', f.dueDate ? dateLabel(f.dueDate) : '—', f.done ? 'نعم' : 'لا']) },
  ];
};

const openReport = (e: Env): Block[] => {
  const blocks: Block[] = [];
  const counts = clauseCounts(e.p);
  blocks.push(kv([['البنود المعتمدة', `${counts.approved} من ${counts.total}`], ['تحتاج مناقشة', String(counts.discuss)], ['مؤجلة', String(counts.postponed)], ['مستبعدة', String(counts.excluded)], ['مسائل خلافية', String(counts.contested)]]));
  for (const cat of CATEGORIES) {
    const list = e.p.clauses.filter((c) => c.category === cat.id && (c.status === 'discuss' || c.status === 'postponed')).sort((a, b) => Number(b.core) - Number(a.core) || a.order - b.order);
    if (list.length === 0) continue;
    blocks.push({ t: 'h', level: 2, text: cat.label });
    blocks.push({
      t: 'table',
      head: ['البند', 'الحالة', 'أساسي', 'الأسئلة المطروحة', 'ملاحظات'],
      rows: list.map((c) => [`${c.id} — ${c.title}`, STATUS_LABEL[c.status], c.core ? 'نعم' : '—', c.questions.join(' / ') || '—', [c.contested ? 'خلافي' : '', c.notes].filter(Boolean).join(' · ') || '—']),
    });
  }
  const reqs = evaluateRequirements(e.p).filter((r) => !r.done);
  blocks.push({ t: 'h', level: 2, text: 'أسئلة جوهرية لم تُحسم' });
  blocks.push(reqs.length ? { t: 'ol', items: reqs.map((r) => r.req.question) } : { t: 'p', text: 'لا أسئلة مفتوحة.' });
  return blocks;
};

const riskReport = (e: Env): Block[] => {
  const rv = runReview(e.p);
  const lv = (s: number): string => (s >= 15 ? 'حرج' : s >= 10 ? 'مرتفع' : s >= 5 ? 'متوسط' : 'منخفض');
  const fair = fairnessFindings(e.p);
  const blocks: Block[] = [
    { t: 'h', level: 2, text: 'سجل المخاطر' },
    { t: 'table', head: ['الخطر', 'الاحتمال', 'الأثر', 'المستوى', 'الإجراءات الوقائية', 'خطة الاستجابة', 'المسؤول', 'مؤشر الإنذار', 'الحالة'], rows: e.p.risks.map((r) => [r.title, String(r.probability), String(r.impact), lv(r.probability * r.impact), r.prevention || '—', r.response || '—', r.owner || '—', r.indicator || '—', { open: 'مفتوح', mitigating: 'قيد المعالجة', accepted: 'مقبول', closed: 'مغلق' }[r.status]]) },
    { t: 'h', level: 2, text: 'فجوات المشروع' },
  ];
  const groups: [string, typeof rv.checks][] = [['تعارضات يجب حلها', rv.byKind.conflict], ['عناصر تحتاج مراجعة', rv.byKind.review], ['قرارات لم تُعتمد', rv.byKind.open], ['مخاطر مالية', rv.byKind.financial], ['مراجعة نظامية', rv.byKind.legal]];
  for (const [label, list] of groups) {
    if (list.length === 0) continue;
    blocks.push({ t: 'h', level: 3, text: label });
    blocks.push({ t: 'table', head: ['الأهمية', 'العنوان', 'التفصيل'], rows: list.map((c) => [{ high: 'مرتفع', medium: 'متوسط', low: 'منخفض' }[c.severity], c.title, c.detail]) });
  }
  if (fair.length) {
    blocks.push({ t: 'h', level: 3, text: 'تنبيهات عدالة الميثاق' });
    blocks.push({ t: 'table', head: ['الإشكال', 'الأثر', 'الحلول', 'حالة المعالجة'], rows: fair.map((f) => [f.title, f.impact, f.fixes.join(' ؛ '), { open: 'مفتوح', resolved: 'تمت المعالجة', accepted: `قُبلت المخاطرة: ${e.p.findings[f.id]?.note ?? ''}` }[e.p.findings[f.id]?.status ?? 'open']]) });
  }
  blocks.push({ t: 'h', level: 2, text: 'متطلبات المراجعة مع مختص قبل التأسيس' });
  blocks.push({ t: 'table', head: ['المتطلب', 'الحالة', 'ملاحظة'], rows: e.p.reviewItems.map((r) => [r.text, r.done ? 'روجع' : 'لم يُراجع', r.note || '—']) });
  return blocks;
};

const summary = (e: Env): Block[] => {
  const r = e.sims.base;
  const counts = clauseCounts(e.p);
  const reqs = evaluateRequirements(e.p);
  const vis = e.p.identity.groups.find((g) => g.id === 'vision');
  const mis = e.p.identity.groups.find((g) => g.id === 'mission');
  const pick = (g: typeof vis): string => (g ? e.R(g.options.find((o) => g.selected.includes(o.id))?.text ?? '—') : '—');
  return [
    { t: 'note', kind: 'info', text: 'ملخص مختصر لعرضه على أفراد العائلة. ' + NUMBERS_NOTE },
    { t: 'h', level: 2, text: 'من نحن' },
    kv([['الصندوق', val(e, 'fund_name')], ['الرؤية', pick(vis)], ['الرسالة', pick(mis)]]),
    { t: 'h', level: 2, text: 'أبرز ما اتفقنا عليه' },
    { t: 'ul', items: e.p.clauses.filter((c) => c.status === 'approved' && c.core).slice(0, 12).map((c) => `${c.title}: ${e.R(clauseText(c)).slice(0, 160)}`) },
    ...(counts.approved === 0 ? ([{ t: 'p', text: 'لم تُعتمد بنود بعد.' }] as Block[]) : []),
    { t: 'h', level: 2, text: 'الأرقام الأساسية (تقديرية)' },
    kv([
      ['المشتركون المتوقعون', val(e, 'subscribers_total')],
      ['الاشتراك الشهري', val(e, 'monthly_contribution')],
      ['مدة الاشتراك', e.p.vars.subscription_years != null ? `${e.p.vars.subscription_years} سنة` : '—'],
      ['انتهاء الالتزام', r.endLabel ?? '—'],
      ['إجمالي الالتزامات التعاقدية', r.totalCommitment > 0 ? money(r.totalCommitment) : '—'],
      ['الحد الأعلى للقرض', val(e, 'loan_max_amount')],
      ['مقاعد المجلس', val(e, 'board_members_count')],
      ['قيمة الأصول المستهدفة', val(e, 'endowment_target')],
      ['تغطية النشاط بالعوائد آخر الأفق', r.finalCoverage != null ? pct(r.finalCoverage * 100) : '—'],
    ]),
    { t: 'h', level: 2, text: 'ما الذي لم نحسمه بعد' },
    kv([['بنود تنتظر قرارًا', String(counts.discuss + counts.postponed)], ['مسائل خلافية', String(counts.contested)], ['أسئلة جوهرية مفتوحة', String(reqs.filter((x) => !x.done).length)]]),
    { t: 'h', level: 2, text: 'الخطوة التالية' },
    { t: 'ul', items: ['استكمال البنود الجوهرية في الاجتماع القادم.', 'عرض المسودة على مختصين نظاميين وشرعيين وماليين.', 'التحقق من اسم الصندوق ونطاق العضوية ومشروعية الإقراض مع الجهة المختصة.'] },
  ];
};

// ───────── نقطة الدخول

/** تمرير أخير يضمن ألا يبقى رمز متغير خام في أي وثيقة مهما كان مصدر النص (بنود، بدائل، اجتماعات…) */
const resolveBlock = (b: Block, R: (t: string) => string): Block => {
  switch (b.t) {
    case 'h':
    case 'p':
    case 'note':
      return { ...b, text: R(b.text) };
    case 'ul':
    case 'ol':
      return { ...b, items: b.items.map(R) };
    case 'table':
      return { ...b, head: b.head.map(R), rows: b.rows.map((r) => r.map(R)) };
    case 'clause':
      return { ...b, title: R(b.title), text: R(b.text) };
    case 'pagebreak':
      return b;
  }
};

export const buildDoc = (p: Project, docId: string, o: DocOptions = { meetingId: null }): Doc => {
  const ctx = buildContext(p);
  const ds = p.docSettings;
  const e: Env = { p, ctx, sims: simulateAll(p), R: (t) => resolveText(t, ctx), include: ds.includeProposed, num: { n: 0 } };
  const def = DOC_DEFS.find((d) => d.id === docId);
  if (!def) throw new Error(`وثيقة غير معروفة: ${docId}`);
  const body: Block[] = (
    {
      charter: charter,
      bylaws: bylaws,
      contrib: contrib,
      loans: loansDoc,
      board: boardDoc,
      finpol: finpol,
      endow: endow,
      plan: plan,
      agenda: (x: Env) => agendaDoc(x, o),
      minutes: (x: Env) => minutesDoc(x, o),
      open: openReport,
      risk: riskReport,
      summary: summary,
    }[docId]!(e)
  ).map((b) => resolveBlock(b, e.R));

  const missing = new Set<string>();
  const scan = (t: string): void => {
    for (const m of t.matchAll(new RegExp(MISSING_RE.source, 'g'))) missing.add(m[0].replace('[يُستكمل: ', '').replace(']', ''));
  };
  for (const b of body) {
    if (b.t === 'p' || b.t === 'note') scan(b.text);
    else if (b.t === 'clause') scan(b.text);
    else if (b.t === 'ul' || b.t === 'ol') b.items.forEach(scan);
    else if (b.t === 'table') b.rows.forEach((r) => r.forEach(scan));
  }
  const blocks: Block[] = [
    { t: 'note', kind: 'warn', text: DISCLAIMER },
    ...(missing.size > 0 ? ([{ t: 'note', kind: 'warn', text: `عناصر لم تُستكمل بعد وتظهر في النص بصيغة [يُستكمل: …]: ${[...missing].join('، ')}.` }] as Block[]) : []),
    ...body,
  ];
  const toc = blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h' && b.level === 2).map((b) => b.text);
  return {
    id: docId,
    title: e.R(ds.titles[docId] ?? def.title),
    subtitle: val(e, 'fund_name'),
    version: ds.version,
    issueDate: ds.issueDate,
    reviewDate: ds.reviewDate,
    footer: e.R(ds.footerLine),
    toc,
    blocks,
    signatures: ds.signatures ? ds.signatories : null,
    missing: [...missing],
  };
};

export const docTitle = (p: Project, docId: string): string => {
  const def = DOC_DEFS.find((d) => d.id === docId);
  return resolveText(p.docSettings.titles[docId] ?? def?.title ?? docId, buildContext(p));
};

