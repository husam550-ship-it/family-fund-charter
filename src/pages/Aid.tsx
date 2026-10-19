import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Allocation, FundType, UseKey } from '../types';
import { useStore } from '../lib/store';
import { sumShare } from '../engine/progress';
import { money, uid } from '../lib/format';
import { Callout, Card, SectionHead, Tabs, Term } from '../components/ui';
import { Check, Field, NumInput, SelectInput, SumMeter, TextArea, TextInput, VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';
import { numVar } from '../engine/subscriptions';

type Tab = 'types' | 'budget' | 'funds' | 'rules';
const USES: { key: UseKey; label: string }[] = [
  { key: 'aid', label: 'المساعدات' },
  { key: 'loans', label: 'القروض' },
  { key: 'ops', label: 'التشغيل' },
  { key: 'investment', label: 'الاستثمار' },
  { key: 'reserve', label: 'الاحتياطي' },
];

export default function Aid() {
  const [tab, setTab] = useState<Tab>('types');
  return (
    <div className="space-y-6">
      <SectionHead
        num="07 / المساعدات والتكافل"
        title="المساعدات والتكافل"
        sub="نظام مستقل عن القروض: أنواع المساعدات وشروطها وميزانيتها، والفصل الصارم بين الزكاة والتبرعات المقيدة والموارد العامة والأموال الوقفية."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'types', label: 'أنواع المساعدات' },
          { id: 'budget', label: 'الميزانية والنسب' },
          { id: 'funds', label: 'الفصل بين الأموال' },
          { id: 'rules', label: 'البنود' },
        ]}
      />
      {tab === 'types' && <Types />}
      {tab === 'budget' && <Budget />}
      {tab === 'funds' && <Funds />}
      {tab === 'rules' && <ClauseList categories={['aid']} title="بنود المساعدات والتكافل" />}
    </div>
  );
}

const Types = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-3">
      {p.aidTypes.map((a, i) => {
        const set = (fn: (d: typeof a) => void, k: string): void => update((d) => fn(d.aidTypes[i]), `ai:${a.id}:${k}`);
        return (
          <Card key={a.id}>
            <div className="mb-3 flex items-center gap-2">
              <TextInput value={a.name} ariaLabel="نوع المساعدة" className="font-bold" onChange={(v) => set((d) => void (d.name = v), 'n')} />
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => update((d) => void (d.aidTypes = d.aidTypes.filter((x) => x.id !== a.id)))}>
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="تعريف الحالة" className="sm:col-span-2">
                <TextArea rows={2} value={a.definition} onChange={(v) => set((d) => void (d.definition = v), 'd')} />
              </Field>
              <Field label="سقف المساعدة (ريال)">
                <NumInput value={a.cap} min={0} onChange={(v) => set((d) => void (d.cap = v), 'c')} />
              </Field>
              <Field label="الأهلية">
                <TextArea rows={2} value={a.eligibility} onChange={(v) => set((d) => void (d.eligibility = v), 'e')} />
              </Field>
              <Field label="طريقة الاعتماد">
                <TextArea rows={2} value={a.approval} onChange={(v) => set((d) => void (d.approval = v), 'a')} />
              </Field>
              <Field label="المستندات اللازمة">
                <TextArea rows={2} value={a.docs} onChange={(v) => set((d) => void (d.docs = v), 'x')} />
              </Field>
              <Field label="شروط التكرار">
                <TextInput value={a.repeat} placeholder="مثال: مرة كل سنة" onChange={(v) => set((d) => void (d.repeat = v), 'r')} />
              </Field>
              <Field label="درجة السرية">
                <SelectInput
                  value={a.confidentiality}
                  options={['عادية', 'مرتفعة', 'سرية تامة'].map((x) => ({ value: x, label: x }))}
                  onChange={(v) => set((d) => void (d.confidentiality = v as typeof a.confidentiality), 's')}
                />
              </Field>
              <Field label="مصدر التمويل">
                <SelectInput value={a.fundId} options={p.fundTypes.map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => set((d) => void (d.fundId = v), 'f')} />
              </Field>
            </div>
          </Card>
        );
      })}
      <button
        className="btn btn-soft btn-sm"
        onClick={() =>
          update((d) => {
            d.aidTypes.push({ id: uid('aid'), name: 'نوع جديد', definition: '', eligibility: '', cap: null, approval: '', docs: '', repeat: '', confidentiality: 'عادية', fundId: d.fundTypes[0]?.id ?? '' });
          })
        }
      >
        <Plus className="size-4" /> إضافة نوع مساعدة
      </button>
    </div>
  );
};

