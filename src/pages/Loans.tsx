import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LoanEntry, LoanFactor, LoanTrack } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { loanStats, repaymentSchedule, sensitivity } from '../engine/loans';
import { sumShare, sumWeight } from '../engine/progress';
import { numVar } from '../engine/subscriptions';
import { compactMoney, money, num, uid } from '../lib/format';
import { Badge, Callout, Card, cx, SectionHead, Stat, Tabs, Term } from '../components/ui';
import { Check, Field, NumInput, SumMeter, TextArea, TextInput, VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';

type Tab = 'purposes' | 'scoring' | 'tracks' | 'rules' | 'sim';

export default function Loans() {
  const [tab, setTab] = useState<Tab>('purposes');
  return (
    <div className="space-y-6">
      <SectionHead
        num="06 / القروض الحسنة"
        title="القروض الحسنة"
        sub="سياسة الإقراض: الأغراض والسقوف والمفاضلة بنقاط معلنة ومسارات عادلة ومحاكاة لأثرها على السيولة."
      />
      <Callout tone="warn" title="تحقق نظامي مطلوب قبل التقديم">
        لم يرد في النصين المطّلع عليهما (القواعد التنظيمية والدليل الاسترشادي) نص صريح يعالج الإقراض الحسن للأعضاء، وهما يحظران أي نشاط يخالف الأغراض المحددة في اللائحة. لا تُقدِّم الإقراض نشاطًا مسموحًا قبل استيضاح الجهة المختصة (انظر بند «مشروعية الإقراض»).
      </Callout>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'purposes', label: 'الأغراض والحدود' },
          { id: 'scoring', label: 'المفاضلة بالنقاط' },
          { id: 'tracks', label: 'المسارات الثلاثة' },
          { id: 'rules', label: 'الأحكام والبنود' },
          { id: 'sim', label: 'المحاكاة' },
        ]}
      />
      {tab === 'purposes' && <Purposes />}
      {tab === 'scoring' && <Scoring />}
      {tab === 'tracks' && <Tracks />}
      {tab === 'rules' && <ClauseList categories={['loans']} title="بنود القروض" />}
      {tab === 'sim' && <LoanSim />}
    </div>
  );
}

const Purposes = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-3">
      {p.loanPurposes.map((x, i) => {
        const set = (fn: (d: typeof x) => void, key: string): void => update((d) => fn(d.loanPurposes[i]), `lp:${x.id}:${key}`);
        return (
          <Card key={x.id}>
            <div className="mb-3 flex items-center gap-2">
              <TextInput value={x.name} ariaLabel="الغرض" onChange={(v) => set((d) => void (d.name = v), 'n')} className="font-bold" />
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف الغرض" onClick={() => update((d) => void (d.loanPurposes = d.loanPurposes.filter((y) => y.id !== x.id)))}>
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="الحد الأعلى للمبلغ (ريال)">
                <NumInput value={x.maxAmount} min={0} onChange={(v) => set((d) => void (d.maxAmount = v), 'm')} />
              </Field>
              <Field label="مدة السداد (شهر)">
                <NumInput value={x.termMonths} min={1} onChange={(v) => set((d) => void (d.termMonths = v), 't')} />
              </Field>
              <Field label="درجة الأولوية (1 الأعلى، 5 الأدنى)">
                <NumInput value={x.priority} min={1} max={5} onChange={(v) => set((d) => void (d.priority = v ?? 3), 'p')} />
              </Field>
              <Field label="الحد الأعلى للتكرار">
                <TextInput value={x.maxRepeat} placeholder="مثال: مرة كل ثلاث سنوات" onChange={(v) => set((d) => void (d.maxRepeat = v), 'r')} />
              </Field>
              <Field label="المستندات المطلوبة" className="sm:col-span-2">
                <TextArea rows={2} value={x.docs} onChange={(v) => set((d) => void (d.docs = v), 'd')} />
              </Field>
              <Field label="الضمانات المقبولة (إن تقررت)">
                <TextInput value={x.collateral} onChange={(v) => set((d) => void (d.collateral = v), 'c')} />
              </Field>
              <Field label="شروط الاستثناء">
                <TextInput value={x.exceptions} onChange={(v) => set((d) => void (d.exceptions = v), 'e')} />
              </Field>
              <Field label="إجراءات التعثر وإعادة الجدولة" className="sm:col-span-2 lg:col-span-4">
                <TextArea rows={2} value={x.rescheduling} onChange={(v) => set((d) => void (d.rescheduling = v), 's')} />
              </Field>
            </div>
          </Card>
        );
      })}
      <button
        className="btn btn-soft btn-sm"
        onClick={() =>
          update((d) => {
            d.loanPurposes.push({ id: uid('lp'), name: 'غرض جديد', maxAmount: null, termMonths: null, docs: '', priority: 3, maxRepeat: '', collateral: '', exceptions: '', rescheduling: '' });
          })
        }
      >
        <Plus className="size-4" /> إضافة غرض
      </button>
    </div>
  );
};

