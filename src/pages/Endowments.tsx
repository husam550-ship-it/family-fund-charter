import { useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { Allocation, Phase } from '../types';
import { useStore } from '../lib/store';
import { sumShare } from '../engine/progress';
import { uid } from '../lib/format';
import { Badge, Callout, Card, SectionHead, Tabs, Term } from '../components/ui';
import { Check, SumMeter, VarField } from '../components/fields';
import { EditableTable } from '../components/table';
import { ClauseList } from '../components/ClauseList';
import { go } from '../lib/nav';

type Tab = 'policy' | 'returns' | 'phases';
const NEXT: Record<Phase['status'], Phase['status']> = { todo: 'doing', doing: 'done', done: 'todo' };

export default function Endowments() {
  const [tab, setTab] = useState<Tab>('policy');
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  return (
    <div className="space-y-6">
      <SectionHead
        num="10 / الاستثمارات والأوقاف"
        title="الاستثمارات والأوقاف"
        sub="تصميم مستقبل الصندوق بعد مرحلة الاشتراكات: متى نشتري؟ وكيف نملك ونوقف وننظر؟ وأين تُصرف العوائد؟"
      />
      <Callout tone="warn" title="لا يُعد مجرد إدخال عقار في القائمة وقفًا مسجلًا">
        الصندوق شخصية نظامية، و<Term k="waqf">الوقف</Term> كيان مستقل بوثيقته و<Term k="nazir">نظارته</Term>. تسجيل الوقف لدى الهيئة العامة للأوقاف يتطلب (بحسب ما نشرته الهيئة): وثيقة إثبات الوقف، ووثيقة إثبات النظارة، ووثيقة ملكية الأصل، ولائحة شروط الواقف. وكل ما يُنشأ داخل هذه المنصة مسودات للنقاش وليس وثائق وقف رسمية.
      </Callout>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'policy', label: 'السياسة والأسئلة' },
          { id: 'returns', label: 'تخصيص العوائد' },
          { id: 'phases', label: 'مراحل الانتقال إلى الأوقاف' },
        ]}
      />

      {tab === 'policy' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg">متغيرات الاستثمار والأوقاف</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <VarField k="endowment_target" />
              <VarField k="endowments_target_count" />
              <VarField k="reinvest_share" />
              <VarField k="allow_purchase_before_end" />
              <VarField k="min_cash_reserve" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="plain">الأصول المسجلة: {p.assets.length}</Badge>
              <button className="btn btn-soft btn-sm" onClick={() => go('assets')}>
                فتح سجل الأصول العقارية
              </button>
            </div>
          </Card>
          <ClauseList categories={['endowment']} title="الأسئلة والبنود الاستثمارية والوقفية" />
        </div>
      )}

      {tab === 'returns' && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">تصور تخصيص صافي العوائد</h2>
            <div className="flex items-center gap-2">
              {p.confirmations.returns ? <Badge tone="ok">مؤكد</Badge> : <Badge tone="warn">اقتراح غير مؤكد</Badge>}
              <Check checked={!!p.confirmations.returns} onChange={(v) => update((d) => void (d.confirmations.returns = v))} label="أؤكد التوزيع" />
            </div>
          </div>
          <p className="mb-3 text-sm text-mute">
            توزيع النسب على المصارف. ويجب أن تتوافق المصارف مع وثيقة الوقف وشروط الواقف. والإقراض الحسن من عوائد الأوقاف مشروط بأن تسمح بذلك شروط المصدر المالي. والنسب التالية اقتراح قابل للتعديل.
          </p>
          <EditableTable<Allocation>
            rows={p.returnsAllocation}
            cols={[
              { key: 'label', label: 'المصرف', w: 2 },
              { key: 'share', label: 'النسبة %', type: 'number', min: 0, max: 100, w: 0.8 },
              { key: 'note', label: 'ملاحظة', w: 1.6 },
            ]}
            onChange={(rows) => update((d) => void (d.returnsAllocation = rows))}
            onAdd={() => update((d) => void d.returnsAllocation.push({ id: uid('ra'), label: 'مصرف جديد', share: 0, note: '' }))}
            addLabel="إضافة مصرف"
          />
          <div className="mt-3 space-y-2">
            <SumMeter total={sumShare(p.returnsAllocation)} label="مجموع التوزيع" />
            <p className="hint">النموذج المالي يستخدم نسبة «إعادة الاستثمار» وحدها لتحديد ما يُعد قابلًا للصرف من صافي العوائد؛ وبقية الجدول وصف سياسة للميثاق.</p>
          </div>
        </Card>
      )}

      {tab === 'phases' && (
        <Card>
          <h2 className="mb-1 text-lg">تصور أولي لمراحل الانتقال إلى الأوقاف</h2>
          <p className="mb-4 text-sm text-mute">اضغط على المرحلة لتبديل حالتها، وعدّل ما يناسب.</p>
          <ol className="space-y-2">
            {p.transitionPhases.map((ph, i) => (
              <li key={ph.id} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
                <button
                  aria-label={`تبديل حالة ${ph.title}`}
                  onClick={() => update((d) => void (d.transitionPhases[i].status = NEXT[ph.status]))}
                  className="mt-0.5 shrink-0"
                >
                  {ph.status === 'done' ? <CheckCircle2 className="size-6 text-ok" /> : ph.status === 'doing' ? <Loader2 className="size-6 text-gold" /> : <Circle className="size-6 text-line" />}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <input className="input font-bold" aria-label="عنوان المرحلة" value={ph.title} onChange={(e) => update((d) => void (d.transitionPhases[i].title = e.target.value), `tp:${ph.id}`)} />
                  <textarea className="input" rows={2} aria-label="تفاصيل المرحلة" value={ph.detail} onChange={(e) => update((d) => void (d.transitionPhases[i].detail = e.target.value), `tpd:${ph.id}`)} />
                  <input className="input" aria-label="التوقيت" placeholder="التوقيت المستهدف (اختياري)" value={ph.when} onChange={(e) => update((d) => void (d.transitionPhases[i].when = e.target.value), `tpw:${ph.id}`)} />
                </div>
              </li>
            ))}
          </ol>
          <button className="btn btn-soft btn-sm mt-3" onClick={() => update((d) => void d.transitionPhases.push({ id: uid('tp'), title: 'مرحلة جديدة', detail: '', status: 'todo', when: '' }))}>
            إضافة مرحلة
          </button>
        </Card>
      )}
    </div>
  );
}
