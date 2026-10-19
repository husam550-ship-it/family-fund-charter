import type { ContribGroup, Project } from '../types';
import type { RegRecord } from './api';

// تجميع التسجيلات وتطبيقها على فئات الاشتراك. دوال نقية؛ لا تُحفظ بيانات المشاركين في المشروع.

export interface BranchRow {
  name: string;
  count: number;
  monthly: number;
}

export interface RegSummary {
  total: number;
  complete: number;
  /** مكتملون بمبلغ شهري أكبر من صفر */
  committed: number;
  monthlyTotal: number;
  monthlyAvg: number | null;
  /** مجموع (الشهري × 12 × السنوات) للملتزمين */
  lifetimeTotal: number;
  oneTimeTotal: number;
  volunteers: number;
  male: number;
  female: number;
  byBranch: BranchRow[];
}

export const isCommitted = (r: RegRecord): boolean => r.complete && (r.monthly ?? 0) > 0;

export const summarize = (records: RegRecord[]): RegSummary => {
  const committed = records.filter(isCommitted);
  const monthlyTotal = committed.reduce((s, r) => s + (r.monthly ?? 0), 0);
  const branches = new Map<string, BranchRow>();
  for (const r of committed) {
    const name = r.branch || 'غير محدد';
    const row = branches.get(name) ?? { name, count: 0, monthly: 0 };
    row.count += 1;
    row.monthly += r.monthly ?? 0;
    branches.set(name, row);
  }
  return {
    total: records.length,
    complete: records.filter((r) => r.complete).length,
    committed: committed.length,
    monthlyTotal,
    monthlyAvg: committed.length > 0 ? monthlyTotal / committed.length : null,
    lifetimeTotal: committed.reduce((s, r) => s + (r.monthly ?? 0) * 12 * (r.years ?? 0), 0),
    oneTimeTotal: records.filter((r) => r.complete).reduce((s, r) => s + (r.oneTime ?? 0), 0),
    volunteers: records.filter((r) => r.volunteer).length,
    male: records.filter((r) => r.gender === 'male').length,
    female: records.filter((r) => r.gender === 'female').length,
    byBranch: [...branches.values()].sort((a, b) => b.count - a.count),
  };
};

export interface GroupChange {
  id: string;
  name: string;
  before: Pick<ContribGroup, 'target' | 'monthlyAmount' | 'years'>;
  after: Pick<ContribGroup, 'target' | 'monthlyAmount' | 'years'>;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * يحسب لكل فئة (بحسب الجنس) العدد المستهدف ومتوسط المبلغ والمدة من الملتزمين.
 * المنصة تحسب كل فئة بمبلغ ومدة واحدين، فالمتوسط تقريب. الفئة التي لا ملتزمين لها لا تتغير.
 */
export const planGroupChanges = (p: Project, records: RegRecord[]): GroupChange[] => {
  const committed = records.filter(isCommitted);
  const changes: GroupChange[] = [];
  for (const g of p.groups) {
    const mine = committed.filter((r) => g.gender === 'mixed' || r.gender === g.gender);
    if (mine.length === 0) continue;
    const withYears = mine.filter((r) => r.years != null);
    changes.push({
      id: g.id,
      name: g.name,
      before: { target: g.target, monthlyAmount: g.monthlyAmount, years: g.years },
      after: {
        target: mine.length,
        monthlyAmount: Math.round(mine.reduce((s, r) => s + (r.monthly ?? 0), 0) / mine.length),
        years: withYears.length > 0 ? round1(withYears.reduce((s, r) => s + (r.years ?? 0), 0) / withYears.length) : g.years,
      },
    });
  }
  return changes;
};

export const applyGroupChanges = (d: Project, changes: GroupChange[]): void => {
  for (const c of changes) {
    const g = d.groups.find((x) => x.id === c.id);
    if (!g) throw new Error(`الفئة غير موجودة: ${c.name}`);
    Object.assign(g, c.after);
  }
};
