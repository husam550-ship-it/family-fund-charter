import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createDefaultProject } from '../data/defaults';
import { applyDemo } from '../data/demo';
import { buildContext } from '../engine/context';
import { simulateAll } from '../engine/simulate';
import type { Project } from '../types';
import { allSlides, visibleSlides } from './slides';

const input = (p: Project, joinLink: string | null = null) => ({ p, ctx: buildContext(p), base: simulateAll(p).base, joinLink });

describe('الشرح المبسط', () => {
  it('اسم الميثاق الافتراضي في الغلاف، وبلا رموز متغيرات خام', () => {
    const slides = allSlides(input(createDefaultProject()));
    expect(slides[0].title).toBe('ميثاق ذرية حسين عمر شرواني');
    const all = slides.flatMap((s) => [s.title, s.lead ?? '', ...s.points, ...s.facts.flatMap((f) => [f.label, f.value]), s.ask ?? '']);
    expect(all.filter((t) => t.includes('{{') || t.includes('[يُستكمل'))).toEqual([]);
  });

  it('اسم الميثاق قابل للتغيير ويتبع اسم العائلة', () => {
    const p = produce(createDefaultProject(), (d) => void (d.vars.family_name = 'فلان بن علان'));
    expect(allSlides(input(p))[0].title).toBe('ميثاق ذرية فلان بن علان');
    const q = produce(p, (d) => void (d.vars.charter_name = 'ميثاق الأسرة الكريمة'));
    expect(allSlides(input(q))[0].title).toBe('ميثاق الأسرة الكريمة');
  });

  it('لا تُعرض أرقام لم تُدخل، وتظهر متى أُدخلت', () => {
    const empty = allSlides(input(createDefaultProject()));
    expect(empty.find((s) => s.id === 'pay')?.facts).toEqual([]);
    expect(empty.find((s) => s.id === 'numbers')).toBeUndefined();
    const p = produce(createDefaultProject(), (d) => {
      d.vars.monthly_contribution = 250;
    });
    const fact = allSlides(input(p)).find((s) => s.id === 'pay')?.facts.find((f) => f.label === 'الاشتراك الشهري');
    expect(fact?.value).toBe('250 ريال');
  });

  it('شريحة الأرقام تظهر بالبيانات التوضيحية وتُوسَم بأنها غير حقيقية', () => {
    const demo = produce(createDefaultProject(), (d) => void Object.assign(d, applyDemo(d)));
    const s = allSlides(input(demo)).find((x) => x.id === 'numbers');
    expect(s?.title).toContain('بيانات توضيحية');
    expect(s?.points[0]).toContain('توضيحية غير حقيقية');
  });

  it('لا تُذكر موافقة مسبقة: لا شيء معتمد في المشروع الجديد', () => {
    const open = allSlides(input(createDefaultProject())).find((s) => s.id === 'open');
    expect(open?.points).toHaveLength(8);
    expect(open?.lead).toContain('بنود تنتظر قرارًا');
  });

  it('الإخفاء والنقطة الإضافية', () => {
    const p = produce(createDefaultProject(), (d) => {
      d.presentation.hidden.finance = true;
      d.presentation.extra.pay = 'نقطة خاصة بنا عن {{family_name}}';
    });
    const all = allSlides(input(p));
    expect(all.find((s) => s.id === 'finance')?.hidden).toBe(true);
    expect(visibleSlides(input(p)).some((s) => s.id === 'finance')).toBe(false);
    expect(all.find((s) => s.id === 'pay')?.points.at(-1)).toBe('نقطة خاصة بنا عن حسين عمر شرواني');
  });

  it('شريحة المطلوب منك تحمل رابط التسجيل ورمزه عند وجوده فقط', () => {
    const link = 'https://example.github.io/app/#/join/AKfycbxExampleDeploymentId_0123456789';
    const without = allSlides(input(createDefaultProject())).find((s) => s.id === 'you');
    expect(without?.qr).toBeUndefined();
    const withLink = allSlides(input(createDefaultProject(), link)).find((s) => s.id === 'you');
    expect(withLink?.qr).toBe(link);
    expect(withLink?.facts).toEqual([{ label: 'رابط التسجيل', value: link }]);
  });
});
