import type { Alternative, CategoryId, Clause, VarValue } from '../../types';

export interface AltIn {
  label: string;
  text: string;
  pros?: string;
  cons?: string;
  impact?: string;
  sets?: Record<string, VarValue>;
  flags?: string[];
}

export interface ClauseIn {
  id: string;
  title: string;
  why: string;
  explain?: string;
  /** صيغة واحدة جاهزة (بند بلا بدائل) */
  text?: string;
  alts?: AltIn[];
  q?: string[];
  rel?: string[];
  vars?: string[];
  legal?: string;
  verify?: boolean;
  core?: boolean;
  /** [فهرس البديل الموصى به، سبب التوصية] */
  rec?: [number, string];
}

const ALT_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export const mk = (category: CategoryId, c: ClauseIn, order: number): Clause => {
  const alts: AltIn[] = c.alts ?? [{ label: 'الصيغة المقترحة', text: c.text ?? '' }];
  if (alts.length === 0 || alts.some((a) => !a.text)) throw new Error(`بند بلا نص: ${c.id}`);
  const alternatives: Alternative[] = alts.map((a, i) => ({
    id: ALT_IDS[i],
    label: a.label,
    text: a.text,
    pros: a.pros ?? '',
    cons: a.cons ?? '',
    impact: a.impact ?? '',
    sets: a.sets,
    flags: a.flags,
  }));
  return {
    id: c.id,
    category,
    title: c.title,
    explanation: c.explain ?? '',
    why: c.why,
    alternatives,
    selectedAlt: 'a',
    customText: null,
    questions: c.q ?? [],
    related: c.rel ?? [],
    affects: c.vars ?? [],
    status: 'discuss',
    rationale: '',
    notes: '',
    decisionDate: null,
    meetingDecisionId: null,
    legalRef: c.legal ?? '',
    legalCheck: c.verify ?? false,
    core: c.core ?? false,
    contested: false,
    recommendation: c.rec ? { altId: ALT_IDS[c.rec[0]], why: c.rec[1] } : null,
    custom: false,
    approvedVars: null,
    order,
  };
};

export const SRC = {
  rules: 'القواعد التنظيمية للصناديق العائلية (قرار المركز الوطني لتنمية القطاع غير الربحي)',
  guide: 'الدليل الاسترشادي للائحة الأساسية للصندوق العائلي (08/06/2026)',
  naming: 'دليل تسمية الجمعيات والمؤسسات الأهلية والصناديق العائلية والأهلية (2026)',
  nazara: 'لائحة تنظيم أعمال النظارة (الهيئة العامة للأوقاف)',
  awqafReg: 'سجل الوقف (الهيئة العامة للأوقاف)',
};