const Scoring = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const total = sumWeight(p.loanFactors);
  const normalize = (): void =>
    update((d) => {
      const t = sumWeight(d.loanFactors);
      if (t <= 0) return;
      d.loanFactors.forEach((f) => void (f.weight = Math.round((f.weight / t) * 1000) / 10));
      const diff = Math.round((100 - sumWeight(d.loanFactors)) * 10) / 10;
      d.loanFactors[d.loanFactors.length - 1].weight = Math.round((d.loanFactors[d.loanFactors.length - 1].weight + diff) * 10) / 10;
    });
  const scored = useMemo(
    () =>
      p.applicants
        .map((a) => ({ a, score: p.loanFactors.reduce((s, f) => s + (f.weight * (a.scores[f.id] ?? 0)) / 10, 0) }))
        .sort((x, y) => y.score - x.score),
    [p.applicants, p.loanFactors],
  );
  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">عوامل المفاضلة وأوزانها</h2>
          <div className="flex items-center gap-3">
            {p.confirmations.loan_weights ? <Badge tone="ok">مؤكد</Badge> : <Badge tone="warn">اقتراح غير مؤكد</Badge>}
            <Check checked={!!p.confirmations.loan_weights} onChange={(v) => update((d) => void (d.confirmations.loan_weights = v))} label="أؤكد الأوزان" />
          </div>
        </div>
        <p className="mb-3 text-sm text-mute">الأوزان قابلة للتعديل ويجب أن يساوي مجموعها 100%. الأصل: الملتزم له أولوية عند تساوي الحاجة، ولا يحتكر القروض.</p>
        <EditableTable<LoanFactor>
          rows={p.loanFactors}
          cols={[
            { key: 'label', label: 'العامل', w: 2 },
            { key: 'weight', label: 'الوزن %', type: 'number', min: 0, max: 100, w: 1 },
          ]}
          onChange={(rows) => update((d) => void (d.loanFactors = rows))}
          onAdd={() => update((d) => void d.loanFactors.push({ id: uid('lf'), label: 'عامل جديد', weight: 0 }))}
          addLabel="إضافة عامل"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="min-w-60 flex-1">
            <SumMeter total={total} label="مجموع الأوزان" />
          </div>
          <button className="btn btn-soft btn-sm" onClick={normalize} disabled={Math.abs(total - 100) < 0.01 || total <= 0}>
            تسوية الأوزان تلقائيًا إلى 100%
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg">حاسبة المفاضلة التوضيحية</h2>
        <p className="mb-3 text-sm text-mute">أدخل درجة من 0 إلى 10 لكل عامل لمتقدمين افتراضيين لترى كيف تُرتَّب الطلبات. الأسماء هنا اختيارية ومحفوظة محليًا فقط.</p>
        {p.loanFactors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th className="p-1 text-start">المتقدم</th>
                  {p.loanFactors.map((f) => (
                    <th key={f.id} className="p-1 text-start">{f.label}</th>
                  ))}
                  <th className="p-1 text-start">النتيجة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.applicants.map((a, ai) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="p-1">
                      <TextInput value={a.name} ariaLabel="اسم المتقدم" onChange={(v) => update((d) => void (d.applicants[ai].name = v), `ap:${a.id}`)} />
                    </td>
                    {p.loanFactors.map((f) => (
                      <td key={f.id} className="p-1">
                        <NumInput
                          value={a.scores[f.id] ?? 0}
                          min={0}
                          max={10}
                          ariaLabel={f.label}
                          onChange={(v) => update((d) => void (d.applicants[ai].scores[f.id] = v ?? 0), `aps:${a.id}${f.id}`)}
                        />
                      </td>
                    ))}
                    <td className="p-1 font-bold">
                      <span className="ltr">{num(scored.find((s) => s.a.id === a.id)?.score ?? 0, 1)}</span>
                      <span className="ms-1 text-xs text-mute">(الترتيب {scored.findIndex((s) => s.a.id === a.id) + 1})</span>
                    </td>
                    <td className="p-1">
                      <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => update((d) => void (d.applicants = d.applicants.filter((x) => x.id !== a.id)))}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          className="btn btn-soft btn-sm mt-3"
          onClick={() => update((d) => void d.applicants.push({ id: uid('ap'), name: `متقدم ${d.applicants.length + 1}`, scores: {} }))}
        >
          <Plus className="size-4" /> إضافة متقدم افتراضي
        </button>
      </Card>
    </div>
  );
};

