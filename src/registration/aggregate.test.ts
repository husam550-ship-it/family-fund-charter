import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createDefaultProject } from '../data/defaults';
import type { RegData, RegRecord } from './api';
import { applyGroupChanges, planGroupChanges, summarize } from './aggregate';
import { isBasicComplete, isCommitmentComplete } from './rules';
import { deploymentIdOf, endpointOf, isEndpoint } from './link';

const base: RegData = { name: 'فلان الفلاني', gender: 'male', branch: 'فرع أ', birthYear: null, city: '', phone: '', monthly: 100, years: 10, oneTime: null, volunteer: false, notes: '', complete: true };
const rec = (id: string, over: Partial<RegData> = {}): RegRecord => ({ ...base, ...over, id, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' });

describe('قواعد اكتمال التسجيل', () => {
  it('المعلومات الأساسية: كلمتان في الاسم والجنس', () => {
    expect(isBasicComplete({ ...base })).toBe(true);
    expect(isBasicComplete({ ...base, name: 'فلان' })).toBe(false);
    expect(isBasicComplete({ ...base, name: '   ' })).toBe(false);
    expect(isBasicComplete({ ...base, gender: '' })).toBe(false);
  });
  it('الالتزام: مبلغ ومدة، أو عدم الرغبة صراحة', () => {
    expect(isCommitmentComplete(base)).toBe(true);
    expect(isCommitmentComplete({ ...base, monthly: null, years: null })).toBe(false);
    expect(isCommitmentComplete({ ...base, years: null })).toBe(false);
    expect(isCommitmentComplete({ ...base, monthly: 0, years: null })).toBe(true);
    expect(isCommitmentComplete({ ...base, name: 'فلان' })).toBe(false);
  });
});

describe('تجميع التسجيلات', () => {
  const records = [
    rec('a', { monthly: 100, years: 10, branch: 'فرع أ', oneTime: 500, volunteer: true }),
    rec('b', { monthly: 300, years: 5, gender: 'female', branch: 'فرع أ' }),
    rec('c', { monthly: 200, years: 8, gender: 'female', branch: 'فرع ب' }),
    rec('d', { monthly: 0, years: null, name: 'لا يرغب هنا' }),
    rec('e', { monthly: 500, years: 10, complete: false }),
    rec('f', { monthly: null, years: null, complete: false, branch: '' }),
  ];
  it('لا يحسب إلا المكتمل بمبلغ أكبر من صفر', () => {
    const s = summarize(records);
    expect(s.total).toBe(6);
    expect(s.complete).toBe(4);
    expect(s.committed).toBe(3);
    expect(s.monthlyTotal).toBe(600);
    expect(s.monthlyAvg).toBe(200);
    expect(s.lifetimeTotal).toBe(100 * 12 * 10 + 300 * 12 * 5 + 200 * 12 * 8);
    expect(s.oneTimeTotal).toBe(500);
    expect(s.volunteers).toBe(1);
    expect(s.male).toBe(4);
    expect(s.female).toBe(2);
    expect(s.byBranch).toEqual([
      { name: 'فرع أ', count: 2, monthly: 400 },
      { name: 'فرع ب', count: 1, monthly: 200 },
    ]);
  });
  it('بلا تسجيلات: متوسط غير معرّف', () => {
    expect(summarize([]).monthlyAvg).toBeNull();
  });

  it('يخطط تغييرات الفئات بحسب الجنس بمتوسط المبلغ والمدة', () => {
    const p = createDefaultProject();
    const changes = planGroupChanges(p, records);
    const male = changes.find((c) => c.id === 'grp-male');
    const female = changes.find((c) => c.id === 'grp-female');
    expect(male?.after).toEqual({ target: 1, monthlyAmount: 100, years: 10 });
    expect(female?.after).toEqual({ target: 2, monthlyAmount: 250, years: 6.5 });
  });
  it('لا يمس فئة لا ملتزمين لها، ويطبّق دون لمس غير المذكور', () => {
    const p = createDefaultProject();
    const only = [rec('a'), rec('b', { monthly: 300, years: 5 })];
    const changes = planGroupChanges(p, only);
    expect(changes.map((c) => c.id)).toEqual(['grp-male']);
    const next = produce(p, (d) => applyGroupChanges(d, changes));
    expect(next.groups.find((g) => g.id === 'grp-male')).toMatchObject({ target: 2, monthlyAmount: 200, years: 7.5 });
    expect(next.groups.find((g) => g.id === 'grp-female')).toEqual(p.groups.find((g) => g.id === 'grp-female'));
  });
  it('الفئة المختلطة تأخذ كل الملتزمين', () => {
    const p = produce(createDefaultProject(), (d) => void (d.groups = [{ ...d.groups[0], id: 'all', gender: 'mixed' }]));
    expect(planGroupChanges(p, records)[0].after.target).toBe(3);
  });
});

describe('رابط خدمة التسجيل', () => {
  const id = 'AKfycbxExampleDeploymentId_0123456789';
  const url = `https://script.google.com/macros/s/${id}/exec`;
  it('يستخرج المعرّف من الرابط ويعيد بناءه', () => {
    expect(isEndpoint(url)).toBe(true);
    expect(deploymentIdOf(` ${url} `)).toBe(id);
    expect(endpointOf(id)).toBe(url);
  });
  it('يرفض أي رابط آخر', () => {
    for (const bad of ['', 'http://script.google.com/macros/s/' + id + '/exec', `https://evil.example/macros/s/${id}/exec`, `https://script.google.com/macros/s/${id}/dev`, `https://script.google.com/macros/s/short/exec`]) {
      expect(isEndpoint(bad), bad).toBe(false);
      expect(() => deploymentIdOf(bad)).toThrow('رابط الخدمة غير صحيح');
    }
    expect(() => endpointOf('../x')).toThrow('غير صالح');
  });
});
