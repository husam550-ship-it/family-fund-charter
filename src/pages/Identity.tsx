import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { resolveText } from '../engine/context';
import { uid } from '../lib/format';
import { Badge, Callout, Card, Resolved, SectionHead } from '../components/ui';
import { TextArea, VarField } from '../components/fields';
import { ClauseList } from '../components/ClauseList';
import { cx } from '../components/ui';
import type { Identity } from '../types';

const NAMING: { id: Identity['namingMode']; label: string; text: string }[] = [
  { id: 'family', label: 'اسم عائلي', text: 'نعتمد اسمًا عائليًا (مع التحقق من شروط التسمية).' },
  { id: 'different', label: 'تسمية رسمية مختلفة مع الاحتفاظ بالهوية العائلية', text: 'نسجل الصندوق باسم رسمي مختلف، وتبقى الهوية العائلية في الميثاق.' },
  { id: 'general', label: 'اسم عام لعائلة أو عدة عوائل', text: 'نسلك مسار الاسم العام وفق شروطه.' },
  { id: 'undecided', label: 'لم نقرر بعد', text: '' },
];

export default function IdentityPage() {
  const { project: p, ctx } = useDerived();
  const update = useStore((s) => s.update);
  const mode = p.identity.namingMode;

  return (
    <div className="space-y-6">
      <SectionHead
        num="02 / الهوية والرؤية والأهداف"
        title="الهوية والرؤية والأهداف"
        sub="اقتراحات جاهزة لكل عنصر؛ اختر ما يناسب أو عدّل الصياغة أو أضف نصك. ثم اضغط «تأكيد الاختيار» ليدخل في الميثاق على أنه اختيار مؤكد. لا شيء هنا نص إلزامي."
      />

      <Card>
        <h2 className="mb-1 text-lg">اسم الصندوق: هل يصلح اسم «{resolveText('{{family_name}}', ctx)}» تسمية رسمية؟</h2>
        <p className="mb-3 text-sm text-mute">
          للتسمية الرسمية بأسماء الأشخاص شروط في القواعد التنظيمية للصناديق العائلية (اسم ثلاثي، وصاحب الاسم حيّ، وعدم التسمية باسم عائلة أو قبيلة). ويمكن استخدام تسمية رسمية مختلفة مع الاحتفاظ بالهوية العائلية في الميثاق.
        </p>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <VarField k="family_name" />
          <VarField k="fund_name" />
          <VarField k="fund_official_name" />
          <VarField k="namesake_status" />
        </div>
        <div role="radiogroup" aria-label="مسار التسمية" className="grid gap-2 sm:grid-cols-2">
          {NAMING.map((n) => (
            <button
              key={n.id}
              role="radio"
              aria-checked={mode === n.id}
              onClick={() => update((d) => void (d.identity.namingMode = n.id))}
              className={cx('rounded-xl border p-3 text-start', mode === n.id ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-300')}
            >
              <b className="text-sm text-brand-900">{n.label}</b>
              {n.text && <span className="block text-xs text-mute">{n.text}</span>}
            </button>
          ))}
        </div>
        {p.vars.namesake_status === 'deceased' && (
          <div className="mt-3">
            <Callout tone="warn">حالة صاحب الاسم «متوفى»: راجع مسألة التسمية مع المركز قبل اعتماد اسم عائلي، وانظر المرجعية النظامية.</Callout>
          </div>
        )}
      </Card>

      {p.identity.groups.map((g, gi) => {
        const set = (fn: (x: Identity['groups'][number]) => void, key?: string): void => update((d) => fn(d.identity.groups[gi]), key);
        return (
          <Card key={g.id}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">{g.label}</h2>
              <div className="flex items-center gap-2">
                {g.confirmed ? <Badge tone="ok">مؤكد</Badge> : <Badge tone="warn">لم يُؤكد</Badge>}
                <button className={cx('btn btn-sm', g.confirmed ? 'btn-soft' : 'btn-primary')} onClick={() => set((x) => void (x.confirmed = !x.confirmed))}>
                  <CheckCircle2 className="size-4" /> {g.confirmed ? 'إلغاء التأكيد' : 'تأكيد الاختيار'}
                </button>
              </div>
            </div>
            <p className="mb-3 text-sm text-mute">{g.hint}</p>
            <ul className="space-y-2">
              {g.options.map((o, oi) => {
                const sel = g.selected.includes(o.id);
                return (
                  <li key={o.id} className={cx('rounded-xl border p-3', sel ? 'border-brand-500 bg-brand-50/60' : 'border-line')}>
                    <div className="flex items-start gap-3">
                      <input
                        type={g.multi ? 'checkbox' : 'radio'}
                        name={`g-${g.id}`}
                        className="mt-1.5 size-4 accent-brand-700"
                        checked={sel}
                        aria-label={`اختيار الاقتراح ${oi + 1}`}
                        onChange={() =>
                          set((x) => {
                            x.selected = g.multi ? (sel ? x.selected.filter((i) => i !== o.id) : [...x.selected, o.id]) : [o.id];
                          })
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <TextArea
                          rows={g.multi ? 2 : 3}
                          ariaLabel="نص الاقتراح"
                          value={o.text}
                          onChange={(v) => set((x) => void (x.options[oi].text = v), `id:${o.id}`)}
                        />
                        <p className="text-xs text-mute">
                          <span className="font-semibold">كما سيظهر: </span>
                          <Resolved text={resolveText(o.text, ctx)} />
                        </p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm text-bad"
                        aria-label="حذف الاقتراح"
                        disabled={g.options.length <= 1}
                        onClick={() =>
                          set((x) => {
                            x.options = x.options.filter((y) => y.id !== o.id);
                            x.selected = x.selected.filter((i) => i !== o.id);
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              className="btn btn-soft btn-sm mt-3"
              onClick={() =>
                set((x) => {
                  const id = uid(g.id);
                  x.options.push({ id, text: 'اكتب اقتراحك هنا.', custom: true });
                  if (x.multi) x.selected.push(id);
                })
              }
            >
              <Plus className="size-4" /> إضافة اقتراح خاص
            </button>
          </Card>
        );
      })}

      <ClauseList categories={['foundation']} ids={['FND-01', 'FND-02', 'FND-09', 'FND-15']} title="بنود التأسيس المرتبطة بالهوية" allowAdd={false} />
    </div>
  );
}
