import { useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScenarioAssumptions, ScenarioId } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { SCENARIO_ORDER } from '../data/structures';
import { fundableAssets, requiredContribution } from '../engine/reverse';
import type { FundableResult, ReverseResult } from '../engine/reverse';
import { stressTest } from '../engine/simulate';
import type { SimResult } from '../engine/simulate';
import { baseCollection, expectedCount, numVar } from '../engine/subscriptions';
import { compactMoney, money, num, pct } from '../lib/format';
import { Badge, Callout, Card, cx, EmptyState, SectionHead, Stat, Tabs, Term } from '../components/ui';
import { Field, NumInput, TextInput, VarField } from '../components/fields';
import { go } from '../lib/nav';

type Tab = 'inputs' | 'results' | 'scenarios' | 'reverse' | 'stress';

const C = { green: '#2c6449', gold: '#b8923a', blue: '#2b5f7a', red: '#a23b2a', gray: '#8a968f', light: '#8dbba2' };
const tick = (v: number): string => compactMoney(v);
const tip = (v: unknown): string => (typeof v === 'number' ? money(v) : String(v));

const ChartCard = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <Card>
    <h3 className="mb-1 text-base">{title}</h3>
    {note && <p className="mb-2 text-xs text-mute">{note}</p>}
    <div className="chart-box h-72 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        {children as ReactElement}
      </ResponsiveContainer>
    </div>
  </Card>
);

const axes = (fmt: (v: number) => string = tick) => (
  <>
    <CartesianGrid strokeDasharray="3 3" stroke="#e4ddcc" />
    <XAxis dataKey="name" reversed tick={{ fontSize: 11 }} />
    <YAxis orientation="right" tick={{ fontSize: 11 }} tickFormatter={fmt} width={64} />
    <Tooltip formatter={tip} labelFormatter={(l) => `السنة ${l}`} contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }} />
    <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
  </>
);

export default function Simulation() {
  const { project: p, sims } = useDerived();
  const [tab, setTab] = useState<Tab>('inputs');
  const [sid, setSid] = useState<ScenarioId>('base');
  const r = sims[sid];
  const hasData = r.totalCommitment > 0 || p.vars.founding_support != null;

  return (
    <div className="space-y-6">
      <SectionHead
        num="12 / الخطة المالية والمحاكاة"
        title="الخطة المالية والمحاكاة"
        sub="حاسبة مترابطة تعمل شهريًا على أفق حتى 30 سنة وبثلاثة سيناريوهات. كل الأرقام تقديرية؛ العوائد وشراء العقارات غير مضمونة."
      />
      <Callout tone="gold">
        كل رقم هنا ناتج حسابي من مدخلاتك وافتراضاتك، وليس نتيجة ثابتة ولا مال محصّل. لا تُعامل القروض المستردة ربحًا، ولا يُعد شراء العقار مصروفًا تشغيليًا يُخفي الأصل من الميزانية.
      </Callout>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-mute">السيناريو:</span>
        {SCENARIO_ORDER.map((id) => (
          <button key={id} className={cx('btn btn-sm', sid === id ? 'btn-primary' : 'btn-soft')} aria-pressed={sid === id} onClick={() => setSid(id)}>
            {p.scenarios[id].name}
          </button>
        ))}
        <Badge tone="plain">نسبة التحصيل: {pct(Math.min(100, Math.max(0, baseCollection(p) + p.scenarios[sid].collectionDelta)), 1)}</Badge>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'inputs', label: 'المدخلات والافتراضات' },
          { id: 'results', label: 'النتائج والرسوم' },
          { id: 'scenarios', label: 'مقارنة السيناريوهات' },
          { id: 'reverse', label: 'الحاسبة العكسية' },
          { id: 'stress', label: 'اختبار الضغط' },
        ]}
      />

      {r.issues.length > 0 && tab !== 'inputs' && (
        <Callout tone="warn" title="ملاحظات على المدخلات">
          <ul className="list-disc ps-5">
            {r.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Callout>
      )}

      {tab === 'inputs' && <Inputs issues={r.issues} />}
      {tab === 'results' && (hasData ? <Results r={r} /> : <EmptyState>أدخل بيانات الاشتراكات (أو حمّل بيانات توضيحية من زر «البيانات») لتظهر النتائج.</EmptyState>)}
      {tab === 'scenarios' && <ScenarioCompare />}
      {tab === 'reverse' && <Reverse />}
      {tab === 'stress' && <Stress sid={sid} />}
    </div>
  );
}

