import { useState } from 'react';
import type { Branch, RightKey, RightLevel, Tier } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { RIGHT_LABELS } from '../data/structures';
import { uid } from '../lib/format';
import { Badge, Callout, Card, cx, SectionHead, Tabs, Term } from '../components/ui';
import { Check, TextInput, VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';

const LEVELS: { id: RightLevel; label: string; cls: string }[] = [
  { id: 'yes', label: 'نعم', cls: 'bg-ok-soft text-ok' },
  { id: 'conditional', label: 'بشرط', cls: 'bg-warn-soft text-warn' },
  { id: 'no', label: 'لا', cls: 'bg-bad-soft text-bad' },
  { id: 'undecided', label: 'لم يُحسم', cls: 'bg-ivory text-mute border border-line' },
];
const RIGHT_KEYS = Object.keys(RIGHT_LABELS) as RightKey[];
const nextLevel = (l: RightLevel): RightLevel => LEVELS[(LEVELS.findIndex((x) => x.id === l) + 1) % LEVELS.length].id;

const Diagram = ({ tiers }: { tiers: Tier[] }) => (
  <div className="space-y-2" aria-label="تصور بصري لفئات العضوية">
    <div className="mx-auto max-w-2xl space-y-1.5">
      {tiers.map((t, i) => {
        const yes = RIGHT_KEYS.filter((k) => t.rights[k] === 'yes').length;
        const cond = RIGHT_KEYS.filter((k) => t.rights[k] === 'conditional').length;
        return (
          <div key={t.id} className="flex items-center gap-3" style={{ paddingInline: `${Math.min(i, 5) * 1.2}rem` }}>
            <div className="w-40 shrink-0 text-sm font-semibold text-brand-900">{t.name}</div>
            <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-brand-50" role="img" aria-label={`${yes} حقوق مكتملة و${cond} مشروطة من ${RIGHT_KEYS.length}`}>
              <div className="bg-brand-700" style={{ width: `${(yes / RIGHT_KEYS.length) * 100}%` }} />
              <div className="bg-gold" style={{ width: `${(cond / RIGHT_KEYS.length) * 100}%` }} />
            </div>
            <div className="ltr w-10 shrink-0 text-xs text-mute">
              {yes}+{cond}
            </div>
          </div>
        );
      })}
    </div>
    <p className="text-center text-xs text-mute">
      <span className="me-3 inline-flex items-center gap-1"><i className="inline-block size-3 rounded-full bg-brand-700" /> حق كامل</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block size-3 rounded-full bg-gold" /> حق بشرط</span>
    </p>
  </div>
);

export default function Membership() {
  const { project: p } = useDerived();
  const update = useStore((s) => s.update);
  const [tab, setTab] = useState<'decisions' | 'tiers' | 'branches'>('decisions');
  const confirmed = !!p.confirmations.tiers;

  return (
    <div className="space-y-6">
      <SectionHead
        num="03 / نطاق الذرية والعضوية"
        title="نطاق الذرية والعضوية"
        sub="أهم وحدات الميثاق دقةً: من يدخل في الصندوق؟ وما حقوق كل فئة؟ مع مراعاة تعريف «العائلة» في القواعد النظامية."
      />

      <Card>
        <h2 className="mb-3 text-lg">مبادئ مقترحة تحكم هذه الوحدة</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['المساواة', 'تتمتع الذكور والإناث من الذرية بحقوق متساوية في الانتفاع والترشيح والمشاركة وفق نطاق العضوية وشروط الاستحقاق المعتمدة.'],
            ['عدم الإقصاء', 'عدم الاشتراك أو التأخر في السداد لا يلغي صفة الانتساب العائلي ولا يعني الحرمان المطلق من المساندة.'],
            ['التكافل', 'تُراعى الحالات الإنسانية وحالات الإعسار ضمن آلية مستقلة عن مكافأة انتظام الاشتراك.'],
            ['عدم الوراثة الإدارية', 'لا تنتقل عضوية مجلس الأمناء أو المناصب الإدارية بالوراثة.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-ivory/60 p-3">
              <b className="text-sm text-brand-900">{t}</b>
              <p className="text-xs leading-relaxed text-mute">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Callout tone="info" title="تعريف «العائلة» في القواعد المطّلع عليها">
            تُعرِّف القواعد التنظيمية للصناديق العائلية <Term k="family">العائلة</Term> بأنها «أفراد ينتسبون بالاسم إلى الشخص الذي باسمه الصندوق»، وتجيز لمجلس الأمناء منح الخدمات للأقارب المسمّين في اللائحة الأساسية. فموقع أبناء البنات يحتاج استيضاحًا نظاميًا قبل اعتماد النطاق.
          </Callout>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <VarField k="adult_age" />
          <VarField k="generations_limit" />
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'decisions', label: 'قرارات النطاق والعضوية' },
          { id: 'tiers', label: 'فئات العضوية والحقوق' },
          { id: 'branches', label: 'الفروع العائلية' },
        ]}
      />

      {tab === 'decisions' && <ClauseList categories={['membership']} title="أسئلة وقرارات العضوية" />}

      {tab === 'tiers' && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 text-lg">تصور بصري لفئات العضوية وحقوقها</h2>
            <Diagram tiers={p.tiers} />
          </Card>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">جدول الحقوق (اضغط على الخلية لتغيير القيمة)</h2>
              <div className="flex items-center gap-2">
                {confirmed ? <Badge tone="ok">مؤكد</Badge> : <Badge tone="warn">اقتراح غير مؤكد</Badge>}
                <Check checked={confirmed} onChange={(v) => update((d) => void (d.confirmations.tiers = v))} label="أؤكد هذا الجدول" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="text-xs text-mute">
                    <th className="p-1 text-start">الفئة</th>
                    {RIGHT_KEYS.map((k) => (
                      <th key={k} className="p-1 text-center">{RIGHT_LABELS[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.tiers.map((t, ti) => (
                    <tr key={t.id} className="bg-paper">
                      <td className="rounded-s-lg border border-e-0 border-line p-2">
                        <TextInput value={t.name} ariaLabel="اسم الفئة" onChange={(v) => update((d) => void (d.tiers[ti].name = v), `tn:${t.id}`)} />
                      </td>
                      {RIGHT_KEYS.map((k, ki) => {
                        const lv = LEVELS.find((x) => x.id === t.rights[k])!;
                        return (
                          <td key={k} className={cx('border-y border-line p-1 text-center', ki === RIGHT_KEYS.length - 1 && 'rounded-e-lg border-e')}>
                            <button
                              className={cx('badge w-full justify-center py-1', lv.cls)}
                              onClick={() => update((d) => void (d.tiers[ti].rights[k] = nextLevel(t.rights[k])))}
                              aria-label={`${t.name}: ${RIGHT_LABELS[k]} = ${lv.label}`}
                            >
                              {lv.label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint mt-2">هذه الأحكام اقتراح مبدئي قابل للتعديل ولا تعد معتمدة قبل تأكيدك. وتنبّه المنصة إلى أي تعارض بين هذا الجدول وبنود القروض والمساعدات.</p>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg">وصف الفئات</h2>
            <EditableTable<Tier>
              rows={p.tiers}
              cols={[
                { key: 'name', label: 'الفئة', w: 1 },
                { key: 'description', label: 'الوصف', type: 'textarea', w: 2 },
                { key: 'note', label: 'ملاحظة', type: 'textarea', w: 2 },
              ]}
              onChange={(rows) => update((d) => void (d.tiers = rows))}
              onAdd={() =>
                update((d) => {
                  d.tiers.push({ id: uid('tier'), name: 'فئة جديدة', description: '', note: '', rights: { aid: 'undecided', loan: 'undecided', priority: 'undecided', vote: 'undecided', candidacy: 'undecided', reports: 'undecided' } });
                })
              }
              addLabel="إضافة فئة"
            />
          </Card>
        </div>
      )}

      {tab === 'branches' && (
        <Card>
          <h2 className="mb-1 text-lg">الفروع العائلية</h2>
          <p className="mb-3 text-sm text-mute">سجّل الفروع إن رغبت بتمثيلها في المجلس أو في التصويت، ليتحقق الفحص من عدم الاحتكار.</p>
          <EditableTable<Branch>
            rows={p.branches}
            cols={[
              { key: 'name', label: 'اسم الفرع', w: 1 },
              { key: 'note', label: 'ملاحظات', w: 2 },
            ]}
            onChange={(rows) => update((d) => void (d.branches = rows))}
            onAdd={() => update((d) => void d.branches.push({ id: uid('br'), name: '', note: '' }))}
            addLabel="إضافة فرع"
            empty="لم تُسجل فروع بعد. يمكن ترك القائمة فارغة إن لم يُعتمد تمثيل بحسب الفروع."
          />
          <p className="hint mt-3">الأسماء هنا محفوظة محليًا على جهازك فقط.</p>
        </Card>
      )}
    </div>
  );
}
