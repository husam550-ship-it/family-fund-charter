// تنسيق الأرقام والتواريخ والأشهر. الأرقام لاتينية عمدًا لسهولة المطابقة مع الجداول.

/** الأعداد السالبة تُعزل اتجاهيًا (LRO) حتى لا تنقلب إشارتها داخل النص العربي */
export const num = (n: number, digits = 0): string => {
  const s = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  return n < 0 && Number(s.replace(/,/g, '')) !== 0 ? `\u202D-${s}\u202C` : s;
};

export const money = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '—' : `${num(Math.round(n))} ريال`;

export const compactMoney = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  const body = a >= 1_000_000_000 ? `${num(a / 1_000_000_000, 2)} مليار` : a >= 1_000_000 ? `${num(a / 1_000_000, 2)} مليون` : a >= 10_000 ? `${num(a / 1_000, 1)} ألف` : num(a);
  return n < 0 ? `\u202D-${body.split(' ')[0]}\u202C${body.includes(' ') ? ` ${body.split(' ')[1]}` : ''}` : body;
};

export const pct = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? '—' : `${num(n, digits)}%`;

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** 'YYYY-MM' → { y, m } حيث m من 0 إلى 11 */
export const parseYm = (ym: string): { y: number; m: number } | null => {
  const r = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!r) return null;
  const m = Number(r[2]) - 1;
  if (m < 0 || m > 11) return null;
  return { y: Number(r[1]), m };
};

export const ymLabel = (ym: string): string => {
  const p = parseYm(ym);
  return p ? `${MONTHS[p.m]} ${p.y}` : '—';
};

export const addMonths = (ym: string, k: number): string => {
  const p = parseYm(ym);
  if (!p) throw new Error(`شهر غير صالح: ${ym}`);
  const t = p.y * 12 + p.m + k;
  const y = Math.floor(t / 12);
  return `${y}-${String((t % 12) + 1).padStart(2, '0')}`;
};

export const monthsBetween = (from: string, to: string): number => {
  const a = parseYm(from);
  const b = parseYm(to);
  if (!a || !b) throw new Error(`شهر غير صالح: ${from} / ${to}`);
  return (b.y - a.y) * 12 + (b.m - a.m);
};

export const currentYm = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** التاريخ الهجري المقابل (أم القرى) لأول الشهر الميلادي، للعرض فقط */
export const hijriOfYm = (ym: string): string => {
  const p = parseYm(ym);
  if (!p) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long' }).format(
      new Date(Date.UTC(p.y, p.m, 15)),
    );
  } catch {
    return '';
  }
};

export const dateLabel = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

let counter = 0;
export const uid = (prefix = 'id'): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
