import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { LegalClass, LegalRef } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { runReview } from '../engine/review';
import type { Check as CheckItem, CheckKind } from '../engine/review';
import { sectionCompletion } from '../engine/progress';
import { go, SECTIONS, sectionLabel } from '../lib/nav';
import { useUi } from '../lib/ui';
import { uid } from '../lib/format';
import { Badge, Callout, Card, cx, Disclosure, EmptyState, ProgressBar, Ring, SectionHead, Stat, Tabs } from '../components/ui';
import { Check, Field, SelectInput, TextArea, TextInput } from '../components/fields';

type Tab = 'scan' | 'complete' | 'legal' | 'specialist';

const KIND_META: Record<CheckKind, { label: string; tone: 'bad' | 'warn' | 'info' | 'gold' | 'plain' }> = {
  conflict: { label: 'تعارضات يجب حلها', tone: 'bad' },
  review: { label: 'عناصر تحتاج مراجعة', tone: 'warn' },
  open: { label: 'أسئلة مفتوحة وقرارات لم تُعتمد', tone: 'info' },
  financial: { label: 'مخاطر مالية', tone: 'warn' },
  legal: { label: 'بنود تحتاج مراجعة نظامية', tone: 'gold' },
};
const SEV_TONE = { high: 'bad', medium: 'warn', low: 'info' } as const;
const SEV_LABEL = { high: 'مرتفع', medium: 'متوسط', low: 'منخفض' } as const;

const CLS_META: Record<LegalClass, { label: string; tone: 'ok' | 'gold' | 'warn' }> = {
  verified: { label: 'متطلب نظامي متحقق منه', tone: 'ok' },
  governance: { label: 'اقتراح حوكمي', tone: 'gold' },
  review: { label: 'مسألة تحتاج مراجعة', tone: 'warn' },
};

export default function Review() {
  const { project: p, reqs, percent } = useDerived();
  const [tab, setTab] = useState<Tab>('scan');
  const review = useMemo(() => runReview(p), [p]);
  const total = review.checks.length;
  const specialistOpen = p.reviewItems.filter((r) => !r.done).length;

  return (
    <div className="space-y-6">
      <SectionHead
        num="16 / مراجعة الميثاق واكتشاف النواقص"
        title="مراجعة الميثاق واكتشاف النواقص"
        sub="فحص قبل إصدار الميثاق: بنود ناقصة، ومتغيرات فارغة، وتعارضات، وسيولة، ومتطلبات نظامية. ونسبة الاكتمال مبنية على متطلبات قابلة للفحص لا على عدد الحقول المعبأة."
      />
      <Callout tone="warn" title="لا يعني بلوغ 100% أن الميثاق معتمد نظاميًا">
        الاكتمال هنا معيار داخلي لتغطية الأسئلة الجوهرية. الاعتماد النظامي يتطلب موافقة أصحاب الصلاحية وإجراءات الترخيص ومراجعة قانونية وشرعية ومالية.
      </Callout>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'scan', label: 'نتائج الفحص', badge: total },
          { id: 'complete', label: 'متطلبات الاكتمال' },
          { id: 'legal', label: 'المرجعية النظامية' },
          { id: 'specialist', label: 'مراجعة مع مختص', badge: specialistOpen },
        ]}
      />

      {tab === 'scan' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card flex items-center gap-3 p-4">
              <Ring value={percent} size={60} />
              <div>
                <div className="text-xs font-semibold text-mute">عناصر مكتملة</div>
                <div className="font-bold">{reqs.filter((r) => r.done).length} من {reqs.length}</div>
              </div>
            </div>
            <Stat label="تعارضات يجب حلها" value={review.byKind.conflict.length} tone={review.byKind.conflict.length ? 'bad' : 'ok'} />
            <Stat label="عناصر تحتاج مراجعة" value={review.byKind.review.length} tone={review.byKind.review.length ? 'warn' : undefined} />
            <Stat label="أسئلة مفتوحة" value={review.byKind.open.length + reqs.filter((r) => !r.done).length} />
            <Stat label="مخاطر مالية" value={review.byKind.financial.length} tone={review.byKind.financial.length ? 'warn' : undefined} />
            <Stat label="بنود تحتاج مراجعة نظامية" value={review.byKind.legal.length} />
          </div>
          {(['conflict', 'review', 'financial', 'open', 'legal'] as CheckKind[]).map((k) => {
            const list = review.byKind[k];
            if (list.length === 0) return null;
            return (
              <Card key={k}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-lg">{KIND_META[k].label}</h2>
                  <Badge tone={KIND_META[k].tone}>{list.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {list.map((c) => (
                    <CheckRow key={c.id} c={c} />
                  ))}
                </ul>
              </Card>
            );
          })}
          {total === 0 && (
            <Callout tone="ok" title="لا يظهر للفحص شيء الآن">
              لا تعارضات ولا نواقص مرصودة بالإعدادات الحالية. وهذا لا يعني اكتمال المشروع: راجع «متطلبات الاكتمال».
            </Callout>
          )}
        </div>
      )}

      {tab === 'complete' && <Completeness />}
      {tab === 'legal' && <LegalBase />}
      {tab === 'specialist' && <Specialist />}
    </div>
  );
}

