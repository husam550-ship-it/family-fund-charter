import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Project, ScenarioId } from '../types';
import { buildContext } from '../engine/context';
import type { Ctx } from '../engine/context';
import { simulateAll } from '../engine/simulate';
import { completionPercent, evaluateRequirements } from '../engine/progress';
import type { ReqResult } from '../engine/progress';
import type { SimResult } from '../engine/simulate';
import { useStore } from './store';

interface Derived {
  project: Project;
  ctx: Ctx;
  sims: Record<ScenarioId, SimResult>;
  reqs: ReqResult[];
  percent: number;
}

const DerivedCtx = createContext<Derived | null>(null);

/** يحسب مرة واحدة لكل تعديل: سياق المتغيرات ونتائج السيناريوهات الثلاثة */
export const DerivedProvider = ({ children }: { children: ReactNode }) => {
  const project = useStore((s) => s.project);
  const value = useMemo<Derived>(() => {
    const reqs = evaluateRequirements(project);
    return { project, ctx: buildContext(project), sims: simulateAll(project), reqs, percent: completionPercent(reqs) };
  }, [project]);
  return <DerivedCtx.Provider value={value}>{children}</DerivedCtx.Provider>;
};

export const useDerived = (): Derived => {
  const v = useContext(DerivedCtx);
  if (!v) throw new Error('useDerived خارج DerivedProvider');
  return v;
};
