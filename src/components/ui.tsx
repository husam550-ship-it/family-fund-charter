import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, X } from 'lucide-react';
import { GLOSSARY } from '../data/glossary';
import { useUi } from '../lib/ui';
import { MISSING_RE } from '../engine/context';

export const cx = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(' ');

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={cx('card p-4 sm:p-5', className)}>{children}</section>
);

export const SectionHead = ({ num, title, sub, actions }: { num?: string; title: string; sub?: string; actions?: ReactNode }) => (
  <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      {num && <span className="eyebrow mb-2">{num}</span>}
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 max-w-3xl text-sm text-mute">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>
);

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'plain';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  gold: 'bg-gold-soft text-gold-deep',
  plain: 'bg-brand-50 text-brand-800',
};
export const Badge = ({ tone = 'plain', children, title }: { tone?: Tone; children: ReactNode; title?: string }) => (
  <span className={cx('badge', TONES[tone])} title={title}>
    {children}
  </span>
);

export const Callout = ({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'bad' | 'ok' | 'gold'; title?: string; children: ReactNode }) => {
  const Icon = tone === 'bad' || tone === 'warn' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3 text-sm', {
      info: 'border-info/25 bg-info-soft text-info',
      warn: 'border-warn/30 bg-warn-soft text-warn',
      bad: 'border-bad/30 bg-bad-soft text-bad',
      ok: 'border-ok/25 bg-ok-soft text-ok',
      gold: 'border-gold/40 bg-gold-soft text-gold-deep',
    }[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1 leading-relaxed">
        {title && <div className="font-bold">{title}</div>}
        <div className="text-ink/90">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-line bg-ivory/60 p-6 text-center text-sm text-mute">{children}</div>
);

export const ProgressBar = ({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'gold' | 'bad'; label?: string }) => (
  <div
    role="progressbar"
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={label}
    className="h-2 w-full overflow-hidden rounded-full bg-brand-50"
  >
    <div
      className={cx('h-full rounded-full transition-all', tone === 'gold' ? 'bg-gold' : tone === 'bad' ? 'bg-bad' : 'bg-brand-600')}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export const Ring = ({ value, size = 64, label }: { value: number; size?: number; label?: string }) => {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-brand-700)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold text-brand-900 ltr">{value}%</span>
    </div>
  );
};

export const Stat = ({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'bad' | 'ok' }) => (
  <div className="card p-4">
    <div className="text-xs font-semibold text-mute">{label}</div>
    <div className={cx('mt-1 text-xl font-bold sm:text-2xl', tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-brand-900')}>{value}</div>
    {sub && <div className="mt-0.5 text-xs text-mute">{sub}</div>}
  </div>
);

export const Tabs = <T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[];
  value: T;
  onChange: (id: T) => void;
}) => (
  <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1">
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={cx(
          'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
          value === t.id ? 'bg-brand-800 text-white' : 'text-mute hover:bg-brand-50',
        )}
      >
        {t.label}
        {t.badge != null && t.badge > 0 && (
          <span className={cx('rounded-full px-1.5 text-xs', value === t.id ? 'bg-white/20' : 'bg-gold-soft text-gold-deep')}>{t.badge}</span>
        )}
      </button>
    ))}
  </div>
);

export const Disclosure = ({ title, children, defaultOpen = false, right }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-xl border border-line bg-paper">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="font-bold text-brand-900">{title}</span>
        <span className="flex items-center gap-2">
          {right}
          <ChevronDown className={cx('size-4 text-mute transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-line p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/45 p-3 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('card max-h-[92vh] w-full overflow-y-auto shadow-2xl outline-none', wide ? 'max-w-4xl' : 'max-w-xl')}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-5 py-3">
          <h2 className="text-lg">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Hosts = () => {
  const confirmReq = useUi((s) => s.confirmReq);
  const toasts = useUi((s) => s.toasts);
  return (
    <>
      {confirmReq && (
        <Modal title={confirmReq.title} onClose={() => confirmReq.resolve(false)}>
          {confirmReq.message && <p className="mb-5 whitespace-pre-line text-sm leading-relaxed">{confirmReq.message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => confirmReq.resolve(false)}>
              إلغاء
            </button>
            <button className={cx('btn', confirmReq.danger ? 'btn-danger' : 'btn-primary')} onClick={() => confirmReq.resolve(true)} autoFocus>
              {confirmReq.confirmLabel ?? 'تأكيد'}
            </button>
          </div>
        </Modal>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm font-semibold shadow-lg',
              t.kind === 'error' ? 'bg-bad text-white' : t.kind === 'info' ? 'bg-info text-white' : 'bg-brand-800 text-white',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
};

/** مصطلح بتلميح تفسيري */
export const Term = ({ k, children }: { k: keyof typeof GLOSSARY | string; children?: ReactNode }) => {
  const g = GLOSSARY[k];
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!g) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="border-b border-dotted border-gold-deep text-inherit"
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
      >
        {children ?? g.term}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute start-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-paper p-3 text-start text-xs font-normal leading-relaxed text-ink shadow-xl"
        >
          <b className="mb-1 block text-brand-800">{g.term}</b>
          {g.text}
        </span>
      )}
    </span>
  );
};

/** يعرض النص ويُبرز علامات «يُستكمل» */
export const Resolved = ({ text }: { text: string }) => {
  const parts: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(MISSING_RE.source, 'g');
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <mark key={i} className="missing">
        {m[0]}
      </mark>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};