const CheckRow = ({ c }: { c: CheckItem }) => (
  <li className="flex flex-wrap items-start gap-2 rounded-lg border border-line bg-paper p-3 text-sm">
    <Badge tone={SEV_TONE[c.severity]}>{SEV_LABEL[c.severity]}</Badge>
    <div className="min-w-0 flex-1">
      <b>{c.title}</b>
      <p className="text-mute">{c.detail}</p>
    </div>
    <div className="flex flex-wrap gap-1">
      {c.clauseIds.slice(0, 2).map((id) => (
        <button
          key={id}
          className="btn btn-soft btn-sm"
          onClick={() => {
            useUi.setState({ focusClause: id });
            go('library');
          }}
        >
          <span className="ltr">{id}</span>
        </button>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => go(c.section)}>
        {sectionLabel(c.section)}
      </button>
    </div>
  </li>
);

const Completeness = () => {
  const { reqs, percent } = useDerived();
  const secs = sectionCompletion(reqs);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Ring value={percent} size={80} />
          <div>
            <h2 className="text-lg">نسبة الاكتمال: {percent}%</h2>
            <p className="text-sm text-mute">
              {reqs.filter((r) => r.done).length} من {reqs.length} متطلبًا. يُحتسب المتطلب مكتملًا عندما تُعتمد بنوده المرتبطة، وتُدخل متغيراته، ويُستوفى شرطه. مجرد كتابة نص لا يكفي.
            </p>
          </div>
        </div>
      </Card>
      {SECTIONS.filter((s) => secs[s.id]).map((s) => {
        const items = reqs.filter((r) => r.req.section === s.id);
        const c = secs[s.id]!;
        return (
          <Disclosure key={s.id} title={`${s.label} — ${c.done}/${c.total}`} right={<div className="w-24"><ProgressBar value={(c.done / c.total) * 100} /></div>}>
            <ul className="space-y-2">
              {items.map((r) => (
                <li key={r.req.id} className="flex items-start gap-2 text-sm">
                  {r.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-gold" />}
                  <div className="flex-1">
                    <div className={cx(r.done && 'text-mute line-through')}>{r.req.question}</div>
                    {!r.done && (
                      <ul className="list-disc ps-5 text-xs text-mute">
                        {r.missing.slice(0, 4).map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => go(r.req.section)}>فتح</button>
                </li>
              ))}
            </ul>
          </Disclosure>
        );
      })}
    </div>
  );
};

const LegalBase = () => {
  const refs = useStore((s) => s.project.legalRefs);
  const update = useStore((s) => s.update);
  const groups: LegalClass[] = ['verified', 'review', 'governance'];
  return (
    <div className="space-y-5">
      <Callout tone="info" title="كيف تُقرأ هذه القاعدة؟">
        <ul className="list-disc ps-5">
          <li><b>متطلب نظامي متحقق منه</b>: نص قُرئ فعلًا في الوثيقة المصدرية بتاريخ الاطلاع المبيّن، ولا تُنسب إليه أرقام مواد إلا ما ورد في النص.</li>
          <li><b>اقتراح حوكمي</b>: ممارسة نقترحها وليست متطلبًا نظاميًا.</li>
          <li><b>مسألة تحتاج مراجعة</b>: لم يُتحقق من حكمها؛ لا تُجزم بها وتُعرض على مختص أو الجهة المختصة.</li>
        </ul>
        الأنظمة تتغير؛ فارجع دائمًا إلى النسخة المنشورة على موقعي المركز الوطني لتنمية القطاع غير الربحي والهيئة العامة للأوقاف.
      </Callout>
      {groups.map((g) => {
        const list = refs.filter((r) => r.cls === g);
        if (list.length === 0) return null;
        return (
          <div key={g} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg">
              <Badge tone={CLS_META[g].tone}>{CLS_META[g].label}</Badge>
              <span className="text-sm text-mute">({list.length})</span>
            </h2>
            {list.map((r) => {
              const i = refs.findIndex((x) => x.id === r.id);
              const set = (fn: (d: LegalRef) => void, k: string): void => update((d) => fn(d.legalRefs[i]), `lg:${r.id}:${k}`);
              return (
                <Card key={r.id}>
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-base">{r.topic}</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-52">
                        <SelectInput
                          ariaLabel="التصنيف"
                          value={r.cls}
                          options={(Object.keys(CLS_META) as LegalClass[]).map((k) => ({ value: k, label: CLS_META[k].label }))}
                          onChange={(v) => set((d) => void (d.cls = v as LegalClass), 'c')}
                        />
                      </div>
                      {!r.builtin && (
                        <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => update((d) => void (d.legalRefs = d.legalRefs.filter((x) => x.id !== r.id)))}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.builtin ? (
                    <p className="text-sm leading-relaxed">{r.summary}</p>
                  ) : (
                    <TextArea rows={3} value={r.summary} ariaLabel="الملخص" onChange={(v) => set((d) => void (d.summary = v), 's')} />
                  )}
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1">
                      <div><b className="text-mute">المصدر: </b>{r.source}</div>
                      {r.url && (
                        <a className="inline-flex items-center gap-1 text-info underline" href={r.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" /> فتح المصدر
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-mute">تاريخ الاطلاع:</span>
                      <div className="w-40">
                        <TextInput type="date" value={r.accessed} onChange={(v) => set((d) => void (d.accessed = v), 'a')} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <TextArea rows={2} value={r.note} ariaLabel="ملاحظاتك" placeholder="ملاحظاتك بعد التحقق من الجهة المختصة أو المختص…" onChange={(v) => set((d) => void (d.note = v), 'n')} />
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })}
      <button
        className="btn btn-soft"
        onClick={() =>
          update((d) => void d.legalRefs.push({ id: uid('lg'), topic: 'مرجع جديد', summary: '', cls: 'review', source: '', url: '', accessed: new Date().toISOString().slice(0, 10), builtin: false, note: '' }))
        }
      >
        <Plus className="size-4" /> إضافة مرجع
      </button>
    </div>
  );
};

const Specialist = () => {
  const items = useStore((s) => s.project.reviewItems);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-4">
      <Callout tone="warn" title="قبل التأسيس الرسمي">
        الموقع أداة لإعداد مشروع الميثاق واتخاذ القرارات، وليس بديلًا عن الترخيص والمراجعة القانونية والشرعية والمالية. هذه قائمة بما ينبغي مراجعته مع مختص أو الجهة المختصة.
      </Callout>
      <Card>
        <ul className="space-y-3">
          {items.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-line bg-paper p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  {r.builtin ? (
                    <Check checked={r.done} onChange={(v) => update((d) => void (d.reviewItems[i].done = v))} label={r.text} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check checked={r.done} onChange={(v) => update((d) => void (d.reviewItems[i].done = v))} label="" />
                      <TextInput value={r.text} ariaLabel="البند" onChange={(v) => update((d) => void (d.reviewItems[i].text = v), `rv:${r.id}`)} />
                    </div>
                  )}
                </div>
                {!r.builtin && (
                  <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => update((d) => void (d.reviewItems = d.reviewItems.filter((x) => x.id !== r.id)))}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <Field label="" className="mt-2">
                <TextArea rows={1} value={r.note} ariaLabel="ملاحظة" placeholder="ملاحظة أو نتيجة المراجعة" onChange={(v) => update((d) => void (d.reviewItems[i].note = v), `rvn:${r.id}`)} />
              </Field>
            </li>
          ))}
        </ul>
        <button className="btn btn-soft btn-sm mt-3" onClick={() => update((d) => void d.reviewItems.push({ id: uid('rv'), text: 'بند مراجعة جديد', done: false, note: '', builtin: false }))}>
          <Plus className="size-4" /> إضافة بند مراجعة
        </button>
      </Card>
      <EmptyState>إكمال القائمة لا يعني الاعتماد النظامي؛ فهو سجل لما رُوجع.</EmptyState>
    </div>
  );
};
