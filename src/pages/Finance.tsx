import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { RaciValue } from '../types';
import { useStore } from '../lib/store';
import { uid } from '../lib/format';
import { Badge, Callout, Card, SectionHead, Tabs, Term } from '../components/ui';
import { TextInput, VarField } from '../components/fields';
import { ClauseList } from '../components/ClauseList';
import { go } from '../lib/nav';

type Tab = 'policies' | 'limits' | 'raci' | 'oversight';
const RACI_OPTS: { v: RaciValue; label: string }[] = [
  { v: '', label: '—' },
  { v: 'R', label: 'R منفّذ' },
  { v: 'A', label: 'A معتمد' },
  { v: 'C', label: 'C مستشار' },
  { v: 'I', label: 'I مُبلَّغ' },
];
const TONE: Record<RaciValue, string> = {
  '': 'text-mute',
  R: 'bg-brand-100 text-brand-800',
  A: 'bg-gold-soft text-gold-deep',
  C: 'bg-info-soft text-info',
  I: 'bg-ivory text-mute border border-line',
};

export default function Finance() {
  const [tab, setTab] = useState<Tab>('policies');
  return (
    <div className="space-y-6">
      <SectionHead
        num="09 / الإدارة المالية والرقابة"
        title="الإدارة المالية والرقابة"
        sub="الميزانية والحسابات والصرف وفصل المهام والمراجعة والاحتياطيات وسياسة الاستثمار والإفصاح والاحتيال، مع مصفوفة صلاحيات RACI."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'policies', label: 'السياسات المالية' },
          { id: 'limits', label: 'حدود الاعتماد' },
          { id: 'raci', label: 'مصفوفة RACI' },
          { id: 'oversight', label: 'الرقابة والمخاطر' },
        ]}
      />

      {tab === 'policies' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg">متغيرات مالية أساسية</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <VarField k="operating_expenses_annual" />
              <VarField k="aid_annual_budget" />
              <VarField k="min_cash_reserve" />
            </div>
          </Card>
          <ClauseList categories={['finance']} title="بنود الإدارة المالية والرقابة" />
        </div>
      )}

      {tab === 'limits' && (
        <Card>
          <h2 className="mb-2 text-lg">حدود الاعتماد المالي</h2>
          <p className="mb-3 text-sm text-mute">تُضبط حدود الصرف لكل مستوى وجهة الاعتماد عند التجاوز في قسم «مجلس الأمناء ← الصلاحيات والنصاب»، مع أمثلة افتراضية قابلة للاختيار.</p>
          <button className="btn btn-soft" onClick={() => go('board')}>
            فتح الصلاحيات والنصاب
          </button>
        </Card>
      )}

      {tab === 'raci' && <Raci />}

      {tab === 'oversight' && (
        <div className="space-y-5">
          <Callout tone="info" title="من النص المطّلع عليه">
            يلزم التعاقد مع <b>مراجع حسابات خارجي مرخص</b>، وحفظ السجلات المالية <b>عشر سنوات</b> على الأقل، وفصل أموال <Term k="zakat">الزكاة</Term> في حساب وسجل مستقلين، والالتزام بأنظمة مكافحة غسل الأموال. راجع التفاصيل في «المرجعية النظامية».
          </Callout>
          <ClauseList ids={['FIN-07', 'FIN-08', 'FIN-12', 'FIN-13', 'FIN-15', 'FIN-16', 'FIN-17', 'FIN-18']} title="بنود الرقابة والإفصاح ومكافحة الاحتيال" allowAdd={false} />
        </div>
      )}
    </div>
  );
}

const Raci = () => {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-4">
      <Callout tone="info">
        لكل عملية مهمة حدّد: <b>R</b> المنفّذ، <b>A</b> المعتمد (مسؤول واحد فقط لكل عملية)، <b>C</b> المستشار، <b>I</b> المُبلَّغ. اضغط على الخلية لتبديل القيمة. ويُشار إلى كل عملية لها أكثر من معتمد أو بلا معتمد.
      </Callout>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="p-1 text-start">العملية</th>
                {p.raciRoles.map((r, ri) => (
                  <th key={r.id} className="p-1">
                    <TextInput value={r.name} ariaLabel="اسم الدور" onChange={(v) => update((d) => void (d.raciRoles[ri].name = v), `rr:${r.id}`)} />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {p.raci.map((row, i) => {
                const a = Object.values(row.cells).filter((x) => x === 'A').length;
                return (
                  <tr key={row.id} className="bg-paper">
                    <td className="rounded-s-lg border border-e-0 border-line p-1.5">
                      <TextInput value={row.process} ariaLabel="العملية" onChange={(v) => update((d) => void (d.raci[i].process = v), `rp:${row.id}`)} />
                      {a !== 1 && <Badge tone="warn">{a === 0 ? 'بلا معتمد' : 'أكثر من معتمد'}</Badge>}
                    </td>
                    {p.raciRoles.map((r) => (
                      <td key={r.id} className="border-y border-line p-1 text-center">
                        <select
                          aria-label={`${row.process} / ${r.name}`}
                          className={`input text-center font-bold ${TONE[row.cells[r.id] ?? '']}`}
                          value={row.cells[r.id] ?? ''}
                          onChange={(e) => update((d) => void (d.raci[i].cells[r.id] = e.target.value as RaciValue))}
                        >
                          {RACI_OPTS.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="rounded-e-lg border border-s-0 border-line p-1">
                      <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف العملية" onClick={() => update((d) => void (d.raci = d.raci.filter((x) => x.id !== row.id)))}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-soft btn-sm" onClick={() => update((d) => void d.raci.push({ id: uid('rr'), process: 'عملية جديدة', cells: Object.fromEntries(d.raciRoles.map((r) => [r.id, ''])) }))}>
            <Plus className="size-4" /> إضافة عملية
          </button>
          <button
            className="btn btn-soft btn-sm"
            onClick={() =>
              update((d) => {
                const id = uid('role');
                d.raciRoles.push({ id, name: 'دور جديد' });
                d.raci.forEach((r) => void (r.cells[id] = ''));
              })
            }
          >
            <Plus className="size-4" /> إضافة دور
          </button>
        </div>
      </Card>
    </div>
  );
};
