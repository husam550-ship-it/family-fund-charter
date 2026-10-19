import type { FindingStatus } from '../types';
import { useStore } from '../lib/store';
import { go } from '../lib/nav';
import { useUi } from '../lib/ui';
import { Badge, cx } from './ui';
import { SelectInput, TextArea } from './fields';

export interface FindingLike {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  clauseIds: string[];
  impact: string;
  fixes: string[];
}

const SEV = { high: ['مرتفع', 'bad'], medium: ['متوسط', 'warn'], low: ['منخفض', 'info'] } as const;
const ST_LABEL: Record<FindingStatus, string> = { open: 'مفتوح', resolved: 'تمت المعالجة', accepted: 'قُبلت المخاطرة' };

/** تنبيه عدالة: الإشكال، البند، الأثر، الحلول، وخيار قبول المخاطرة بمبرر، وحالة المعالجة */
export const FindingCard = ({ f }: { f: FindingLike }) => {
  const st = useStore((s) => s.project.findings[f.id]);
  const clauses = useStore((s) => s.project.clauses);
  const update = useStore((s) => s.update);
  const status: FindingStatus = st?.status ?? 'open';
  const note = st?.note ?? '';
  const [sevLabel, tone] = SEV[f.severity];

  return (
    <div className={cx('rounded-xl border p-4', status === 'open' ? 'border-line bg-paper' : 'border-line bg-ivory/70 opacity-90')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{sevLabel}</Badge>
        <Badge tone={status === 'open' ? 'warn' : 'ok'}>{ST_LABEL[status]}</Badge>
        <h3 className="min-w-0 flex-1 text-base">{f.title}</h3>
      </div>
      <p className="text-sm leading-relaxed">{f.impact}</p>
      {f.clauseIds.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-mute">البند المتسبب:</span>
          {f.clauseIds.map((id) => {
            const c = clauses.find((x) => x.id === id);
            return (
              <button
                key={id}
                className="rounded-full border border-line bg-ivory px-2 py-0.5 hover:bg-brand-50"
                onClick={() => {
                  useUi.setState({ focusClause: id });
                  go('library');
                }}
              >
                <span className="ltr me-1 font-bold text-brand-800">{id}</span>
                {c?.title}
              </button>
            );
          })}
        </p>
      )}
      <div className="mt-2">
        <b className="text-xs text-brand-800">حلول مقترحة</b>
        <ul className="list-disc ps-5 text-sm">
          {f.fixes.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]">
        <div>
          <span className="label">حالة المعالجة</span>
          <SelectInput
            ariaLabel="حالة المعالجة"
            value={status}
            onChange={(v) => update((d) => void (d.findings[f.id] = { status: v as FindingStatus, note: d.findings[f.id]?.note ?? '' }))}
            options={(Object.keys(ST_LABEL) as FindingStatus[]).map((k) => ({ value: k, label: ST_LABEL[k] }))}
          />
        </div>
        <div>
          <span className="label">{status === 'accepted' ? 'مبرر قبول المخاطرة (مطلوب)' : 'ملاحظات'}</span>
          <TextArea
            rows={2}
            ariaLabel="ملاحظات المعالجة"
            value={note}
            placeholder={status === 'accepted' ? 'لماذا نقبل هذه المخاطرة؟' : ''}
            onChange={(v) => update((d) => void (d.findings[f.id] = { status: d.findings[f.id]?.status ?? 'open', note: v }), `fn:${f.id}`)}
          />
          {status === 'accepted' && note.trim() === '' && <p className="mt-1 text-xs font-semibold text-bad">سجّل المبرر ليُحتسب القبول.</p>}
        </div>
      </div>
    </div>
  );
};
