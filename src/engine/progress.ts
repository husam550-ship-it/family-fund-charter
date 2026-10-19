import type { Project } from '../types';
import { REQUIREMENTS } from '../data/checklist';
import type { Custom, Requirement, SectionId } from '../data/checklist';
import { clauseMap } from '../lib/clauses';
import { labelOf } from './context';
import { groupPlans } from './subscriptions';

export const sumShare = (rows: { share: number }[]): number => rows.reduce((s, r) => s + r.share, 0);
export const sumWeight = (rows: { weight: number }[]): number => rows.reduce((s, r) => s + r.weight, 0);
const near100 = (n: number): boolean => Math.abs(n - 100) < 0.01;

const CUSTOM: Record<Custom, (p: Project) => boolean> = {
  identity_confirmed: (p) =>
    ['name', 'vision', 'mission', 'values', 'purpose'].every((id) => p.identity.groups.find((g) => g.id === id)?.confirmed),
  loan_weights_100: (p) => p.loanFactors.length > 0 && near100(sumWeight(p.loanFactors)) && !!p.confirmations.loan_weights,
  criteria_decided: (p) => p.criteria.length > 0 && p.criteria.every((c) => c.mode !== 'undecided'),
  approval_limits_set: (p) =>
    p.approvalLimits.length > 0 &&
    p.approvalLimits.slice(0, -1).every((l) => l.limit != null) &&
    p.approvalLimits.every((l) => l.approver.trim() !== ''),
  assets_registered: (p) => p.assets.length > 0,
  tiers_defined: (p) =>
    p.tiers.length > 0 && p.tiers.every((t) => Object.values(t.rights).every((r) => r !== 'undecided')) && !!p.confirmations.tiers,
  groups_defined: (p) => groupPlans(p).some((g) => g.count > 0),
  meeting_recorded: (p) => p.meetings.some((m) => m.decisions.length > 0),
  committees_defined: (p) =>
    p.committees.length > 0 && p.committees.every((c) => c.duties.trim() !== '' && c.powers.trim() !== '') && !!p.confirmations.committees,
  allocation_100: (p) => near100(sumShare(p.returnsAllocation)) && !!p.confirmations.returns,
};

export interface ReqResult {
  req: Requirement;
  done: boolean;
  missing: string[];
}

export const evaluateRequirements = (p: Project): ReqResult[] => {
  const cm = clauseMap(p);
  return REQUIREMENTS.map((req) => {
    const missing: string[] = [];
    for (const id of req.clauses ?? []) {
      const c = cm.get(id);
      if (!c) missing.push(`البند ${id} غير موجود`);
      else if (c.status !== 'approved') missing.push(`بند غير معتمد: ${c.title}`);
    }
    for (const k of req.vars ?? []) {
      const v = p.vars[k];
      if (v == null || v === '') missing.push(`متغير غير مُدخل: ${labelOf(k)}`);
    }
    if (req.custom && !CUSTOM[req.custom](p)) missing.push('شرط الإدخال غير مستوفٍ');
    return { req, done: missing.length === 0, missing };
  });
};

export const completionPercent = (rs: ReqResult[]): number =>
  rs.length === 0 ? 0 : Math.round((rs.filter((r) => r.done).length / rs.length) * 100);

export const sectionCompletion = (rs: ReqResult[]): Partial<Record<SectionId, { done: number; total: number }>> => {
  const out: Partial<Record<SectionId, { done: number; total: number }>> = {};
  for (const r of rs) {
    const cur = out[r.req.section] ?? { done: 0, total: 0 };
    cur.total += 1;
    if (r.done) cur.done += 1;
    out[r.req.section] = cur;
  }
  return out;
};

export interface ClauseCounts {
  approved: number;
  discuss: number;
  postponed: number;
  excluded: number;
  contested: number;
  total: number;
  /** أسئلة مطروحة في بنود لم تُناقش بعد */
  openQuestions: number;
}

export const clauseCounts = (p: Project): ClauseCounts => {
  const c = { approved: 0, discuss: 0, postponed: 0, excluded: 0, contested: 0, total: p.clauses.length, openQuestions: 0 };
  for (const cl of p.clauses) {
    c[cl.status] += 1;
    if (cl.contested) c.contested += 1;
    if (cl.status === 'discuss') c.openQuestions += cl.questions.length;
  }
  return c;
};
