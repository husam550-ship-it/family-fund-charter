import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Check, NumInput, SelectInput, TextArea, TextInput } from './fields';
import { EmptyState } from './ui';

export interface Col<T> {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'percent' | 'select' | 'check' | 'month' | 'readonly';
  /** وزن العرض النسبي */
  w?: number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  render?: (row: T) => ReactNode;
  /** لعرض قيمة محسوبة بدل حقل إدخال */
  full?: boolean;
}

interface Props<T extends { id: string }> {
  rows: T[];
  cols: Col<T>[];
  onChange: (rows: T[]) => void;
  onAdd?: () => void;
  addLabel?: string;
  canRemove?: (row: T) => boolean;
  canMove?: boolean;
  empty?: string;
  rowTools?: (row: T) => ReactNode;
}

/** جدول قابل للتعديل: صفوف على الحاسوب وبطاقات على الهاتف */
export function EditableTable<T extends { id: string }>({ rows, cols, onChange, onAdd, addLabel = 'إضافة', canRemove, canMove, empty, rowTools }: Props<T>) {
  const patch = (id: string, key: string, value: unknown): void => onChange(rows.map((r) => (r.id === id ? ({ ...r, [key]: value } as T) : r)));
  const remove = (id: string): void => onChange(rows.filter((r) => r.id !== id));
  const move = (i: number, d: -1 | 1): void => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const template = cols.map((c) => `${c.w ?? 1}fr`).join(' ');

  const cell = (r: T, c: Col<T>): ReactNode => {
    const v = r[c.key] as unknown;
    if (c.render) return c.render(r);
    switch (c.type) {
      case 'number':
      case 'percent':
        return <NumInput ariaLabel={c.label} value={(v as number | null) ?? null} min={c.min} max={c.max} onChange={(x) => patch(r.id, c.key, x)} />;
      case 'select':
        return <SelectInput ariaLabel={c.label} value={String(v ?? '')} options={c.options ?? []} onChange={(x) => patch(r.id, c.key, x)} />;
      case 'check':
        return <Check checked={!!v} onChange={(x) => patch(r.id, c.key, x)} label="" />;
      case 'textarea':
        return <TextArea ariaLabel={c.label} rows={2} value={String(v ?? '')} placeholder={c.placeholder} onChange={(x) => patch(r.id, c.key, x)} />;
      case 'month':
        return <TextInput type="month" ariaLabel={c.label} value={String(v ?? '')} onChange={(x) => patch(r.id, c.key, x)} />;
      case 'readonly':
        return <span className="text-sm">{String(v ?? '—')}</span>;
      default:
        return <TextInput ariaLabel={c.label} value={String(v ?? '')} placeholder={c.placeholder} onChange={(x) => patch(r.id, c.key, x)} />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-2.5 text-xs font-bold text-brand-800 md:grid" style={{ gridTemplateColumns: `${template} 5.5rem` }}>
        {cols.map((c) => (
          <div key={c.key}>{c.label}</div>
        ))}
        <div />
      </div>
      {rows.length === 0 && <EmptyState>{empty ?? 'لا توجد عناصر بعد.'}</EmptyState>}
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="grid grid-cols-1 items-start gap-2 rounded-xl border border-line bg-paper p-2.5 sm:grid-cols-2 md:[grid-template-columns:var(--tpl)]"
          style={{ ['--tpl' as string]: `${template} 5.5rem` }}
        >
          {cols.map((c) => (
            <div key={c.key} className={c.full ? 'sm:col-span-2 md:col-span-1' : undefined}>
              <span className="label md:hidden">{c.label}</span>
              {cell(r, c)}
            </div>
          ))}
          <div className="flex items-center gap-1 sm:col-span-2 md:col-span-1">
            {canMove && (
              <>
                <button className="btn btn-ghost btn-sm" aria-label="تحريك لأعلى" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button className="btn btn-ghost btn-sm" aria-label="تحريك لأسفل" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown className="size-3.5" />
                </button>
              </>
            )}
            {rowTools?.(r)}
            {(canRemove ? canRemove(r) : true) && (
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => remove(r.id)}>
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      {onAdd && (
        <button className="btn btn-soft btn-sm" onClick={onAdd}>
          <Plus className="size-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}
