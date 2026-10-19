import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ApprovalLimit, CriterionMode } from '../types';
import { useStore } from '../lib/store';
import { uid } from '../lib/format';
import { Badge, Callout, Card, cx, SectionHead, Tabs, Term } from '../components/ui';
import { Check, Field, TextArea, TextInput, VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';
import { ClauseCard } from '../components/ClauseCard';
import { APPROVAL_LIMIT_EXAMPLES } from '../data/structures';

type Tab = 'setup' | 'models' | 'criteria' | 'powers' | 'committees';

const MODES: { id: CriterionMode; label: string }[] = [
  { id: 'undecided', label: 'لم يُحسم' },
  { id: 'required', label: 'شرط أساسي' },
  { id: 'preferred', label: 'مفضّل' },
  { id: 'none', label: 'غير مطلوب' },
];

export default function Board() {
  const [tab, setTab] = useState<Tab>('setup');
  const p = useStore((s) => s.project);
  return (
    <div className="space-y-6">
      <SectionHead
        num="08 / مجلس الأمناء والحوكمة"
        title="مجلس الأمناء والحوكمة"
        sub="ابنِ النظام الإداري واختر البدائل: التكوين، وطريقة الاختيار، والشروط، والصلاحيات والنصاب، واللجان."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'setup', label: 'تكوين المجلس' },
          { id: 'models', label: 'نماذج الاختيار' },
          { id: 'criteria', label: 'شروط العضوية', badge: p.criteria.filter((c) => c.mode === 'undecided').length },
          { id: 'powers', label: 'الصلاحيات والنصاب' },
          { id: 'committees', label: 'اللجان' },
        ]}
      />

      {tab === 'setup' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg">متغيرات التكوين</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <VarField k="board_members_count" />
              <VarField k="board_term_years" />
              <VarField k="board_max_terms" />
              <VarField k="board_meetings_per_year" />
              <VarField k="candidate_min_age" />
            </div>
            <p className="hint mt-3">الحد الأدنى النظامي المطّلع عليه: ثلاثة أعضاء، ولا تقل الاجتماعات عن اجتماعين في السنة. وتُنبّه المنصة إن نزلت قيمك عن ذلك.</p>
          </Card>
          <ClauseList
            ids={['BRD-11', 'BRD-12', 'BRD-14', 'BRD-16', 'BRD-07', 'BRD-17', 'BRD-20', 'BRD-21', 'BRD-03', 'BRD-02']}
            title="بنود التكوين والدورة والشغور والانتقال"
            allowAdd={false}
          />
        </div>
      )}

      {tab === 'models' && (
        <div className="space-y-5">
          <Callout tone="info" title="الفرق بين التصويت الاستشاري والاختيار النظامي الملزم">
            <p>
              تصويت أفراد العائلة <b>استشاري</b> ما لم تحوّله اللائحة الأساسية إلى اختيار ملزم. والقواعد التنظيمية المطّلع عليها تنص على أن يعيّن أعضاء <Term k="board">مجلس الأمناء</Term> المؤسس أو المؤسسون أو من يُعهد إليه بذلك حسب اللائحة، مع موافقة المركز. فالنموذج الأول (الانتخاب) يحتاج تحققًا من جواز التفويض قبل اعتماده.
            </p>
          </Callout>
          <ClauseCard id="BRD-10" defaultOpen />
          <ClauseList ids={['MEM-12', 'MEM-14', 'MEM-13']} title="بنود مرتبطة: الهيئة العائلية والتمثيل" allowAdd={false} />
        </div>
      )}

      {tab === 'criteria' && <Criteria />}
      {tab === 'powers' && <Powers />}
      {tab === 'committees' && <Committees />}
    </div>
  );
}

const Criteria = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-lg">شروط عضوية المجلس</h2>
        <p className="mb-3 text-sm text-mute">حدد لكل شرط: أساسي، أم مفضّل، أم غير مطلوب. الشروط التي تبقى «لم يُحسم» تظهر في أسئلة الاجتماع.</p>
        <ul className="space-y-2">
          {p.criteria.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-2.5">
              <div className="min-w-48 flex-1">
                <TextInput value={c.label} ariaLabel="الشرط" onChange={(v) => update((d) => void (d.criteria[i].label = v), `cr:${c.id}`)} />
              </div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={c.label}>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={c.mode === m.id}
                    className={cx('btn btn-sm', c.mode === m.id ? 'btn-primary' : 'btn-soft')}
                    onClick={() => update((d) => void (d.criteria[i].mode = m.id))}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => update((d) => void (d.criteria = d.criteria.filter((x) => x.id !== c.id)))}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-soft btn-sm mt-3" onClick={() => update((d) => void d.criteria.push({ id: uid('cr'), label: 'شرط جديد', mode: 'undecided' }))}>
          <Plus className="size-4" /> إضافة شرط
        </button>
      </Card>
      <ClauseList ids={['BRD-13', 'BRD-04']} title="بنود الشروط وتعارض المصالح" allowAdd={false} />
    </div>
  );
};

