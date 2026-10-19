import type { Alternative, Clause, Project } from '../types';

export const selectedAlt = (c: Clause): Alternative => c.alternatives.find((a) => a.id === c.selectedAlt) ?? c.alternatives[0];

/** النص المعمول به: الصياغة المعدلة يدويًا إن وُجدت وإلا نص البديل المختار */
export const clauseText = (c: Clause): string => c.customText ?? selectedAlt(c).text;

export const isActive = (c: Clause): boolean => c.status !== 'excluded';

export const clauseMap = (p: Project): Map<string, Clause> => new Map(p.clauses.map((c) => [c.id, c]));

/** وسوم البديل المختار للبنود غير المستبعدة */
export const activeFlags = (p: Project): Map<string, Clause[]> => {
  const out = new Map<string, Clause[]>();
  for (const c of p.clauses) {
    if (!isActive(c)) continue;
    for (const f of selectedAlt(c).flags ?? []) {
      const list = out.get(f) ?? [];
      list.push(c);
      out.set(f, list);
    }
  }
  return out;
};

export const STATUS_LABEL: Record<Clause['status'], string> = {
  approved: 'معتمد',
  discuss: 'يحتاج مناقشة',
  postponed: 'مؤجل',
  excluded: 'مستبعد',
};

/** مفاتيح المتغيرات التي يعتمد عليها البند: المعلنة والمستخدمة في نصه */
export const clauseVarKeys = (c: Clause, text: string): string[] => {
  const keys = new Set<string>(c.affects);
  for (const m of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) keys.add(m[1]);
  return [...keys];
};