const Tracks = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const budget = (numVar(p, 'loan_requests_per_year') ?? 0) * (numVar(p, 'loan_avg_amount') ?? 0);
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-lg">مسارات القروض وتوزيع المخصصات</h2>
        <p className="mb-3 text-sm text-mute">ثلاثة مسارات محتملة: القروض العادية، والقروض الإنسانية ذات الأولوية، والاستثناءات المبررة. يمكن تعديل الأسماء والنسب.</p>
        <EditableTable<LoanTrack>
          rows={p.loanTracks}
          cols={[
            { key: 'name', label: 'المسار', w: 1.3 },
            { key: 'share', label: 'النسبة %', type: 'number', min: 0, max: 100, w: 0.7 },
            { key: 'description', label: 'الوصف', type: 'textarea', w: 2 },
            { key: 'id', label: 'المبلغ السنوي المخصص', w: 1, render: (t) => <span className="text-sm">{budget > 0 ? money((budget * t.share) / 100) : '—'}</span> },
          ]}
          onChange={(rows) => update((d) => void (d.loanTracks = rows))}
          canRemove={() => p.loanTracks.length > 1}
          onAdd={() => update((d) => void d.loanTracks.push({ id: uid('lt'), name: 'مسار جديد', share: 0, description: '' }))}
          addLabel="إضافة مسار"
        />
        <div className="mt-3">
          <SumMeter total={sumShare(p.loanTracks)} label="مجموع نسب المسارات" />
        </div>
      </Card>
    </div>
  );
};

