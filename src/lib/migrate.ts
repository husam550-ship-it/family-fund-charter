import type { Project } from '../types';
import { SCHEMA_VERSION, createDefaultProject } from '../data/defaults';
import { buildClauseLibrary } from '../data/clauses';
import { VAR_DEFS } from '../data/variables';

// التحقق من ملفات المشروع وترحيلها بين الإصدارات. أي خلل يُرمى كخطأ بنص عربي واضح.

export const EXPORT_KIND = 'family-fund-charter';

const fail = (msg: string): never => {
  throw new Error(msg);
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const STATUSES = ['approved', 'discuss', 'postponed', 'excluded'];

const requireArray = (o: Record<string, unknown>, key: string): unknown[] => {
  const v = o[key];
  if (!Array.isArray(v)) fail(`الملف غير صالح: الحقل «${key}» مفقود أو ليس قائمة.`);
  return v as unknown[];
};

/** تحقق بنيوي من المشروع قبل قبوله. لا يصلح البيانات بل يرفضها عند العطب. */
export const validateProject = (raw: unknown): void => {
  if (!isObj(raw)) fail('الملف غير صالح: ليس مشروعًا.');
  const o = raw as Record<string, unknown>;
  if (typeof o.schemaVersion !== 'number') fail('الملف غير صالح: رقم إصدار البيانات مفقود.');
  if ((o.schemaVersion as number) > SCHEMA_VERSION) fail('الملف من إصدار أحدث من هذا التطبيق. حدّث التطبيق أو استخدم ملفًا أقدم.');
  if (typeof o.id !== 'string' || o.id === '') fail('الملف غير صالح: معرّف المشروع مفقود.');
  if (typeof o.name !== 'string') fail('الملف غير صالح: اسم المشروع مفقود.');
  if (!isObj(o.vars)) fail('الملف غير صالح: المتغيرات مفقودة.');
  const clauses = requireArray(o, 'clauses');
  clauses.forEach((c, i) => {
    if (!isObj(c)) return fail(`الملف غير صالح: البند رقم ${i + 1} تالف.`);
    const cl = c as Record<string, unknown>;
    if (typeof cl.id !== 'string' || typeof cl.title !== 'string') fail(`الملف غير صالح: بيانات البند رقم ${i + 1} ناقصة.`);
    if (!STATUSES.includes(cl.status as string)) fail(`الملف غير صالح: حالة البند «${String(cl.id)}» غير معروفة.`);
    const alts = cl.alternatives;
    if (!Array.isArray(alts) || alts.length === 0) fail(`الملف غير صالح: بدائل البند «${String(cl.id)}» مفقودة.`);
    for (const a of alts as unknown[]) {
      if (!isObj(a) || typeof a.id !== 'string' || typeof a.text !== 'string') fail(`الملف غير صالح: أحد بدائل البند «${String(cl.id)}» تالف.`);
    }
  });
  for (const key of ['groups', 'assets', 'meetings', 'risks', 'tiers', 'committees', 'loanPurposes', 'loanFactors']) requireArray(o, key);
  if (!isObj(o.scenarios) || !['conservative', 'base', 'optimistic'].every((k) => isObj((o.scenarios as Record<string, unknown>)[k]))) {
    fail('الملف غير صالح: السيناريوهات المالية مفقودة.');
  }
  if (!isObj(o.identity) || !Array.isArray((o.identity as Record<string, unknown>).groups)) fail('الملف غير صالح: بيانات الهوية مفقودة.');
};

/** يرفع المشروع إلى بنية الإصدار الحالي ويكمل ما استُحدث من بنود ومتغيرات دون المساس بقرارات المستخدم */
export const reconcile = (p: Project): Project => {
  const fresh = createDefaultProject();
  const out = { ...fresh, ...p } as Project;

  // مفاتيح المشروع الجديدة التي لم تكن موجودة
  for (const k of Object.keys(fresh) as (keyof Project)[]) {
    if (out[k] === undefined) (out as unknown as Record<string, unknown>)[k] = fresh[k];
  }
  out.docSettings = { ...fresh.docSettings, ...p.docSettings };
  out.counters = { ...fresh.counters, ...p.counters };

  // متغيرات جديدة
  const vars = { ...p.vars };
  for (const d of VAR_DEFS) if (!(d.key in vars)) vars[d.key] = d.def;
  out.vars = vars;

  // بنود مدمجة جديدة تُضاف، ولا يُمس ما عدّله المستخدم
  const have = new Set(p.clauses.map((c) => c.id));
  const added = buildClauseLibrary().filter((c) => !have.has(c.id));
  const maxOrder = Math.max(-1, ...p.clauses.map((c) => c.order));
  out.clauses = [...p.clauses, ...added.map((c, i) => ({ ...c, order: maxOrder + 1 + i }))].map((c) => ({
    ...c,
    selectedAlt: c.alternatives.some((a) => a.id === c.selectedAlt) ? c.selectedAlt : c.alternatives[0].id,
  }));

  // مراجع نظامية جديدة
  const haveRefs = new Set(p.legalRefs?.map((r) => r.id));
  out.legalRefs = [...(p.legalRefs ?? []), ...fresh.legalRefs.filter((r) => !haveRefs.has(r.id))];
  const haveReview = new Set(p.reviewItems?.map((r) => r.id));
  out.reviewItems = [...(p.reviewItems ?? []), ...fresh.reviewItems.filter((r) => !haveReview.has(r.id))];

  out.schemaVersion = SCHEMA_VERSION;
  return out;
};

/** نقطة الدخول الوحيدة لتحميل أي مشروع (من التخزين أو من ملف) */
export const migrateProject = (raw: unknown): Project => {
  validateProject(raw);
  return reconcile(raw as Project);
};

export interface ExportEnvelope {
  kind: typeof EXPORT_KIND;
  schemaVersion: number;
  exportedAt: string;
  project: Project;
}

export const makeExport = (project: Project): ExportEnvelope => ({
  kind: EXPORT_KIND,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  project,
});

export const parseExport = (text: string): Project => {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return fail('تعذر قراءة الملف: ليس بصيغة JSON سليمة.');
  }
  if (!isObj(data) || data.kind !== EXPORT_KIND) fail('هذا الملف ليس نسخة احتياطية من هذه المنصة.');
  return migrateProject((data as Record<string, unknown>).project);
};