const Budget = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const budget = numVar(p, 'aid_annual_budget');
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <VarField k="aid_annual_budget" />
        </div>
      </Card>
      <Card>
        <h2 className="mb-1 text-lg">نسبة كل نشاط من ميزانية المساعدات السنوية</h2>
        <p className="mb-3 text-sm text-mute">يجب أن يكون مجموع النسب 100%.</p>
        <EditableTable<Allocation>
          rows={p.activityBudget}
          cols={[
            { key: 'label', label: 'النشاط', w: 1.6 },
            { key: 'share', label: 'النسبة %', type: 'number', min: 0, max: 100, w: 0.8 },
            { key: 'id', label: 'المبلغ السنوي', w: 1, render: (r) => <span className="text-sm">{budget != null ? money((budget * r.share) / 100) : '—'}</span> },
            { key: 'note', label: 'ملاحظة', w: 1.2 },
          ]}
          onChange={(rows) => update((d) => void (d.activityBudget = rows))}
          onAdd={() => update((d) => void d.activityBudget.push({ id: uid('ab'), label: 'نشاط جديد', share: 0, note: '' }))}
          addLabel="إضافة نشاط"
        />
        <div className="mt-3">
          <SumMeter total={sumShare(p.activityBudget)} label="مجموع نسب الأنشطة" />
        </div>
      </Card>
    </div>
  );
};

const Funds = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-4">
      <Callout tone="warn" title="لا يُصرف مال خلافًا لقيده">
        فصل <Term k="zakat">الزكاة</Term> (حساب وسجل مستقلان وفق النص المطّلع عليه) والتبرعات المقيدة والموارد العامة والأموال الوقفية. ضع علامة على الأوجه المسموح صرف كل نوع فيها؛ وتنبّه المنصة إلى أي مساعدة أو توزيع يخالف ذلك. والقيم الابتدائية اقتراحات تحتاج مراجعة شرعية ونظامية.
      </Callout>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="p-1.5 text-start">نوع المال</th>
                <th className="p-1.5 text-start">الوصف</th>
                {USES.map((u) => (
                  <th key={u.key} className="p-1.5 text-center">{u.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {p.fundTypes.map((f, i) => (
                <tr key={f.id} className="border-t border-line align-top">
                  <td className="p-1.5">
                    <TextInput value={f.name} ariaLabel="نوع المال" onChange={(v) => update((d) => void (d.fundTypes[i].name = v), `ft:${f.id}`)} />
                  </td>
                  <td className="p-1.5">
                    <TextArea rows={2} value={f.description} ariaLabel="الوصف" onChange={(v) => update((d) => void (d.fundTypes[i].description = v), `fd:${f.id}`)} />
                  </td>
                  {USES.map((u) => (
                    <td key={u.key} className="p-1.5 text-center">
                      <Check checked={f.uses[u.key]} label="" onChange={(v) => update((d) => void (d.fundTypes[i].uses[u.key] = v))} />
                    </td>
                  ))}
                  <td className="p-1.5">
                    <button
                      className="btn btn-ghost btn-sm text-bad"
                      aria-label="حذف"
                      disabled={p.fundTypes.length <= 1}
                      onClick={() => update((d) => void (d.fundTypes = d.fundTypes.filter((x) => x.id !== f.id)))}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn btn-soft btn-sm mt-3"
          onClick={() => update((d) => void d.fundTypes.push({ id: uid('fund'), name: 'نوع جديد', description: '', uses: { aid: false, loans: false, ops: false, investment: false, reserve: false } } as FundType))}
        >
          <Plus className="size-4" /> إضافة نوع مال
        </button>
      </Card>
    </div>
  );
};
