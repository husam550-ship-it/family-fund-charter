import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { CategoryId, ClauseStatus } from '../types';
import { useStore } from '../lib/store';
import { CATEGORIES } from '../data/clauses';
import { newClause, setStatus } from '../lib/actions';
import { clauseText, STATUS_LABEL } from '../lib/clauses';
import { confirmAction, toast, useUi } from '../lib/ui';
import { ClauseCard } from '../components/ClauseCard';
import { Card, cx, EmptyState, SectionHead } from '../components/ui';
import { Check, SelectInput } from '../components/fields';

const STATUS_FILTERS: { v: ClauseStatus | 'all'; label: string }[] = [
  { v: 'all', label: 'الكل' },
  { v: 'approved', label: STATUS_LABEL.approved },
  { v: 'discuss', label: STATUS_LABEL.discuss },
  { v: 'postponed', label: STATUS_LABEL.postponed },
  { v: 'excluded', label: STATUS_LABEL.excluded },
];

export default function Library() {
  const clauses = useStore((s) => s.project.clauses);
  const update = useStore((s) => s.update);
  const focus = useUi((s) => s.focusClause);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [st, setSt] = useState<ClauseStatus | 'all'>('all');
  const [core, setCore] = useState(false);
  const [legal, setLegal] = useState(false);
  const [contested, setContested] = useState(false);
  const [custom, setCustom] = useState(false);
  const [newCat, setNewCat] = useState<CategoryId>('foundation');

  useEffect(() => {
    if (!focus) return;
    setQ('');
    setCat('all');
    setSt('all');
    const t = setTimeout(() => {
      document.getElementById(`clause-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      useUi.setState({ focusClause: null });
    }, 150);
    return () => clearTimeout(t);
  }, [focus]);

  const list = useMemo(() => {
    const needle = q.trim();
    return clauses
      .filter((c) => cat === 'all' || c.category === cat)
      .filter((c) => st === 'all' || c.status === st)
      .filter((c) => !core || c.core)
      .filter((c) => !legal || c.legalCheck)
      .filter((c) => !contested || c.contested)
      .filter((c) => !custom || c.custom)
      .filter((c) => needle === '' || `${c.id} ${c.title} ${clauseText(c)} ${c.explanation} ${c.why}`.includes(needle))
      .sort((a, b) => a.order - b.order);
  }, [clauses, q, cat, st, core, legal, contested, custom]);

  const bulk = async (to: ClauseStatus): Promise<void> => {
    const ok = await confirmAction({
      title: `تغيير حالة ${list.length} بندًا`,
      message: `ستصبح حالة كل البنود المعروضة حاليًا «${STATUS_LABEL[to]}». ${to === 'approved' ? 'تأكد أنكم ناقشتموها فعلًا؛ فاعتماد البنود الجوهرية لا ينبغي أن يكون تلقائيًا.' : ''}`,
      confirmLabel: 'تطبيق',
      danger: to === 'approved' || to === 'excluded',
    });
    if (!ok) return;
    update((d) => list.forEach((c) => setStatus(d, c.id, to)));
    toast(`تم تحديث ${list.length} بندًا.`);
  };

  const counts = (s: ClauseStatus): number => clauses.filter((c) => c.status === s).length;

  return (
    <div className="space-y-6">
      <SectionHead
        num="15 / مكتبة البنود والبدائل"
        title="مكتبة البنود والبدائل"
        sub={`${clauses.length} بندًا مكتوبًا بالعربية موزعة على المجالات التسعة، لكل منها بدائل وأثر وأسئلة. تبقى كلها «يحتاج مناقشة» حتى تقرروا. والصياغات مقترحة وليست نصوصًا معتمدة قبل موافقة أصحاب الصلاحية ومراجعتها عند الحاجة.`}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem_14rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-3 size-4 text-mute" aria-hidden />
            <input className="input ps-9" placeholder="ابحث في العناوين والنصوص والأرقام…" aria-label="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <SelectInput
            ariaLabel="المجال"
            value={cat}
            onChange={(v) => setCat(v as CategoryId | 'all')}
            options={[{ value: 'all', label: 'كل المجالات' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
          />
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="الحالة">
            {STATUS_FILTERS.map((f) => (
              <button key={f.v} role="radio" aria-checked={st === f.v} className={cx('btn btn-sm', st === f.v ? 'btn-primary' : 'btn-soft')} onClick={() => setSt(f.v)}>
                {f.label}
                {f.v !== 'all' && <span className="ms-1 text-xs opacity-80">{counts(f.v)}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Check checked={core} onChange={setCore} label="الأساسية فقط" />
          <Check checked={legal} onChange={setLegal} label="تحتاج تحققًا نظاميًا" />
          <Check checked={contested} onChange={setContested} label="الخلافية" />
          <Check checked={custom} onChange={setCustom} label="المضافة يدويًا" />
          <span className="ms-auto text-sm text-mute">المعروض: {list.length}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-sm font-semibold text-mute">لكل المعروض:</span>
          {(['discuss', 'postponed', 'excluded', 'approved'] as ClauseStatus[]).map((s) => (
            <button key={s} className="btn btn-ghost btn-sm" disabled={list.length === 0} onClick={() => void bulk(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </Card>

      {list.length === 0 && <EmptyState>لا بنود مطابقة للتصفية.</EmptyState>}
      <div className="space-y-2">
        {list.map((c) => (
          <ClauseCard key={c.id} id={c.id} defaultOpen={focus === c.id} />
        ))}
      </div>

      <Card>
        <h2 className="mb-3 text-lg">إضافة بند جديد من الصفر</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <span className="label">المجال</span>
            <SelectInput value={newCat} onChange={(v) => setNewCat(v as CategoryId)} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              let id = '';
              update((d) => void (id = newClause(d, newCat)));
              setCat('all');
              setSt('all');
              setTimeout(() => useUi.setState({ focusClause: id }), 50);
            }}
          >
            <Plus className="size-4" /> إضافة بند
          </button>
        </div>
        <p className="hint mt-2">الحذف من النسخة النهائية يتم بـ«استبعاد» البند فيبقى في المكتبة. ولا يُحذف نهائيًا إلا ما أضفته أنت.</p>
      </Card>
    </div>
  );
}