const LoanSim = () => {
  const { project: p, sims } = useDerived();
  const update = useStore((s) => s.update);
  const stats = useMemo(() => loanStats(p), [p]);
  const sens = useMemo(() => sensitivity(p, stats.poolEndYear1), [p, stats.poolEndYear1]);
  const base = sims.base;
  const [amount, setAmount] = useState<number | null>(12000);
  const [term, setTerm] = useState<number | null>(12);
  const sched = amount && term ? repaymentSchedule(amount, term) : [];
  const ceilings = [1, 1.25, 1.5, 2];
  const terms = [1, 1.5, 2];

  return (
    <div className="space-y-5">
      <Callout tone="info" title="تنبيه محاسبي">
        أصل القرض المسترد لا يمثل ربحًا جديدًا للصندوق. تفصل المحاكاة بين <Term k="commitments">التدفق النقدي</Term> والأرصدة المستحقة (القروض القائمة) والقيمة الإجمالية للأصول: الإقراض يحوّل النقد إلى مستحقات، والاسترداد يعيده، والتعثر وحده ينقص القيمة.
      </Callout>

      <Card>
        <h2 className="mb-3 text-lg">متغيرات <Term k="qard">القرض الحسن</Term></h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <VarField k="loan_requests_per_year" />
          <VarField k="loan_avg_amount" />
          <VarField k="loan_max_amount" />
          <VarField k="loan_term_months" />
          <VarField k="loan_pool_pct" />
          <div>
            <span className="label">معدل <Term k="default">التعثر</Term> المفترض (السيناريو الأساسي)</span>
            <div className="flex items-center gap-2">
              <NumInput value={p.scenarios.base.loanDefault} min={0} max={100} ariaLabel="معدل التعثر" onChange={(v) => update((d) => void (d.scenarios.base.loanDefault = v ?? 0))} />
              <span className="text-sm text-mute">%</span>
            </div>
            <p className="hint mt-1">يُعدَّل لكل سيناريو في قسم المحاكاة.</p>
          </div>
        </div>
        {numVar(p, 'loan_avg_amount') != null && numVar(p, 'loan_max_amount') != null && (numVar(p, 'loan_avg_amount') as number) > (numVar(p, 'loan_max_amount') as number) && (
          <div className="mt-3">
            <Callout tone="warn">متوسط القرض المتوقع يتجاوز الحد الأعلى للقرض الواحد؛ راجع القيمتين.</Callout>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="القروض الممكن تقديمها سنويًا (مستدامة)" value={stats.capacityPerYear != null ? num(stats.capacityPerYear, 1) : '—'} sub="تقدير حالة الاستقرار لحوض السيولة" />
        <Stat label="إجمالي القروض المصروفة (الأفق)" value={compactMoney(stats.disbursed)} sub={`المخطط ${compactMoney(stats.planned)}`} />
        <Stat label="الأقساط المستردة (أصل فقط)" value={compactMoney(stats.repaid)} sub="ليست ربحًا" />
        <Stat label="القروض القائمة آخر الأفق" value={compactMoney(stats.outstanding)} sub={`مشطوب بالتعثر: ${compactMoney(stats.writtenOff)}`} />
        <Stat label="السيولة المتاحة لإقراض مستفيدين جدد" value={stats.lendableNow != null ? compactMoney(stats.lendableNow) : '—'} sub="نهاية السنة الأولى" />
        <Stat label="طلب غير ملبّى" value={compactMoney(stats.unmet)} tone={stats.unmet > 1 ? 'warn' : undefined} sub="بسبب حد الرصيد أو الاحتياطي" />
      </div>

      <Card>
        <h2 className="mb-3 text-lg">القروض القائمة والمستردة سنويًا (السيناريو الأساسي)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="p-1.5 text-start">السنة</th>
                <th className="p-1.5 text-start">المصروف</th>
                <th className="p-1.5 text-start">المسترد (أصل)</th>
                <th className="p-1.5 text-start">القائم آخر السنة</th>
                <th className="p-1.5 text-start">المشطوب التراكمي</th>
                <th className="p-1.5 text-start">النقد آخر السنة</th>
              </tr>
            </thead>
            <tbody>
              {base.years.slice(0, 12).map((y) => (
                <tr key={y.index} className="border-t border-line">
                  <td className="p-1.5">{y.label}</td>
                  <td className="p-1.5">{compactMoney(y.loansDisbursed)}</td>
                  <td className="p-1.5">{compactMoney(y.loanRepayments)}</td>
                  <td className="p-1.5">{compactMoney(y.loansOutstanding)}</td>
                  <td className="p-1.5">{compactMoney(y.writtenOff)}</td>
                  <td className={cx('p-1.5', y.endCash < 0 && 'font-bold text-bad')}>{compactMoney(y.endCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg">أثر رفع السقف وإطالة مدة السداد</h2>
        <p className="mb-3 text-sm text-mute">عدد القروض السنوي المستدام لحوض السيولة نفسه عند رفع متوسط القرض (بنسبة رفع السقف) وإطالة مدة السداد.</p>
        {stats.poolEndYear1 == null || stats.capacityPerYear == null ? (
          <p className="text-sm text-mute">أدخل متوسط القرض ومدة السداد وحد الرصيد لتظهر المقارنة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th className="p-1.5 text-start">رفع السقف ↓ / المدة →</th>
                  {terms.map((t) => (
                    <th key={t} className="p-1.5 text-start">×{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ceilings.map((c) => (
                  <tr key={c} className="border-t border-line">
                    <th className="p-1.5 text-start">×{c}</th>
                    {terms.map((t) => {
                      const v = sens.find((x) => x.ceilingFactor === c && x.termFactor === t)?.loansPerYear;
                      return (
                        <td key={t} className={cx('p-1.5', c === 1 && t === 1 && 'bg-brand-50 font-bold')}>
                          {v != null ? num(v, 1) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg">جدول استرداد قرض بعينه</h2>
        <p className="mb-3 text-sm text-mute">أقساط متساوية من الأصل فقط دون زيادة. يمكنك إضافة القرض إلى المحاكاة لتراه يؤثر في النقد والقروض القائمة دون أن يظهر ربحًا.</p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="مبلغ القرض (ريال)" className="w-40">
            <NumInput value={amount} min={0} onChange={setAmount} />
          </Field>
          <Field label="مدة السداد (شهر)" className="w-32">
            <NumInput value={term} min={1} onChange={setTerm} />
          </Field>
          <button
            className="btn btn-soft"
            disabled={!amount || !term}
            onClick={() => update((d) => void d.loanLedger.push({ id: uid('ll'), label: 'قرض مخطط', amount, startYm: base.startYm, termMonths: term }))}
          >
            <Plus className="size-4" /> إضافة إلى المحاكاة (في أول شهر)
          </button>
        </div>
        {sched.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-brand-50 text-xs">
                <tr>
                  <th className="p-1.5 text-start">القسط</th>
                  <th className="p-1.5 text-start">من الأصل</th>
                  <th className="p-1.5 text-start">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {sched.map((r) => (
                  <tr key={r.n} className="border-t border-line">
                    <td className="p-1.5">{r.n}</td>
                    <td className="p-1.5">{money(r.principal)}</td>
                    <td className="p-1.5">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {p.loanLedger.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-base">القروض المحددة المضافة إلى المحاكاة</h3>
            <EditableTable<LoanEntry>
              rows={p.loanLedger}
              cols={[
                { key: 'label', label: 'الوصف', w: 1.4 },
                { key: 'amount', label: 'المبلغ', type: 'number', min: 0, w: 1 },
                { key: 'startYm', label: 'شهر الصرف', type: 'month', w: 1 },
                { key: 'termMonths', label: 'المدة (شهر)', type: 'number', min: 1, w: 0.8 },
              ]}
              onChange={(rows) => update((d) => void (d.loanLedger = rows))}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
