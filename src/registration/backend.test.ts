import { describe, expect, it } from 'vitest';
import { createBackend } from '../../registration/harness.mjs';
import type { Backend } from '../../registration/harness.mjs';

const KEY = 'test-admin-key-123';
const CONFIG = { title: 'ميثاق تجريبي', fundName: 'صندوق تجريبي', intro: 'أهلًا', amounts: [100, 200], years: [5, 10], branches: ['فرع أ', 'فرع ب'], allowOneTime: true, open: true };
const ID = 'participant-001';
const TOKEN = 'secret-token-0123456789';
const DATA = { name: 'فلان بن فلان الفلاني', gender: 'male', branch: 'فرع أ', birthYear: 1985, city: 'الرياض', phone: '+966500000000', monthly: 200, years: 10, oneTime: 500, volunteer: true, notes: 'ملاحظة', complete: true };

const save = (b: Backend, data: Record<string, unknown> = DATA, over: Record<string, unknown> = {}) =>
  b.post({ action: 'save', id: ID, token: TOKEN, consent: true, data, ...over });
const published = (config: Record<string, unknown> = CONFIG): Backend => {
  const b = createBackend();
  expect(b.post({ action: 'setConfig', key: KEY, config })).toEqual({ ok: true });
  return b;
};

describe('خدمة التسجيل (Code.gs)', () => {
  it('الإعدادات: تُنشر بمفتاح الإدارة فقط ويقرؤها الجميع', () => {
    const b = createBackend();
    expect(b.get({ action: 'config' })).toEqual({ ok: true, config: null });
    expect(b.post({ action: 'setConfig', key: 'wrong-key-wrong-key', config: CONFIG })).toEqual({ ok: false, error: 'unauthorized' });
    expect(b.post({ action: 'setConfig', key: KEY, config: CONFIG })).toEqual({ ok: true });
    expect(b.get({ action: 'config' })).toEqual({ ok: true, config: CONFIG });
  });

  it('لا تعمل أوامر الإدارة إن لم يُضبط ADMIN_KEY أو كان قصيرًا', () => {
    expect(createBackend({ adminKey: null }).post({ action: 'setConfig', key: 'anything-at-all-123', config: CONFIG })).toEqual({ ok: false, error: 'admin_key_not_set' });
    expect(createBackend({ adminKey: 'short' }).post({ action: 'list', key: 'short' })).toEqual({ ok: false, error: 'admin_key_not_set' });
  });

  it('يرفض إعدادات غير صالحة', () => {
    const b = createBackend();
    for (const bad of [{ ...CONFIG, title: '' }, { ...CONFIG, amounts: [0] }, { ...CONFIG, amounts: Array(13).fill(100) }, { ...CONFIG, branches: [''] }, { ...CONFIG, intro: 'ا'.repeat(1501) }]) {
      expect(b.post({ action: 'setConfig', key: KEY, config: bad })).toEqual({ ok: false, error: 'invalid' });
    }
  });

  it('لا يُقبل حفظ قبل نشر الإعدادات أو بعد إغلاق التسجيل', () => {
    const b = createBackend();
    expect(save(b)).toEqual({ ok: false, error: 'closed' });
    b.post({ action: 'setConfig', key: KEY, config: CONFIG });
    expect(save(b).ok).toBe(true);
    b.post({ action: 'setConfig', key: KEY, config: { ...CONFIG, open: false } });
    expect(save(b)).toEqual({ ok: false, error: 'closed' });
  });

  it('يشترط الموافقة وهوية صالحة', () => {
    const b = published();
    expect(save(b, DATA, { consent: false })).toEqual({ ok: false, error: 'invalid' });
    expect(save(b, DATA, { consent: undefined })).toEqual({ ok: false, error: 'invalid' });
    expect(save(b, DATA, { id: 'x' })).toEqual({ ok: false, error: 'invalid' });
    expect(save(b, DATA, { token: 'short' })).toEqual({ ok: false, error: 'invalid' });
    expect(b.rows()).toHaveLength(0);
  });

  it('يتحقق من الحقول ويرفض الطلب كاملًا عند أي مخالفة', () => {
    const b = published();
    const bad: Record<string, unknown>[] = [
      { ...DATA, name: 'أ'.repeat(81) },
      { ...DATA, gender: 'other' },
      { ...DATA, monthly: -1 },
      { ...DATA, monthly: '200' },
      { ...DATA, years: 101 },
      { ...DATA, birthYear: 1985.5 },
      { ...DATA, phone: 'اتصل بي' },
      { ...DATA, volunteer: 'yes' },
      { ...DATA, notes: 'ن'.repeat(1001) },
      null as unknown as Record<string, unknown>,
    ];
    for (const data of bad) expect(save(b, data)).toEqual({ ok: false, error: 'invalid' });
    expect(b.rows()).toHaveLength(0);
  });

  it('يحفظ تسجيلًا جديدًا ثم يحدّثه في الصف نفسه، ويخزّن بصمة الرمز لا الرمز', () => {
    const b = published();
    const first = save(b);
    expect(first.ok).toBe(true);
    expect(b.rows()).toHaveLength(2); // العنوان + المشارك
    const row = b.rows()[1];
    expect(row[0]).toBe(ID);
    expect(row[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(row).not.toContain(TOKEN);

    const created = b.rows()[1][2];
    expect(save(b, { ...DATA, monthly: 300 }).ok).toBe(true);
    expect(b.rows()).toHaveLength(2);
    expect(b.rows()[1][2]).toBe(created);
    const got = b.post({ action: 'get', id: ID, token: TOKEN }) as { record: Record<string, unknown> };
    expect(got.record).toMatchObject({ id: ID, name: DATA.name, gender: 'male', birthYear: 1985, monthly: 300, years: 10, oneTime: 500, volunteer: true, complete: true, phone: '+966500000000' });
    expect(got.record).not.toHaveProperty('tokenHash');
  });

  it('القيم غير المحددة تعود null والحقول الاختيارية الفارغة نصًا فارغًا', () => {
    const b = published();
    save(b, { name: 'فلان الفلاني', complete: false });
    const { record } = b.post({ action: 'get', id: ID, token: TOKEN }) as { record: Record<string, unknown> };
    expect(record).toMatchObject({ name: 'فلان الفلاني', gender: '', branch: '', birthYear: null, monthly: null, years: null, oneTime: null, volunteer: false, complete: false });
  });

  it('لا يقرأ أو يعدّل تسجيل غيره', () => {
    const b = published();
    save(b);
    expect(b.post({ action: 'get', id: ID, token: 'another-token-0123456789' })).toEqual({ ok: false, error: 'forbidden' });
    expect(save(b, DATA, { token: 'another-token-0123456789' })).toEqual({ ok: false, error: 'forbidden' });
    expect(b.post({ action: 'get', id: 'participant-404', token: TOKEN })).toEqual({ ok: false, error: 'not_found' });
    expect(b.post({ action: 'removeOwn', id: ID, token: 'another-token-0123456789' })).toEqual({ ok: false, error: 'forbidden' });
    expect(b.rows()).toHaveLength(2);
  });

  it('القائمة الكاملة بمفتاح الإدارة فقط وبلا بصمات', () => {
    const b = published();
    save(b);
    save(b, { ...DATA, name: 'آخر الآخر' }, { id: 'participant-002', token: 'second-token-0123456789' });
    expect(b.post({ action: 'list' })).toEqual({ ok: false, error: 'unauthorized' });
    expect(b.post({ action: 'list', key: 'wrong-key-wrong-key' })).toEqual({ ok: false, error: 'unauthorized' });
    const res = b.post({ action: 'list', key: KEY }) as { records: Record<string, unknown>[]; config: unknown };
    expect(res.records.map((r) => r.name)).toEqual([DATA.name, 'آخر الآخر']);
    expect(res.records.every((r) => !('tokenHash' in r))).toBe(true);
    expect(res.config).toEqual(CONFIG);
  });

  it('الحذف: للمشارك لتسجيله، وللمدير لأي تسجيل، ويبقى متاحًا بعد الإغلاق', () => {
    const b = published();
    save(b);
    save(b, DATA, { id: 'participant-002', token: 'second-token-0123456789' });
    b.post({ action: 'setConfig', key: KEY, config: { ...CONFIG, open: false } });
    expect(b.post({ action: 'removeOwn', id: ID, token: TOKEN })).toEqual({ ok: true });
    expect(b.post({ action: 'get', id: ID, token: TOKEN })).toEqual({ ok: false, error: 'not_found' });
    expect(b.post({ action: 'remove', key: 'wrong-key-wrong-key', id: 'participant-002' })).toEqual({ ok: false, error: 'unauthorized' });
    expect(b.post({ action: 'remove', key: KEY, id: 'participant-002' })).toEqual({ ok: true });
    expect(b.rows()).toHaveLength(1);
  });

  it('لا تتحول المدخلات إلى معادلات في الجدول', () => {
    const b = published();
    save(b, { ...DATA, name: '=HYPERLINK("http://evil.example","اضغط")', notes: '+cmd|calc', city: '-1+1', branch: '@SUM(1)' });
    expect(b.stats.formulaCells).toBe(0);
    expect(b.sheet()?.textColumns.size).toBe(16);
    const { record } = b.post({ action: 'get', id: ID, token: TOKEN }) as { record: Record<string, string> };
    expect(record.name).toBe('=HYPERLINK("http://evil.example","اضغط")');
  });

  it('يرفض تجاوز الحد الأقصى للتسجيلات', () => {
    const b = published();
    for (let i = 0; i < 2000; i++) {
      expect(save(b, DATA, { id: `participant-${String(i).padStart(5, '0')}`, token: `token-${String(i).padStart(18, '0')}` }).ok).toBe(true);
    }
    expect(save(b, DATA, { id: 'participant-extra', token: 'token-extra-0123456789' })).toEqual({ ok: false, error: 'full' });
    // وتحديث تسجيل قائم ما زال ممكنًا
    expect(save(b, DATA, { id: 'participant-00000', token: 'token-000000000000000000' }).ok).toBe(true);
  });

  it('أخطاء الطلب: إجراء مجهول أو جسم غير JSON', () => {
    const b = published();
    expect(b.get({ action: 'nope' })).toEqual({ ok: false, error: 'unknown_action' });
    // الأوامر التي تحمل أسرارًا لا تُقبل عبر GET
    expect(b.get({ action: 'list', key: KEY })).toEqual({ ok: false, error: 'unknown_action' });
    expect(b.get({ action: 'get', id: ID, token: TOKEN })).toEqual({ ok: false, error: 'unknown_action' });
    expect(b.post({ action: 'nope' })).toEqual({ ok: false, error: 'unknown_action' });
    expect(b.rawPost('{ليس json')).toEqual({ ok: false, error: 'invalid' });
    expect(b.rawPost('')).toEqual({ ok: false, error: 'invalid' });
  });

  it('كل قفل يُفتح مهما كانت النتيجة', () => {
    const b = published();
    save(b);
    save(b, null as unknown as Record<string, unknown>);
    save(b, DATA, { token: 'another-token-0123456789' });
    expect(b.stats.locks).toBe(b.stats.unlocks);
    expect(b.stats.locks).toBeGreaterThan(0);
  });
});
