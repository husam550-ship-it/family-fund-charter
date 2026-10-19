import { describe, expect, it } from 'vitest';
import { buildClauseLibrary } from '../data/clauses';
import { DERIVED_DEFS, VAR_BY_KEY } from '../data/variables';
import { REQUIREMENTS } from '../data/checklist';
import { createDefaultProject } from '../data/defaults';
import { applyDemo, clearDemo } from '../data/demo';
import { buildContext, missingIn, resolveText } from './context';
import { placeholdersIn } from './context';

const lib = buildClauseLibrary();
const ids = new Set(lib.map((c) => c.id));
const derived = new Set(DERIVED_DEFS.map((d) => d.key));

describe('مكتبة البنود', () => {
  it('تحوي 80 بندًا على الأقل بمعرفات فريدة', () => {
    expect(lib.length).toBeGreaterThanOrEqual(80);
    expect(ids.size).toBe(lib.length);
  });

  it('كل بند له نص فعلي وعنوان وسبب اقتراح', () => {
    for (const c of lib) {
      expect(c.title.length, c.id).toBeGreaterThan(3);
      expect(c.why.length, c.id).toBeGreaterThan(10);
      for (const a of c.alternatives) expect(a.text.length, `${c.id}/${a.id}`).toBeGreaterThan(20);
    }
  });

  it('لا بند معتمدًا افتراضيًا', () => {
    expect(lib.every((c) => c.status === 'discuss')).toBe(true);
  });

  it('الروابط بين البنود تشير إلى بنود موجودة', () => {
    for (const c of lib) for (const r of c.related) expect(ids.has(r), `${c.id} → ${r}`).toBe(true);
  });

  it('كل متغير مستخدم في النصوص معرّف في السجل', () => {
    for (const c of lib) {
      const keys = new Set<string>(c.affects);
      for (const a of c.alternatives) for (const k of placeholdersIn(a.text)) keys.add(k);
      for (const k of keys) expect(VAR_BY_KEY[k] || derived.has(k), `${c.id}: ${k}`).toBeTruthy();
      for (const a of c.alternatives) for (const k of Object.keys(a.sets ?? {})) expect(VAR_BY_KEY[k], `${c.id}.sets ${k}`).toBeTruthy();
    }
  });

  it('متطلبات الاكتمال تشير إلى بنود ومتغيرات موجودة', () => {
    for (const r of REQUIREMENTS) {
      for (const id of r.clauses ?? []) expect(ids.has(id), `${r.id}: ${id}`).toBe(true);
      for (const k of r.vars ?? []) expect(VAR_BY_KEY[k], `${r.id}: ${k}`).toBeTruthy();
    }
  });

  it('لكل بند ذي بدائل متعددة بديل موصى به يشير إلى بديل موجود', () => {
    for (const c of lib) if (c.recommendation) expect(c.alternatives.some((a) => a.id === c.recommendation!.altId), c.id).toBe(true);
  });
});

describe('المتغيرات الذكية', () => {
  it('تغيير اسم العائلة يحدّث الاسم والنصوص المرتبطة', () => {
    const p = createDefaultProject();
    expect(resolveText('ذرية {{family_name}}', buildContext(p))).toBe('ذرية حسين عمر');
    p.vars.family_name = 'فلان بن علان';
    const ctx = buildContext(p);
    expect(ctx.fund_name).toBe('صندوق ذرية فلان بن علان العائلي');
    expect(resolveText('{{fund_name}}', ctx)).toContain('فلان بن علان');
  });

  it('المتغير الفارغ يظهر بتنبيه استكمال لا برمز خام', () => {
    const p = createDefaultProject();
    const ctx = buildContext(p);
    const out = resolveText('الاشتراك {{monthly_contribution}}', ctx);
    expect(out).toContain('[يُستكمل:');
    expect(out).not.toContain('{{');
    expect(missingIn('{{monthly_contribution}} {{family_name}}', ctx)).toEqual(['monthly_contribution']);
  });

  it('البيانات التوضيحية تُملأ ثم تُمسح كاملة', () => {
    const p = createDefaultProject();
    const d = applyDemo(p);
    expect(d.demo).toBe(true);
    expect(d.vars.monthly_contribution).toBe(400);
    const c = clearDemo(d);
    expect(c.demo).toBe(false);
    expect(c.vars.monthly_contribution).toBeNull();
    expect(c.assets).toHaveLength(0);
    expect(c.groups.every((g) => g.target == null)).toBe(true);
  });
});