const Powers = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-3 text-lg">النصاب ونسب التصويت</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <VarField k="board_quorum_pct" />
          <VarField k="majority_ordinary_pct" />
          <VarField k="majority_critical_pct" />
        </div>
        <p className="hint mt-2">في الدليل الاسترشادي المطّلع عليه: القرارات بالأغلبية البسيطة وترجيح جانب الرئيس عند التساوي. حدّد القيم التي تناسبكم ثم تحقق منها نظاميًا.</p>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">حدود الصرف المالي لكل مستوى</h2>
          <div className="flex flex-wrap gap-1.5">
            {APPROVAL_LIMIT_EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                className="btn btn-gold btn-sm"
                onClick={() =>
                  update((d) => {
                    d.approvalLimits.forEach((l, i) => void (l.limit = ex.limits[i] ?? null));
                  })
                }
              >
                {ex.name.split(':')[0]}
              </button>
            ))}
          </div>
        </div>
        <Callout tone="gold">الأرقام في الأمثلة افتراضية قابلة للتعديل وليست أحكامًا نظامية ثابتة. اختر مثالًا ثم عدّل ما يلزم. وآخر مستوى يُترك بلا حد (ما فوق الحد السابق).</Callout>
        <div className="mt-3">
          <EditableTable<ApprovalLimit>
            rows={p.approvalLimits}
            cols={[
              { key: 'level', label: 'المستوى الإداري', w: 1.5 },
              { key: 'limit', label: 'سقف الصرف (ريال)', type: 'number', min: 0, w: 1 },
              { key: 'approver', label: 'جهة الاعتماد عند التجاوز', w: 1.5 },
              { key: 'note', label: 'ملاحظة', w: 1.2 },
            ]}
            onChange={(rows) => update((d) => void (d.approvalLimits = rows))}
            onAdd={() => update((d) => void d.approvalLimits.push({ id: uid('al'), level: 'مستوى جديد', limit: null, approver: '', note: '' }))}
            addLabel="إضافة مستوى"
            canMove
          />
        </div>
      </Card>
      <ClauseList ids={['BRD-01', 'BRD-08', 'BRD-09', 'BRD-15', 'BRD-18', 'BRD-05', 'BRD-06']} title="بنود الاختصاصات والصلاحيات والقرارات" allowAdd={false} />
      <ClauseList ids={['CON-08', 'CON-05', 'CON-09']} title="تعديل الميثاق وحل المجلس وإعادة تشكيله" allowAdd={false} />
    </div>
  );
};

const Committees = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const confirmed = !!p.confirmations.committees;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">لكل لجنة: الاختصاصات والعضوية والمدة والصلاحيات وحدود التفويض والتقارير وحالات التنحي. القيم الابتدائية اقتراحات قابلة للتعديل.</p>
        <div className="flex items-center gap-2">
          {confirmed ? <Badge tone="ok">مؤكدة</Badge> : <Badge tone="warn">اقتراح غير مؤكد</Badge>}
          <Check checked={confirmed} onChange={(v) => update((d) => void (d.confirmations.committees = v))} label="أؤكد اللجان" />
        </div>
      </div>
      {p.committees.map((c, i) => {
        const set = (fn: (d: typeof c) => void, k: string): void => update((d) => fn(d.committees[i]), `cm:${c.id}:${k}`);
        return (
          <Card key={c.id}>
            <div className="mb-3 flex items-center gap-2">
              <TextInput value={c.name} ariaLabel="اسم اللجنة" className="font-bold" onChange={(v) => set((d) => void (d.name = v), 'n')} />
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف اللجنة" onClick={() => update((d) => void (d.committees = d.committees.filter((x) => x.id !== c.id)))}>
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الاختصاصات">
                <TextArea rows={3} value={c.duties} onChange={(v) => set((d) => void (d.duties = v), 'd')} />
              </Field>
              <Field label="العضوية">
                <TextArea rows={3} value={c.members} onChange={(v) => set((d) => void (d.members = v), 'm')} />
              </Field>
              <Field label="الصلاحيات">
                <TextArea rows={2} value={c.powers} onChange={(v) => set((d) => void (d.powers = v), 'p')} />
              </Field>
              <Field label="حدود التفويض">
                <TextArea rows={2} value={c.delegation} onChange={(v) => set((d) => void (d.delegation = v), 'g')} />
              </Field>
              <Field label="مدة التكليف">
                <TextInput value={c.term} onChange={(v) => set((d) => void (d.term = v), 't')} />
              </Field>
              <Field label="إجراءات التقارير">
                <TextInput value={c.reporting} onChange={(v) => set((d) => void (d.reporting = v), 'r')} />
              </Field>
              <Field label="حالات التنحي عند تعارض المصالح" className="sm:col-span-2">
                <TextArea rows={2} value={c.recusal} onChange={(v) => set((d) => void (d.recusal = v), 'x')} />
              </Field>
            </div>
          </Card>
        );
      })}
      <button
        className="btn btn-soft btn-sm"
        onClick={() => update((d) => void d.committees.push({ id: uid('cm'), name: 'لجنة جديدة', duties: '', members: '', term: '', powers: '', delegation: '', reporting: '', recusal: '' }))}
      >
        <Plus className="size-4" /> إضافة لجنة
      </button>
      <ClauseList ids={['BRD-19']} title="بند اللجان" allowAdd={false} />
      <p className="hint">يكون رئيس كل لجنة عضوًا في مجلس الأمناء بحسب النص المطّلع عليه.</p>
    </div>
  );
};
