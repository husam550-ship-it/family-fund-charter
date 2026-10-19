import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { VAR_BY_KEY } from '../data/variables';
import { useStore } from '../lib/store';
import { cx, Term, Resolved } from './ui';
import { useDerived } from '../lib/derived';
import { resolveText } from '../engine/context';
import { GLOSSARY } from '../data/glossary';

// ───── أدوات إدخال

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** يقبل الأرقام العربية والفواصل العربية ويحولها إلى لاتينية */
export const normalizeNumber = (s: string): string =>
  s
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[٬,\s]/g, '');

const show = (v: number | null): string => (v == null ? '' : String(v));

export const NumInput = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) => {
  const [text, setText] = useState(show(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(show(value));
  }, [value, focus]);
  const out = value != null && ((min != null && value < min) || (max != null && value > max));
  return (
    <input
      inputMode="decimal"
      className={cx('input ltr text-end', out && 'border-bad bg-bad-soft', className)}
      value={text}
      placeholder={placeholder ?? '—'}
      aria-label={ariaLabel}
      aria-invalid={out || undefined}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        if (value != null) {
          const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
          if (c !== value) onChange(c);
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const t = normalizeNumber(raw);
        if (t === '') return onChange(null);
        if (/^-?\d*\.?\d*$/.test(t) && t !== '-' && t !== '.' && !t.endsWith('.')) onChange(Number(t));
      }}
    />
  );
};

export const TextInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  type = 'text',
  disabled,
}: {
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  type?: 'text' | 'month' | 'date' | 'time';
  disabled?: boolean;
}) => (
  <input
    type={type}
    className={cx('input', (type === 'month' || type === 'date') && 'ltr text-end', className)}
    value={value ?? ''}
    placeholder={placeholder}
    aria-label={ariaLabel}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const TextArea = ({
  value,
  onChange,
  placeholder,
  rows,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
  className?: string;
}) => (
  <textarea
    className={cx('input', className)}
    value={value}
    rows={rows ?? 3}
    placeholder={placeholder}
    aria-label={ariaLabel}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const SelectInput = ({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) => (
  <select className={cx('input', className)} value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const Check = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) => {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="size-4 accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
};

export const Field = ({ label, hint, children, className, term }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; term?: keyof typeof GLOSSARY }) => {
  const id = useId();
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {term ? <Term k={term}>{label}</Term> : label}
      </label>
      <div id={id}>{children}</div>
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  );
};

// ───── حقل متغير ذكي: يُدخل مرة واحدة ويُستخدم في كل النصوص والحسابات

const VAR_TERMS: Record<string, string> = {
  board_quorum_pct: 'quorum',
  min_cash_reserve: 'reserve',
  majority_critical_pct: 'critical',
  loan_max_amount: 'qard',
  loan_pool_pct: 'qard',
  endowment_target: 'waqf',
  endowments_target_count: 'waqf',
  exemption_rate: 'default',
};

export const VarField = ({ k, className, hideHelp }: { k: string; className?: string; hideHelp?: boolean }) => {
  const def = VAR_BY_KEY[k];
  if (!def) throw new Error(`متغير غير معرّف: ${k}`);
  const value = useStore((s) => s.project.vars[k]);
  const setVar = useStore((s) => s.setVar);
  const empty = value == null || value === '';
  const { ctx } = useDerived();

  let input: ReactNode;
  switch (def.type) {
    case 'text':
      input = <TextInput ariaLabel={def.label} value={(value as string) ?? ''} onChange={(v) => setVar(k, v === '' ? null : v)} />;
      break;
    case 'month':
      input = <TextInput type="month" ariaLabel={def.label} value={(value as string) ?? ''} onChange={(v) => setVar(k, v === '' ? null : v)} />;
      break;
    case 'date':
      input = <TextInput type="date" ariaLabel={def.label} value={(value as string) ?? ''} onChange={(v) => setVar(k, v === '' ? null : v)} />;
      break;
    case 'select':
      input = <SelectInput ariaLabel={def.label} value={(value as string) ?? ''} onChange={(v) => setVar(k, v)} options={def.options ?? []} />;
      break;
    case 'boolean':
      input = <Check checked={value === true} onChange={(v) => setVar(k, v)} label={def.label} />;
      break;
    default:
      input = (
        <div className="flex items-center gap-2">
          <NumInput ariaLabel={def.label} value={typeof value === 'number' ? value : null} min={def.min} max={def.max} onChange={(v) => setVar(k, v)} />
          {def.type === 'percent' ? <span className="text-sm text-mute">%</span> : def.unit ? <span className="shrink-0 text-xs text-mute">{def.unit}</span> : null}
        </div>
      );
  }

  return (
    <div className={className}>
      {def.type !== 'boolean' && (
        <label className="label flex flex-wrap items-center gap-1.5">
          {VAR_TERMS[k] ? <Term k={VAR_TERMS[k]}>{def.label}</Term> : def.label}
          {def.assumption && <span className="badge bg-info-soft text-info" title="افتراض تحليلي قابل للتعديل وليس معلومة فعلية">افتراض</span>}
          {empty && def.type !== 'select' && def.key !== 'fund_official_name' && <span className="badge bg-warn-soft text-warn">لم يُحدد</span>}
        </label>
      )}
      {input}
      {def.type === 'text' && typeof value === 'string' && value.includes('{{') && (
        <p className="hint mt-1">
          كما يظهر: <b className="text-brand-900"><Resolved text={resolveText(value, ctx)} /></b>
        </p>
      )}
      {!hideHelp && def.help && <p className="hint mt-1">{def.help}</p>}
    </div>
  );
};

/** مجموع نسب يجب أن يساوي 100% */
export const SumMeter = ({ total, label }: { total: number; label: string }) => {
  const ok = Math.abs(total - 100) < 0.01;
  return (
    <div
      role="status"
      className={cx('flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold', ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}
    >
      <span>{label}</span>
      <span className="ltr">{Number(total.toFixed(2))}% {ok ? '✓' : '— يجب أن يساوي 100%'}</span>
    </div>
  );
};