const SC_ROWS: { k: keyof ScenarioAssumptions; label: string; hint?: string }[] = [
  { k: 'collectionDelta', label: 'تعديل نسبة التحصيل (نقطة مئوية)', hint: 'يُضاف إلى النسبة المشتقة من الانتظام والتأخر' },
  { k: 'subscriberGrowth', label: 'نمو عدد المشتركين سنويًا %' },
  { k: 'loanDefault', label: 'معدل تعثر القروض %' },
  { k: 'inflation', label: 'التضخم %', hint: 'يرفع المصروفات والمساعدات والصيانة وحجم القروض' },
  { k: 'rentGrowth', label: 'نمو الإيجارات سنويًا %' },
  { k: 'occupancyDelta', label: 'أثر الإشغال (نقطة مئوية)', hint: 'يُضاف إلى نسبة إشغال كل أصل' },
  { k: 'propertyGrowth', label: 'نمو أسعار العقارات سنويًا %', hint: 'يرفع سعر الشراء والقيمة' },
  { k: 'portfolioReturn', label: 'عائد المحافظ الاستثمارية سنويًا %' },
];

const Inputs = ({ issues }: { issues: string[] }) => {
  const { project: p } = useDerived();
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-5">
      {issues.length > 0 && (
        <Callout tone="warn" title="مدخلات ناقصة">
          <ul className="list-disc ps-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Callout>
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">مدخلات الاشتراكات</h2>
          <button className="btn btn-soft btn-sm" onClick={() => go('subscriptions')}>
            فتح قسم الاشتراكات
          </button>
        </div>
        <p className="text-sm text-mute">
          الفئات والأعداد والقيم والمدد وتاريخ الانضمام تُدار في قسم الاشتراكات، وهي نفس المدخلات المستخدمة هنا. الفئات الحالية:{' '}
          {p.groups.map((g) => `${g.name} (${expectedCount(g)})`).join('، ')}.
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg">مدخلات التشغيل والإقراض والاستثمار</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <VarField k="horizon_years" />
          <VarField k="founding_support" />
          <VarField k="annual_donations" />
          <VarField k="operating_expenses_annual" />
          <VarField k="aid_annual_budget" />
          <VarField k="min_cash_reserve" />
          <VarField k="reinvest_share" />
          <VarField k="allow_purchase_before_end" />
          <VarField k="loan_requests_per_year" />
          <VarField k="loan_avg_amount" />
          <VarField k="loan_term_months" />
          <VarField k="loan_pool_pct" />
        </div>
        <p className="hint mt-3">الأصول العقارية والمحافظ وأسعارها وإيجاراتها ونسب إشغالها وصيانتها تُدار في «سجل الأصول العقارية».</p>
      </Card>
      <Card>
        <h2 className="mb-1 text-lg">افتراضات السيناريوهات</h2>
        <p className="mb-3 text-sm text-mute">افتراضات تحليلية قابلة للتعديل لكل سيناريو على حدة، وليست توقعات ولا ضمانات.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="p-2 text-start">الافتراض</th>
                {SCENARIO_ORDER.map((id) => (
                  <th key={id} className="p-2">
                    <TextInput value={p.scenarios[id].name} ariaLabel="اسم السيناريو" onChange={(v) => update((d) => void (d.scenarios[id].name = v), `scn:${id}`)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SC_ROWS.map((row) => (
                <tr key={row.k} className="border-t border-line">
                  <td className="p-2">
                    <div className="font-semibold">{row.label}</div>
                    {row.hint && <div className="text-xs text-mute">{row.hint}</div>}
                  </td>
                  {SCENARIO_ORDER.map((id) => (
                    <td key={id} className="p-2">
                      <NumInput
                        ariaLabel={`${row.label} - ${p.scenarios[id].name}`}
                        value={p.scenarios[id][row.k] as number}
                        onChange={(v) => update((d) => void ((d.scenarios[id][row.k] as number) = v ?? 0), `sc:${id}:${row.k}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">النسبة الأساسية للتحصيل {pct(baseCollection(p), 1)} (الانتظام + التأخر × المسترد). تُعدَّل في قسم الاشتراكات.</p>
      </Card>
    </div>
  );
};

const Results = ({ r }: { r: SimResult }) => {
  const data = r.years.map((y) => ({ name: y.label, ...y, cov: y.coverage != null ? Math.round(y.coverage * 100) : null }));
  const last = r.years[r.years.length - 1];
  const endLabelYear = r.endMonth != null ? String(Number(r.startYm.slice(0, 4)) + Math.floor((r.endMonth - 1) / 12)) : null;
  const waqfValue = last.endowedValue;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={<Term k="commitments">مجموع الالتزامات التعاقدية</Term>} value={compactMoney(r.totalCommitment)} sub="قبل التحصيل" />
        <Stat label="التدفقات المحصلة من الاشتراكات (متوقعة)" value={compactMoney(r.totalCollected)} sub="تقدير بعد نسبة التحصيل" />
        <Stat label="تاريخ انتهاء الاشتراكات" value={r.endLabel ?? '—'} />
        <Stat label="الرصيد النقدي آخر الأفق" value={compactMoney(last.endCash)} tone={last.endCash < 0 ? 'bad' : undefined} />
        <Stat label="القروض القائمة آخر الأفق" value={compactMoney(last.loansOutstanding)} sub={`مستردة (أصل): ${compactMoney(r.loans.repaid)}`} />
        <Stat label="المساعدات المصروفة (الأفق)" value={compactMoney(r.years.reduce((s, y) => s + y.aid, 0))} />
        <Stat label="المصروفات التشغيلية (الأفق)" value={compactMoney(r.years.reduce((s, y) => s + y.operating, 0))} />
        <Stat label="الاحتياطي آخر الأفق" value={compactMoney(last.reserve)} />
        <Stat label="قيمة الأصول المملوكة" value={compactMoney(last.assetsValue)} sub={`منها مخطط وقفه: ${compactMoney(waqfValue)}`} />
        <Stat label="صافي العوائد المتوقعة (آخر سنة)" value={compactMoney(last.assetIncome)} />
        <Stat label={<Term k="coverage">قدرة العوائد على تغطية النشاط</Term>} value={r.finalCoverage != null ? pct(r.finalCoverage * 100) : '—'} tone={r.finalCoverage != null && r.finalCoverage < 1 ? 'warn' : undefined} />
        <Stat label="الفجوة التمويلية للاستدامة" value={r.fundingGap != null ? compactMoney(r.fundingGap) : '—'} sub={r.requiredCapital != null ? `رأس المال اللازم ${compactMoney(r.requiredCapital)}` : undefined} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-3xl font-bold text-brand-900">{r.sustainabilityIndex != null ? `${r.sustainabilityIndex} من 100` : '—'}</div>
          <div>
            <b><Term k="sustainability">مؤشر الاستدامة المالية</Term></b>
            <p className="text-xs text-mute">
              = 100 × (0.5 × تغطية النشاط آخر الأفق [{pct(r.indexParts.coverage * 100)}] + 0.3 × نسبة السنوات التي بلغ فيها النقد الاحتياطي الأدنى [{pct(r.indexParts.liquidity * 100)}] + 0.2 × نسبة الأصول المستهدفة التي تحققت [{pct(r.indexParts.assets * 100)}]). مؤشر تقديري مركّب وليس ضمانًا.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="تطور الأموال عبر السنوات" note="النقد والقروض القائمة والأصول، والقيمة الإجمالية">
          <AreaChart data={data}>
            {axes()}
            <Area type="monotone" dataKey="endCash" name="النقد" stackId="1" stroke={C.green} fill={C.light} />
            <Area type="monotone" dataKey="loansOutstanding" name="القروض القائمة" stackId="1" stroke={C.blue} fill="#9ec2d3" />
            <Area type="monotone" dataKey="assetsValue" name="الأصول" stackId="1" stroke={C.gold} fill="#e7d49d" />
            <Line type="monotone" dataKey="netWorth" name="القيمة الإجمالية" stroke={C.red} dot={false} strokeWidth={2} />
            {endLabelYear && <ReferenceLine x={endLabelYear} stroke={C.red} strokeDasharray="4 4" label={{ value: 'نهاية الاشتراكات', fontSize: 11, fill: C.red }} />}
          </AreaChart>
        </ChartCard>
        <ChartCard title="الاشتراكات مقابل العوائد الاستثمارية" note="الاشتراكات المحصلة وصافي دخل الأصول بعد الصيانة والمصاريف">
          <BarChart data={data}>
            {axes()}
            <Bar dataKey="subscriptions" name="الاشتراكات" fill={C.green} />
            <Bar dataKey="assetIncome" name="صافي عوائد الأصول" fill={C.gold} />
          </BarChart>
        </ChartCard>
        <ChartCard title="التدفقات النقدية" note="التدفق الصافي والتشغيلي ورصيد نهاية السنة">
          <ComposedChart data={data}>
            {axes()}
            <Bar dataKey="netCashFlow" name="التدفق الصافي (يشمل القروض والشراء)" fill={C.light} />
            <Line type="monotone" dataKey="operatingCashFlow" name="التدفق التشغيلي" stroke={C.blue} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="endCash" name="رصيد النقد" stroke={C.green} dot={false} strokeWidth={2} />
            <ReferenceLine y={0} stroke="#555" />
          </ComposedChart>
        </ChartCard>
        <ChartCard title="المساعدات والقروض" note="المساعدات المصروفة وأصل القروض المصروفة والمستردة">
          <BarChart data={data}>
            {axes()}
            <Bar dataKey="aid" name="المساعدات" fill={C.gold} />
            <Bar dataKey="loansDisbursed" name="قروض مصروفة" fill={C.blue} />
            <Bar dataKey="loanRepayments" name="أقساط مستردة (أصل)" fill={C.light} />
          </BarChart>
        </ChartCard>
        <ChartCard title="القيمة الإجمالية للأصول" note="الأصول المملوكة، ومنها ما يُخطط وقفه بوثيقة مستقلة (ليس وقفًا رسميًا قبل التوثيق)">
          <AreaChart data={data}>
            {axes()}
            <Area type="monotone" dataKey="assetsValue" name="الأصول المملوكة" stroke={C.gold} fill="#e7d49d" />
            <Area type="monotone" dataKey="endowedValue" name="مخطط وقفه" stroke={C.green} fill={C.light} />
          </AreaChart>
        </ChartCard>
        <ChartCard title="تطور الاستقلال المالي بعد انتهاء الاشتراكات" note="تغطية العوائد القابلة للصرف للنفقات السنوية؛ 100% تعني تغطية كاملة">
          <LineChart data={data}>
            {axes((v) => `${v}%`)}
            <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l) => `السنة ${l}`} contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }} />
            <Line type="monotone" dataKey="cov" name="التغطية %" stroke={C.green} strokeWidth={2} dot={false} connectNulls />
            <ReferenceLine y={100} stroke={C.red} strokeDasharray="4 4" label={{ value: '100%', fontSize: 11, fill: C.red }} />
            {endLabelYear && <ReferenceLine x={endLabelYear} stroke={C.gray} strokeDasharray="4 4" />}
          </LineChart>
        </ChartCard>
      </div>

      <Card>
        <h3 className="mb-2 text-base">السنة المحتملة لشراء كل عقار</h3>
        {r.purchases.length === 0 && r.notPurchased.length === 0 ? (
          <p className="text-sm text-mute">لا أصول مستهدفة في السجل.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.purchases.map((x) => (
              <li key={x.assetId}>
                <Badge tone="ok">{x.label}</Badge> <b>{x.name}</b> — السنة {x.year} من البداية، بتكلفة تقديرية {money(x.cost)}
              </li>
            ))}
            {r.notPurchased.map((x) => (
              <li key={x.assetId}>
                <Badge tone="bad">لا يتحقق</Badge> <b>{x.name}</b> — لا تسمح التدفقات بشرائه ضمن الأفق
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="mb-2 text-base">الجدول السنوي المفصل</h3>
        <table className="w-full min-w-[70rem] text-xs">
          <thead>
            <tr className="bg-brand-50 text-brand-900">
              {['السنة', 'اشتراكات', 'دعم/تبرعات', 'أقساط مستردة', 'صافي أصول', 'تشغيل', 'مساعدات', 'قروض مصروفة', 'شراء أصول', 'تدفق صافٍ', 'النقد', 'قروض قائمة', 'أصول', 'مخطط وقفه', 'القيمة الإجمالية', 'تغطية'].map((h) => (
                <th key={h} className="p-1.5 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.years.map((y) => (
              <tr key={y.index} className="border-t border-line">
                <td className="p-1.5 font-bold">{y.label}</td>
                <td className="p-1.5">{compactMoney(y.subscriptions)}</td>
                <td className="p-1.5">{compactMoney(y.founding + y.donations)}</td>
                <td className="p-1.5">{compactMoney(y.loanRepayments)}</td>
                <td className="p-1.5">{compactMoney(y.assetIncome)}</td>
                <td className="p-1.5">{compactMoney(y.operating)}</td>
                <td className="p-1.5">{compactMoney(y.aid)}</td>
                <td className="p-1.5">{compactMoney(y.loansDisbursed)}</td>
                <td className="p-1.5">{compactMoney(y.purchases)}</td>
                <td className={cx('p-1.5', y.netCashFlow < 0 && 'text-bad')}>{compactMoney(y.netCashFlow)}</td>
                <td className={cx('p-1.5 font-bold', y.endCash < 0 && 'text-bad')}>{compactMoney(y.endCash)}</td>
                <td className="p-1.5">{compactMoney(y.loansOutstanding)}</td>
                <td className="p-1.5">{compactMoney(y.assetsValue)}</td>
                <td className="p-1.5">{compactMoney(y.endowedValue)}</td>
                <td className="p-1.5">{compactMoney(y.netWorth)}</td>
                <td className="p-1.5">{y.coverage != null ? pct(y.coverage * 100) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const ScenarioCompare = () => {
  const { project: p, sims } = useDerived();
  const data = sims.base.years.map((y, i) => ({
    name: y.label,
    conservative: sims.conservative.years[i].netWorth,
    base: sims.base.years[i].netWorth,
    optimistic: sims.optimistic.years[i].netWorth,
  }));
  const rows: [string, (s: SimResult) => string][] = [
    ['إجمالي الاشتراكات المحصلة', (s) => compactMoney(s.totalCollected)],
    ['الرصيد النقدي آخر الأفق', (s) => compactMoney(s.years[s.years.length - 1].endCash)],
    ['القروض المصروفة', (s) => compactMoney(s.loans.disbursed)],
    ['المشطوب بالتعثر', (s) => compactMoney(s.loans.writtenOff)],
    ['قيمة الأصول آخر الأفق', (s) => compactMoney(s.years[s.years.length - 1].assetsValue)],
    ['القيمة الإجمالية آخر الأفق', (s) => compactMoney(s.years[s.years.length - 1].netWorth)],
    ['الأصول المشتراة', (s) => `${s.purchases.length} من ${s.purchases.length + s.notPurchased.length}`],
    ['تغطية النشاط آخر الأفق', (s) => (s.finalCoverage != null ? pct(s.finalCoverage * 100) : '—')],
    ['الفجوة التمويلية للاستدامة', (s) => (s.fundingGap != null ? compactMoney(s.fundingGap) : '—')],
    ['سنوات نقص السيولة', (s) => String(s.shortfallYears.length)],
    ['مؤشر الاستدامة', (s) => (s.sustainabilityIndex != null ? String(s.sustainabilityIndex) : '—')],
  ];
  return (
    <div className="space-y-5">
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="bg-brand-50 text-brand-900">
              <th className="p-2 text-start">المؤشر</th>
              {SCENARIO_ORDER.map((id) => (
                <th key={id} className="p-2 text-start">{p.scenarios[id].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-t border-line">
                <th className="p-2 text-start font-semibold">{label}</th>
                {SCENARIO_ORDER.map((id) => (
                  <td key={id} className="p-2">{fn(sims[id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ChartCard title="القيمة الإجمالية للصندوق في السيناريوهات الثلاثة" note="النقد + القروض القائمة + الأصول">
        <LineChart data={data}>
          {axes()}
          <Line type="monotone" dataKey="conservative" name={p.scenarios.conservative.name} stroke={C.red} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="base" name={p.scenarios.base.name} stroke={C.green} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="optimistic" name={p.scenarios.optimistic.name} stroke={C.gold} dot={false} strokeWidth={2} />
        </LineChart>
      </ChartCard>
    </div>
  );
};

const Reverse = () => {
  const { project: p } = useDerived();
  const update = useStore((s) => s.update);
  const expected = p.groups.reduce((s, g) => s + expectedCount(g), 0);
  const avgCost = p.assets.length > 0 ? Math.round(p.assets.reduce((s, a) => s + (a.targetCost ?? 0), 0) / p.assets.length) : null;
  const [subs, setSubs] = useState<number | null>(expected || null);
  const [years, setYears] = useState<number | null>(numVar(p, 'subscription_years'));
  const [count, setCount] = useState<number | null>(p.assets.length || null);
  const [cost, setCost] = useState<number | null>(avgCost);
  const [reserve, setReserve] = useState<number | null>(numVar(p, 'min_cash_reserve'));
  const [horizon, setHorizon] = useState<number | null>(numVar(p, 'horizon_years') ?? 20);
  const [monthly, setMonthly] = useState<number | null>(numVar(p, 'monthly_contribution'));
  const [res, setRes] = useState<ReverseResult | null>(null);
  const [fund, setFund] = useState<FundableResult | null>(null);
  const ok = subs && years && count && cost && horizon && horizon >= years;
  const ok2 = subs && years && cost && horizon && monthly && horizon >= years;

  return (
    <div className="space-y-5">
      <Callout tone="info">
        تعمل الحاسبتان بالمحرك نفسه (السيناريو الأساسي) وتعرضان الافتراضات والفجوة. تُهمل عوائد الأصول المفترضة تحفظًا، وتُطبَّق مصروفاتك وقروضك الحالية. جميع الأرقام تقديرية وليست ضمانًا لتحقق العوائد أو الشراء.
      </Callout>
      <Card>
        <h2 className="mb-3 text-lg">ما الاشتراك الشهري المطلوب لتحقيق أهدافي؟</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="عدد المشتركين المستهدف">
            <NumInput value={subs} min={1} onChange={setSubs} />
          </Field>
          <Field label="عدد سنوات الالتزام">
            <NumInput value={years} min={1} max={60} onChange={setYears} />
          </Field>
          <Field label="عدد العقارات المستهدفة">
            <NumInput value={count} min={1} max={30} onChange={setCount} />
          </Field>
          <Field label="تكلفة كل عقار (ريال)">
            <NumInput value={cost} min={1} onChange={setCost} />
          </Field>
          <Field label="الاحتياطي المطلوب (ريال)">
            <NumInput value={reserve} min={0} onChange={setReserve} />
          </Field>
          <Field label="أفق التحقق (سنة)" hint="يجب ألا يقل عن سنوات الالتزام">
            <NumInput value={horizon} min={1} max={30} onChange={setHorizon} />
          </Field>
        </div>
        <button
          className="btn btn-primary mt-3"
          disabled={!ok}
          onClick={() => setRes(requiredContribution(p, { subscribers: subs!, years: years!, assetCount: count!, assetCost: cost!, reserve: reserve ?? 0, horizonYears: horizon! }))}
        >
          احسب الاشتراك المطلوب
        </button>
        {res && (
          <div className="mt-4 space-y-3">
            {res.feasible ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="الاشتراك الشهري التقريبي المطلوب" value={money(res.monthly)} sub="بالمحرك الكامل" />
                <Stat label="تقدير مبسط (للمقارنة)" value={res.analytic != null ? money(res.analytic) : '—'} sub="إجمالي الحاجة ÷ إجمالي التحصيل" />
                <Stat
                  label="اشتراكك الحالي"
                  value={res.currentMonthly != null ? money(res.currentMonthly) : '—'}
                  sub={res.shortfallAtCurrent != null ? (res.shortfallAtCurrent > 0 ? `فجوة تمويلية ≈ ${compactMoney(res.shortfallAtCurrent)}` : 'يحقق الهدف') : undefined}
                  tone={res.shortfallAtCurrent ? 'warn' : undefined}
                />
              </div>
            ) : (
              <Callout tone="bad">لا يتحقق الهدف ضمن هذه الافتراضات والأفق حتى باشتراكات مرتفعة جدًا؛ خفّض الأهداف أو مدّد الأفق أو غيّر المصروفات.</Callout>
            )}
            <div>
              <b className="text-sm">الافتراضات</b>
              <ul className="list-disc ps-5 text-sm text-mute">
                {res.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            {res.feasible && res.monthly != null && (
              <button
                className="btn btn-soft btn-sm"
                onClick={() =>
                  update((d) => {
                    d.vars.monthly_contribution = res.monthly;
                    d.vars.subscription_years = years;
                    d.vars.duration_mode = 'uniform';
                  })
                }
              >
                تطبيق القيمة والمدة على المشروع
              </button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg">كم عقارًا يمكن تمويله باشتراكي ومدتي؟</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الاشتراك الشهري (ريال)">
            <NumInput value={monthly} min={0} onChange={setMonthly} />
          </Field>
          <Field label="عدد المشتركين">
            <NumInput value={subs} min={1} onChange={setSubs} />
          </Field>
          <Field label="عدد سنوات الالتزام">
            <NumInput value={years} min={1} onChange={setYears} />
          </Field>
          <Field label="تكلفة العقار الواحد">
            <NumInput value={cost} min={1} onChange={setCost} />
          </Field>
          <Field label="الاحتياطي المطلوب">
            <NumInput value={reserve} min={0} onChange={setReserve} />
          </Field>
          <Field label="أفق التحقق (سنة)">
            <NumInput value={horizon} min={1} max={30} onChange={setHorizon} />
          </Field>
        </div>
        <button
          className="btn btn-primary mt-3"
          disabled={!ok2}
          onClick={() => setFund(fundableAssets(p, { subscribers: subs!, years: years!, assetCost: cost!, reserve: reserve ?? 0, horizonYears: horizon!, monthly: monthly! }))}
        >
          قدّر عدد الأصول
        </button>
        {fund && (
          <div className="mt-4 space-y-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="عدد الأصول الممكن تمويلها (تقدير)" value={fund.count} />
              <Stat label="وقت الوصول للأول" value={fund.firstLabel ?? 'لا يتحقق'} />
            </div>
            {fund.years.length > 0 && (
              <p className="text-sm text-mute">
                مواعيد الشراء المحتملة: {fund.years.map((y) => `${y.n}) ${y.label}`).join('، ')}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

const Stress = ({ sid }: { sid: ScenarioId }) => {
  const { project: p } = useDerived();
  const [def, setDef] = useState<number | null>(10);
  const [occ, setOcc] = useState<number | null>(20);
  const res = useMemo(() => stressTest(p, sid, def ?? 0, occ ?? 0), [p, sid, def, occ]);
  const { base, stressed } = res;
  const row = (label: string, a: string, b: string): ReactNode => (
    <tr className="border-t border-line">
      <th className="p-2 text-start font-semibold">{label}</th>
      <td className="p-2">{a}</td>
      <td className="p-2">{b}</td>
    </tr>
  );
  const l = (s: SimResult) => s.years[s.years.length - 1];
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-3 text-lg">أثر التعثر أو انخفاض الإيجارات</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="زيادة معدل تعثر القروض (نقطة مئوية)">
            <NumInput value={def} min={0} max={100} onChange={setDef} />
          </Field>
          <Field label="انخفاض نسبة الإشغال/الإيجارات (نقطة مئوية)">
            <NumInput value={occ} min={0} max={100} onChange={setOcc} />
          </Field>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="bg-brand-50 text-brand-900">
                <th className="p-2 text-start">المؤشر</th>
                <th className="p-2 text-start">قبل الضغط</th>
                <th className="p-2 text-start">بعد الضغط</th>
              </tr>
            </thead>
            <tbody>
              {row('المشطوب من القروض', compactMoney(base.loans.writtenOff), compactMoney(stressed.loans.writtenOff))}
              {row('صافي عوائد آخر سنة', compactMoney(l(base).assetIncome), compactMoney(l(stressed).assetIncome))}
              {row('القيمة الإجمالية آخر الأفق', compactMoney(l(base).netWorth), compactMoney(l(stressed).netWorth))}
              {row('تغطية النشاط', base.finalCoverage != null ? pct(base.finalCoverage * 100) : '—', stressed.finalCoverage != null ? pct(stressed.finalCoverage * 100) : '—')}
              {row('سنوات نقص السيولة', String(base.shortfallYears.length), String(stressed.shortfallYears.length))}
              {row('مؤشر الاستدامة', String(base.sustainabilityIndex ?? '—'), String(stressed.sustainabilityIndex ?? '—'))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">يُجرى الاختبار على السيناريو المختار فقط دون تغيير افتراضاتك المحفوظة. ({num(def ?? 0)} نقطة تعثر، {num(occ ?? 0)} نقطة إشغال)</p>
      </Card>
    </div>
  );
};
