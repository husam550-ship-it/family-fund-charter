import type { CategoryId, Clause } from '../../types';
import { mk } from './build';
import type { ClauseIn } from './build';
import { FOUNDATION } from './foundation';
import { MEMBERSHIP } from './membership';
import { CONTRIBUTIONS } from './contributions';
import { LOANS } from './loans';
import { AID } from './aid';
import { BOARD } from './board';
import { FINANCE } from './finance';
import { ENDOWMENT } from './endowment';
import { CONTINUITY } from './continuity';

export const CATEGORIES: { id: CategoryId; label: string; short: string }[] = [
  { id: 'foundation', label: 'التأسيس والحقوق والعدالة', short: 'التأسيس' },
  { id: 'membership', label: 'العضوية ونطاق الذرية', short: 'العضوية' },
  { id: 'contributions', label: 'الاشتراكات والالتزامات', short: 'الاشتراكات' },
  { id: 'loans', label: 'القروض الحسنة', short: 'القروض' },
  { id: 'aid', label: 'المساعدات والتكافل', short: 'التكافل' },
  { id: 'board', label: 'مجلس الأمناء والحوكمة', short: 'الحوكمة' },
  { id: 'finance', label: 'الإدارة المالية والرقابة', short: 'المالية' },
  { id: 'endowment', label: 'الأوقاف والاستثمار', short: 'الأوقاف' },
  { id: 'continuity', label: 'الاستمرار والمساءلة', short: 'الاستمرار' },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CategoryId, string>;

const SOURCES: [CategoryId, ClauseIn[]][] = [
  ['foundation', FOUNDATION],
  ['membership', MEMBERSHIP],
  ['contributions', CONTRIBUTIONS],
  ['loans', LOANS],
  ['aid', AID],
  ['board', BOARD],
  ['finance', FINANCE],
  ['endowment', ENDOWMENT],
  ['continuity', CONTINUITY],
];

/** نسخة جديدة من مكتبة البنود المدمجة (كل بند في حالة «يحتاج مناقشة») */
export const buildClauseLibrary = (): Clause[] => {
  let order = 0;
  return SOURCES.flatMap(([cat, list]) => list.map((c) => mk(cat, c, order++)));
};
