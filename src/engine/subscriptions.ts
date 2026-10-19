import type { ContribGroup, Project } from '../types';
import { addMonths, currentYm, monthsBetween, parseYm, ymLabel } from '../lib/format';

export const numVar = (p: Project, key: string): number | null => {
  const v = p.vars[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const startYm = (p: Project): string => {
  const v = p.vars.subscription_start;
  return typeof v === 'string' && parseYm(v) ? v : currentYm();
};

export const startKnown = (p: Project): boolean => {
  const v = p.vars.subscription_start;
  return typeof v === 'string' && !!parseYm(v);
};

/** عدد المشتركين المتوقع = المستهدفون × نسبة المشاركة */
export const expectedCount = (g: ContribGroup): number => Math.round(((g.target ?? 0) * g.participation) / 100);

export interface GroupPlan {
  id: string;
  name: string;
  gender: ContribGroup['gender'];
  count: number;
  amount: number;
  years: number | null;
  /** أول شهر استحقاق (فهرس من بداية المشروع) */
  begin: number;
  /** نهاية الالتزام (فهرس حصري)، أو null إن تعذّر تحديدها */
  end: number | null;
}

export const isUniform = (p: Project): boolean => (p.vars.duration_mode ?? 'uniform') === 'uniform';

export const groupPlans = (p: Project): GroupPlan[] => {
  const uniform = isUniform(p);
  const monthly = numVar(p, 'monthly_contribution') ?? 0;
  const subYears = numVar(p, 'subscription_years');
  const grace = Math.max(0, Math.round(numVar(p, 'grace_months') ?? 0));
  const endMode = (p.vars.end_mode as string) ?? 'years';
  const fixed = p.vars.commitment_end_date;
  const start = startYm(p);

  return p.groups.map((g) => {
    const amount = uniform ? monthly : (g.monthlyAmount ?? monthly);
    const years = uniform ? subYears : (g.years ?? subYears);
    const offset = uniform ? 0 : Math.max(0, Math.round(g.joinOffsetMonths));
    const begin = offset + grace;
    let end: number | null = null;
    if (endMode === 'fixed_date') {
      if (typeof fixed === 'string' && parseYm(fixed)) end = Math.max(begin, monthsBetween(start, fixed) + 1);
    } else if (years != null) {
      end = endMode === 'per_cohort' ? begin + Math.round(years * 12) : Math.max(begin, grace + Math.round(years * 12));
    }
    return { id: g.id, name: g.name, gender: g.gender, count: expectedCount(g), amount, years, begin, end };
  });
};

/** آخر شهر التزام (فهرس حصري) بين الفئات ذات المشتركين، أو null */
export const commitmentEnd = (plans: GroupPlan[]): number | null => {
  const active = plans.filter((g) => g.count > 0 && g.amount > 0);
  if (active.length === 0 || active.some((g) => g.end == null)) return null;
  return Math.max(...active.map((g) => g.end as number));
};

export const commitmentEndLabel = (p: Project): string | null => {
  const e = commitmentEnd(groupPlans(p));
  if (e == null || e <= 0) return null;
  return ymLabel(addMonths(startYm(p), e - 1));
};

/** إجمالي الالتزامات التعاقدية قبل نسب التحصيل والنمو */
export const totalCommitment = (plans: GroupPlan[]): number =>
  plans.reduce((s, g) => (g.end == null ? s : s + g.count * g.amount * Math.max(0, g.end - g.begin)), 0);

/** نسبة التحصيل الأساسية المشتقة من نسب الانتظام والتأخر */
export const baseCollection = (p: Project): number => {
  const reg = numVar(p, 'regularity_rate') ?? 0;
  const late = numVar(p, 'late_rate') ?? 0;
  const rec = numVar(p, 'late_recovery_rate') ?? 0;
  return Math.min(100, reg + (late * rec) / 100);
};
