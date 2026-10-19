import type { Project } from '../types';
import { VAR_BY_KEY, VAR_DEFS, DERIVED_DEFS } from '../data/variables';
import { dateLabel, money, num, ymLabel } from '../lib/format';
import { commitmentEndLabel, expectedCount, groupPlans, totalCommitment } from './subscriptions';

export type Ctx = Record<string, string | undefined>;

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
/** علامة الاستكمال التي تظهر في الوثائق بدل المتغير الفارغ */
export const MISSING_RE = /\[يُستكمل: [^\]]+\]/g;

export const labelOf = (key: string): string =>
  VAR_BY_KEY[key]?.label ?? DERIVED_DEFS.find((d) => d.key === key)?.label ?? key;

export const missingMark = (key: string): string => `[يُستكمل: ${labelOf(key)}]`;

const fmt = (key: string, v: unknown): string | undefined => {
  const def = VAR_BY_KEY[key];
  if (v == null || v === '') return undefined;
  switch (def?.type) {
    case 'currency':
      return typeof v === 'number' ? money(v) : undefined;
    case 'percent':
      return typeof v === 'number' ? `${num(v, 2)}%` : undefined;
    case 'integer':
    case 'number':
      return typeof v === 'number' ? num(v, 2) : undefined;
    case 'month':
      return typeof v === 'string' ? ymLabel(v) : undefined;
    case 'date':
      return typeof v === 'string' ? dateLabel(v) : undefined;
    case 'boolean':
      return v ? 'نعم' : 'لا';
    case 'select':
      return def.options?.find((o) => o.value === v)?.label ?? String(v);
    default:
      return String(v);
  }
};

const substitute = (text: string, ctx: Ctx, onMissing: (key: string) => string): string =>
  text.replace(PLACEHOLDER, (_m, key: string) => ctx[key] ?? onMissing(key));

export const buildContext = (p: Project): Ctx => {
  const ctx: Ctx = {};
  const rawText: Record<string, string> = {};
  for (const d of VAR_DEFS) {
    if (d.type === 'text') {
      const v = p.vars[d.key];
      if (typeof v === 'string' && v.trim() !== '') rawText[d.key] = v;
    } else {
      ctx[d.key] = fmt(d.key, p.vars[d.key]);
    }
  }

  // مشتقات
  const monthly = p.vars.monthly_contribution;
  if (typeof monthly === 'number') ctx.annual_contribution = money(monthly * 12);
  const males = p.groups.filter((g) => g.gender === 'male').reduce((s, g) => s + (g.target ?? 0), 0);
  const females = p.groups.filter((g) => g.gender === 'female').reduce((s, g) => s + (g.target ?? 0), 0);
  if (males > 0) ctx.male_target = num(males);
  if (females > 0) ctx.female_target = num(females);
  const expected = p.groups.reduce((s, g) => s + expectedCount(g), 0);
  if (expected > 0) ctx.subscribers_total = num(expected);
  if (p.groups.some((g) => g.actual != null)) ctx.actual_subscribers = num(p.groups.reduce((s, g) => s + (g.actual ?? 0), 0));
  const end = commitmentEndLabel(p);
  if (end) ctx.subscription_end_date = end;
  const tc = totalCommitment(groupPlans(p));
  if (tc > 0) ctx.total_commitment = money(tc);
  if (p.assets.length > 0) ctx.assets_count = num(p.assets.length);
  if (p.loanFactors.length > 0) ctx.loan_factors_list = p.loanFactors.map((f) => `${f.label} (${num(f.weight, 1)}%)`).join('، ');
  p.loanTracks.slice(0, 3).forEach((t, i) => {
    ctx[`loan_track_${i + 1}_pct`] = `${num(t.share, 1)}%`;
  });

  // المتغيرات النصية قد تحتوي متغيرات أخرى: تُحل على جولات محدودة
  Object.assign(ctx, rawText);
  for (let round = 0; round < 3; round++) {
    for (const k of Object.keys(rawText)) {
      const cur = ctx[k] as string;
      ctx[k] = substitute(cur, ctx, missingMark);
    }
  }
  return ctx;
};

/** يستبدل المتغيرات؛ ما لم يُدخل يظهر بصيغة [يُستكمل: …] */
export const resolveText = (text: string, ctx: Ctx): string => substitute(text, ctx, missingMark);

export const placeholdersIn = (text: string): string[] => {
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) out.add(m[1]);
  return [...out];
};

export const missingIn = (text: string, ctx: Ctx): string[] => placeholdersIn(text).filter((k) => ctx[k] === undefined);

export const hasMissingMark = (text: string): boolean => new RegExp(MISSING_RE.source).test(text);
