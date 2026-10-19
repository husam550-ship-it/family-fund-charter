import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { ContribGroup, ContribOption } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { baseCollection, expectedCount, groupPlans, isUniform } from '../engine/subscriptions';
import { evaluateOption } from '../engine/reverse';
import { fairnessFindings } from '../engine/fairness';
import { compactMoney, hijriOfYm, money, num, pct, uid, addMonths } from '../lib/format';
import { Badge, Callout, Card, cx, EmptyState, SectionHead, Stat, Tabs, Term } from '../components/ui';
import { VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';

type Tab = 'vars' | 'duration' | 'policies' | 'fair' | 'options' | 'shortfall';

const GENDERS = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'إناث' },
  { value: 'mixed', label: 'مختلطة' },
];

export default function Subscriptions() {
  const { project: p, sims } = useDerived();
  const update = useStore((s) => s.update);
  const [tab, setTab] = useState<Tab>('vars');
  const uniform = isUniform(p);
  const plans = groupPlans(p);
  const base = sims.base;
  const subs = p.groups.reduce((s, g) => s + expectedCount(g), 0);
  const monthly = typeof p.vars.monthly_contribution === 'number' ? p.vars.monthly_contribution : null;
  const endYm = base.endMonth != null && base.endMonth > 0 ? addMonths(base.startYm, base.endMonth - 1) : null;
  const findings = useMemo(() => fairnessFindings(p).filter((f) => f.rule === 'duration-gap'), [p]);
  const coll = baseCollection(p);
  const sumRates = (Number(p.vars.regularity_rate) || 0) + (Number(p.vars.late_rate) || 0) + (Number(p.vars.exemption_rate) || 0);

  return (
    <div className="space-y-6">
      <SectionHead
        num="04 / الاشتراكات والالتزامات"
        title="الاشتراكات والالتزامات"
        sub="أدخل كل متغير مرة واحدة فيتحدّث في البنود والحسابات والتقارير. وللالتزام نهاية محددة وملزمة لا يمدّدها بلوغ الهدف المالي."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="المشتركون المتوقعون" value={subs > 0 ? num(subs) : '—'} sub="المستهدفون × نسبة المشاركة" />
        <Stat label="الاشتراك السنوي للفرد" value={monthly != null ? money(monthly * 12) : '—'} />
        <Stat label={<Term k="commitments">إجمالي الالتزامات التعاقدية</Term>} value={base.totalCommitment > 0 ? compactMoney(base.totalCommitment) : '—'} sub="قبل نسبة التحصيل، تقديري" />
        <Stat label="انتهاء الالتزام" value={base.endLabel ?? '—'} sub={endYm ? hijriOfYm(endYm) : undefined} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'vars', label: 'المتغيرات والفئات' },
          { id: 'duration', label: 'المدة والانتهاء' },
          { id: 'policies', label: 'السياسات والاستثناءات' },
          { id: 'fair', label: 'المقارنة العادلة', badge: findings.length },
          { id: 'options', label: 'مقارنة الخيارات' },
          { id: 'shortfall', label: 'إذا لم يبلغ الصندوق هدفه' },
        ]}
      />

      {tab === 'vars' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg">متغيرات الاشتراك</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <VarField k="subscription_start" />
              <VarField k="monthly_contribution" />
              <div>
                <span className="label">الاشتراك السنوي (محسوب)</span>
                <div className="input flex items-center bg-ivory text-mute">{monthly != null ? money(monthly * 12) : '—'}</div>
              </div>
              <VarField k="subscription_years" />
              <VarField k="grace_months" />
              <VarField k="founding_payment" />
              <VarField k="founding_support" />
              <VarField k="annual_donations" />
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-lg">نسب التحصيل</h2>
            <p className="mb-3 text-sm text-mute">
              نسبة التحصيل الأساسية = الانتظام + (التأخر × ما يُسترد من المتأخرين). تُعدَّل لكل سيناريو في قسم المحاكاة. القيم هنا افتراضات تحليلية وليست معلومة.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <VarField k="regularity_rate" />
              <VarField k="late_rate" />
              <VarField k="late_recovery_rate" />
              <VarField k="exemption_rate" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">نسبة التحصيل الأساسية: {pct(coll, 1)}</Badge>
              {sumRates > 100.01 && <Badge tone="bad">الانتظام + التأخر + الإعفاء = {pct(sumRates)} (يتجاوز 100%)</Badge>}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-lg">فئات المشتركين</h2>
            <p className="mb-3 text-sm text-mute">
              {uniform
                ? 'نموذج المدة الحالي «موحد»: تُستخدم قيمة الاشتراك والمدة العامة لكل الفئات، فتُهمل حقول القيمة والمدة والانضمام الخاصة بالفئة. غيّر النموذج من تبويب «المدة والانتهاء» لتفعيلها.'
                : 'نموذج المدة الحالي يسمح بقيمة ومدة وتاريخ انضمام لكل فئة. اترك الحقل فارغًا لاستخدام القيمة العامة.'}
            </p>
            <EditableTable<ContribGroup>
              rows={p.groups}
              cols={[
                { key: 'name', label: 'الفئة', w: 1.2 },
                { key: 'gender', label: 'النوع', type: 'select', options: GENDERS, w: 0.9 },
                { key: 'target', label: 'العدد المستهدف', type: 'number', min: 0, w: 0.9 },
                { key: 'participation', label: 'نسبة المشاركة %', type: 'number', min: 0, max: 100, w: 0.9 },
                {
                  key: 'monthlyAmount',
                  label: 'الاشتراك الشهري',
                  w: 1,
                  render: (g) =>
                    uniform ? (
                      <span className="text-sm text-mute">{monthly != null ? money(monthly) : '—'}</span>
                    ) : (
                      <PlanNum row={g} field="monthlyAmount" />
                    ),
                },
                {
                  key: 'years',
                  label: 'المدة (سنوات)',
                  w: 0.9,
                  render: (g) =>
                    uniform ? <span className="text-sm text-mute">{p.vars.subscription_years ?? '—'}</span> : <PlanNum row={g} field="years" />,
                },
                {
                  key: 'joinOffsetMonths',
                  label: 'الانضمام بعد (شهر)',
                  w: 0.9,
                  render: (g) => (uniform ? <span className="text-sm text-mute">0</span> : <PlanNum row={g} field="joinOffsetMonths" />),
                },
                { key: 'actual', label: 'العدد الفعلي', type: 'number', min: 0, w: 0.8 },
              ]}
              onChange={(rows) => update((d) => void (d.groups = rows))}
              onAdd={() =>
                update((d) => {
                  d.groups.push({ id: uid('grp'), name: 'فئة جديدة', gender: 'mixed', target: null, participation: 100, monthlyAmount: null, years: null, joinOffsetMonths: 0, actual: null });
                })
              }
              addLabel="إضافة فئة"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {plans.map((g) => (
                <Badge key={g.id} tone="plain">
                  {g.name}: {g.count} × {money(g.amount)} {g.end != null ? `× ${g.end - g.begin} شهرًا` : '(المدة غير محددة)'}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'duration' && (
        <div className="space-y-5">
          <Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <VarField k="duration_mode" />
              <VarField k="end_mode" />
              <VarField k="commitment_end_date" />
            </div>
            <p className="hint mt-2">هذه المتغيرات تتغير أيضًا عند اختيار بديل في البنود أدناه، ويمكنك ضبطها هنا مباشرة.</p>
          </Card>
          <Callout tone="gold" title="مبدأ">
            المساواة في الحقوق مبدأ أساسي. أما اختلاف مدة الالتزام بين الفئات فمسألة تُناقش ولا يُفترض اعتمادها، ولا يترتب على اختلاف المدة اختلاف الحقوق الأساسية. وبلوغ الهدف المالي لا يمدّد الاشتراكات تلقائيًا.
          </Callout>
          <ClauseList ids={['SUB-03', 'SUB-04', 'SUB-05', 'SUB-06']} title="نموذج المدة وانتهاء الالتزام" allowAdd={false} />
        </div>
      )}

      {tab === 'policies' && (
        <ClauseList
          ids={['SUB-01', 'SUB-02', 'SUB-08', 'SUB-09', 'SUB-10', 'SUB-11', 'SUB-12', 'SUB-13', 'SUB-14', 'SUB-15', 'SUB-16']}
          categories={['contributions']}
          title="بنود الاشتراكات"
        />
      )}

      {tab === 'fair' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-1 text-lg">مقارنة إجمالي المساهمات الفعلية</h2>
            <p className="mb-3 text-sm text-mute">إجمالي ما يدفعه الفرد في كل فئة طوال مدته. أي فرق يجب أن يكون له مسوّغ معلن ولا يمس الحقوق الأساسية.</p>
            {plans.every((g) => g.end == null || g.amount <= 0) ? (
              <EmptyState>أدخل قيمة الاشتراك والمدة لتظهر المقارنة.</EmptyState>
            ) : (
              <FairTable />
            )}
          </Card>
          {findings.map((f) => (
            <Callout key={f.id} tone="warn" title={f.title}>
              <p>{f.impact}</p>
              <ul className="mt-1 list-disc ps-5">
                {f.fixes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Callout>
          ))}
          {findings.length === 0 && <Callout tone="ok">لا يظهر تفاوت بين الفئات في إجمالي المساهمة بالإعدادات الحالية.</Callout>}
        </div>
      )}

      {tab === 'options' && <OptionsCompare />}

      {tab === 'shortfall' && <ShortfallPanel />}
    </div>
  );
}

/** حقل رقمي لقيمة فئة قابلة للترك فارغة */
const PlanNum = ({ row, field }: { row: ContribGroup; field: 'monthlyAmount' | 'years' | 'joinOffsetMonths' }) => {
  const update = useStore((s) => s.update);
  const v = row[field];
  return (
    <input
      className="input ltr text-end"
      inputMode="decimal"
      aria-label={field}
      value={v ?? ''}
      placeholder="العام"
      onChange={(e) => {
        const t = e.target.value.trim();
        const n = t === '' ? null : Number(t);
        if (n !== null && Number.isNaN(n)) return;
        update((d) => {
          const g = d.groups.find((x) => x.id === row.id);
          if (g) (g as unknown as Record<string, number | null>)[field] = field === 'joinOffsetMonths' ? (n ?? 0) : n;
        }, `grp:${row.id}:${field}`);
      }}
    />
  );
};

const FairTable = () => {
  const { project: p } = useDerived();
  const plans = groupPlans(p).filter((g) => g.count > 0 || g.amount > 0);
  const rows = plans.map((g) => {
    const months = g.end != null ? g.end - g.begin : 0;
    return { g, months, per: g.amount * months, total: g.amount * months * g.count };
  });
  const max = Math.max(1, ...rows.map((r) => r.per));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-start text-xs text-mute">
            <th className="p-2 text-start">الفئة</th>
            <th className="p-2 text-start">العدد</th>
            <th className="p-2 text-start">الشهري</th>
            <th className="p-2 text-start">المدة (شهرًا)</th>
            <th className="p-2 text-start">إجمالي الفرد</th>
            <th className="p-2 text-start">إجمالي الفئة</th>
            <th className="w-40 p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, months, per, total }) => (
            <tr key={g.id} className="border-t border-line">
              <td className="p-2 font-semibold">{g.name}</td>
              <td className="p-2">{g.count}</td>
              <td className="p-2">{money(g.amount)}</td>
              <td className="p-2">{g.end == null ? '—' : months}</td>
              <td className="p-2 font-bold">{money(per)}</td>
              <td className="p-2">{money(total)}</td>
              <td className="p-2">
                <div className="h-2 rounded-full bg-brand-50">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(per / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OptionsCompare = () => {
  const { project: p } = useDerived();
  const update = useStore((s) => s.update);
  const rows = useMemo(
    () => p.contribOptions.map((o) => ({ o, r: o.monthly != null && o.years != null ? evaluateOption(p, o.monthly, o.years) : null })),
    [p],
  );
  const addExamples = (): void =>
    update((d) => {
      for (const [m, y] of [[100, 10], [150, 8], [200, 6]] as const) {
        d.contribOptions.push({ id: uid('opt'), name: `${m} ريال × ${y} سنوات (مثال توضيحي)`, monthly: m, years: y, illustrative: true });
      }
    });
  return (
    <div className="space-y-4">
      <Callout tone="info">
        أنشئ أي عدد من الخيارات (قيمة شهرية ومدة). تُحسب كل مقارنة بالمحرك نفسه وفق عدد المشتركين الفعلي والمفترض في فئاتك وأصولك المسجلة (السيناريو الأساسي). الأرقام تقديرية.
      </Callout>
      <Card>
        <EditableTable<ContribOption>
          rows={p.contribOptions}
          cols={[
            { key: 'name', label: 'اسم الخيار', w: 1.6 },
            { key: 'monthly', label: 'الشهري (ريال)', type: 'number', min: 0, w: 1 },
            { key: 'years', label: 'المدة (سنوات)', type: 'number', min: 0, w: 1 },
          ]}
          onChange={(rs) => update((d) => void (d.contribOptions = rs))}
          onAdd={() => update((d) => void d.contribOptions.push({ id: uid('opt'), name: `خيار ${d.contribOptions.length + 1}`, monthly: null, years: null, illustrative: false }))}
          addLabel="إضافة خيار"
          empty="لا توجد خيارات بعد."
          rowTools={(o) => (
            <button
              className="btn btn-soft btn-sm"
              title="اعتماد قيم هذا الخيار في المتغيرات"
              disabled={o.monthly == null || o.years == null}
              onClick={() =>
                update((d) => {
                  d.vars.monthly_contribution = o.monthly;
                  d.vars.subscription_years = o.years;
                  d.vars.duration_mode = 'uniform';
                })
              }
            >
              <Play className="size-3.5" /> تطبيق
            </button>
          )}
        />
        <button className="btn btn-gold btn-sm mt-3" onClick={addExamples}>
          إضافة الأمثلة التوضيحية (100×10، 150×8، 200×6)
        </button>
      </Card>

      {rows.some((r) => r.r) && (
        <Card>
          <h2 className="mb-3 text-lg">نتائج المقارنة</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th className="p-2 text-start">الخيار</th>
                  <th className="p-2 text-start">التزام الفرد</th>
                  <th className="p-2 text-start">إجمالي الالتزامات</th>
                  <th className="p-2 text-start">المحصل المتوقع</th>
                  <th className="p-2 text-start">نهاية الالتزام</th>
                  <th className="p-2 text-start">الأصول المشتراة</th>
                  <th className="p-2 text-start">القيمة الإجمالية آخر الأفق</th>
                  <th className="p-2 text-start">مؤشر الاستدامة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ o, r }) => (
                  <tr key={o.id} className={cx('border-t border-line', !r && 'text-mute')}>
                    <td className="p-2 font-semibold">{o.name}</td>
                    {r ? (
                      <>
                        <td className="p-2">{money(r.perSubscriber)}</td>
                        <td className="p-2">{compactMoney(r.totalCommitment)}</td>
                        <td className="p-2">{compactMoney(r.totalCollected)}</td>
                        <td className="p-2">{r.endLabel ?? '—'}</td>
                        <td className="p-2">
                          {r.purchased} من {r.targeted}
                        </td>
                        <td className="p-2">{compactMoney(r.finalNetWorth)}</td>
                        <td className="p-2">{r.index ?? '—'}</td>
                      </>
                    ) : (
                      <td className="p-2" colSpan={7}>
                        أدخل القيمة والمدة
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

const ShortfallPanel = () => {
  const { sims, project: p } = useDerived();
  const r = sims.base;
  const endIdx = r.endMonth != null ? Math.min(r.years.length - 1, Math.max(0, Math.ceil(r.endMonth / 12) - 1)) : null;
  const atEnd = endIdx != null ? r.years[endIdx] : null;
  const target = typeof p.vars.endowment_target === 'number' ? p.vars.endowment_target : null;
  return (
    <div className="space-y-5">
      <Callout tone="gold" title="المبدأ">
        إذا انتهت مدة الاشتراكات ولم يصل الصندوق إلى هدفه الاستثماري، فلا تُمدَّد الاشتراكات. تُسلك بالترتيب: تقليص النفقات، ثم تأجيل الاستثمار، ثم طلب مساهمات اختيارية جديدة بموافقة مستقلة لكل مساهم.
      </Callout>
      {atEnd ? (
        <Card>
          <h2 className="mb-3 text-lg">الوضع المقدر عند نهاية الاشتراكات (السيناريو الأساسي)</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="النقد" value={compactMoney(atEnd.endCash)} />
            <Stat label="قيمة الأصول" value={compactMoney(atEnd.assetsValue)} />
            <Stat label="الهدف الوقفي" value={target != null ? compactMoney(target) : '—'} sub={target != null ? `الفجوة: ${compactMoney(Math.max(0, target - atEnd.assetsValue))}` : 'غير محدد'} tone={target != null && atEnd.assetsValue < target ? 'warn' : undefined} />
            <Stat label="الفجوة التمويلية للاستدامة" value={r.fundingGap != null ? compactMoney(r.fundingGap) : '—'} sub="رأس المال الإضافي اللازم لتغطية النشاط من العوائد" />
          </div>
        </Card>
      ) : (
        <EmptyState>أدخل بيانات الاشتراكات لعرض الوضع عند نهاية الالتزام.</EmptyState>
      )}
      <ClauseList ids={['SUB-07']} allowAdd={false} title="بند معالجة عدم بلوغ الهدف" defaultOpenIds={['SUB-07']} />
    </div>
  );
};
