import { useMemo } from 'react';
import type { CategoryId, ClauseStatus } from '../types';
import { useStore } from '../lib/store';
import { newClause } from '../lib/actions';
import { Plus } from 'lucide-react';
import { ClauseCard } from './ClauseCard';
import { EmptyState } from './ui';
import { STATUS_LABEL } from '../lib/clauses';
import { cx } from './ui';

/** يعرض بنود مجال أو أكثر مرتبة، مع عدّاد حالات وإمكان إضافة بند جديد */
export const ClauseList = ({
  categories,
  ids,
  title,
  allowAdd = true,
  defaultOpenIds = [],
}: {
  categories?: CategoryId[];
  ids?: string[];
  title?: string;
  allowAdd?: boolean;
  defaultOpenIds?: string[];
}) => {
  const clauses = useStore((s) => s.project.clauses);
  const update = useStore((s) => s.update);
  const list = useMemo(
    () =>
      clauses
        .filter((c) => (ids ? ids.includes(c.id) : categories ? categories.includes(c.category) : true))
        .sort((a, b) => (ids ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.order - b.order)),
    [clauses, categories, ids],
  );
  const count = (st: ClauseStatus): number => list.filter((c) => c.status === st).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{title ?? 'البنود المقترحة'}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['approved', 'discuss', 'postponed', 'excluded'] as ClauseStatus[]).map((st) => (
            <span key={st} className={cx('badge', st === 'approved' ? 'bg-ok-soft text-ok' : st === 'discuss' ? 'bg-warn-soft text-warn' : st === 'postponed' ? 'bg-info-soft text-info' : 'bg-bad-soft text-bad')}>
              {STATUS_LABEL[st]}: {count(st)}
            </span>
          ))}
        </div>
      </div>
      {list.length === 0 && <EmptyState>لا توجد بنود في هذا المجال.</EmptyState>}
      {list.map((c) => (
        <ClauseCard key={c.id} id={c.id} defaultOpen={defaultOpenIds.includes(c.id)} />
      ))}
      {allowAdd && categories && categories.length > 0 && (
        <button className="btn btn-soft btn-sm" onClick={() => update((d) => void newClause(d, categories[0]))}>
          <Plus className="size-4" /> إضافة بند جديد من الصفر
        </button>
      )}
    </div>
  );
};
