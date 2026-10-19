import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaults';
import { useStore } from './store';
import { makeExport, migrateProject, parseExport, validateProject } from './migrate';
import { chooseAlt, decisionNumber, fillAgenda, newMeeting, recordDecision, setStatus } from './actions';
import { produce } from 'immer';
import type { Project } from '../types';

const get = () => useStore.getState();

beforeEach(async () => {
  await get().init();
  await get().newProject();
});

describe('الحفظ والتراجع', () => {
  it('يحفظ التعديل محليًا ويستعيده بعد إعادة التحميل', async () => {
    get().setVar('monthly_contribution', 175);
    get().update((d) => void (d.name = 'مشروع تجريبي'));
    await get().flush();
    const id = get().project.id;
    // محاكاة إعادة فتح الصفحة
    await get().init();
    expect(get().project.id).toBe(id);
    expect(get().project.vars.monthly_contribution).toBe(175);
    expect(get().project.name).toBe('مشروع تجريبي');
  });

  it('التراجع والإعادة يعملان ويدمجان تعديلات الحقل الواحد المتتابعة', () => {
    get().setVar('monthly_contribution', 1);
    get().setVar('monthly_contribution', 12);
    get().setVar('monthly_contribution', 120);
    expect(get().past).toHaveLength(1);
    get().undo();
    expect(get().project.vars.monthly_contribution).toBeNull();
    get().redo();
    expect(get().project.vars.monthly_contribution).toBe(120);
  });

  it('إنشاء مشروع جديد واستنساخ مشروع قائم وتبديل بينهما', async () => {
    get().update((d) => void (d.name = 'الأول'));
    await get().flush();
    const before = get().projects.length;
    await get().cloneProject();
    expect(get().project.name).toContain('نسخة من الأول');
    expect(get().projects).toHaveLength(before + 1);
    const first = get().projects.find((m) => m.name === 'الأول')!;
    await get().switchProject(first.id);
    expect(get().project.name).toBe('الأول');
  });

  it('إعادة الضبط تنشئ نسخة احتياطية أولًا ويمكن التراجع عنها', async () => {
    get().setVar('monthly_contribution', 99);
    await get().resetProject();
    expect(get().project.vars.monthly_contribution).toBeNull();
    expect(get().backups.some((b) => b.label === 'قبل إعادة الضبط')).toBe(true);
    get().undo();
    expect(get().project.vars.monthly_contribution).toBe(99);
  });

  it('استعادة نسخة احتياطية تعيد الحالة السابقة', async () => {
    get().setVar('subscription_years', 7);
    await get().createBackup('نقطة');
    const bk = get().backups.find((b) => b.label === 'نقطة')!;
    get().setVar('subscription_years', 3);
    await get().restoreBackup(bk.id);
    expect(get().project.vars.subscription_years).toBe(7);
  });
});

describe('التصدير والاستيراد', () => {
  it('تصدير JSON ثم استيراده يعيد المشروع كاملًا كمشروع جديد', async () => {
    get().setVar('monthly_contribution', 150);
    get().update((d) => setStatus(d, 'MEM-01', 'approved'));
    const text = JSON.stringify(makeExport(get().project));
    const before = get().project;
    await get().importProject(text);
    expect(get().project.id).not.toBe(before.id);
    expect(get().project.vars.monthly_contribution).toBe(150);
    expect(get().project.clauses.find((c) => c.id === 'MEM-01')!.status).toBe('approved');
    expect(get().projects.length).toBeGreaterThanOrEqual(2);
  });

  it('يرفض الملفات الفاسدة وغير المتوافقة برسائل واضحة', () => {
    expect(() => parseExport('{ليس json')).toThrow('JSON');
    expect(() => parseExport(JSON.stringify({ kind: 'other' }))).toThrow('ليس نسخة');
    const good = makeExport(createDefaultProject());
    const newer = { ...good, project: { ...good.project, schemaVersion: 999 } };
    expect(() => parseExport(JSON.stringify(newer))).toThrow('إصدار أحدث');
    const broken = JSON.parse(JSON.stringify(good));
    broken.project.clauses[0].status = 'weird';
    expect(() => parseExport(JSON.stringify(broken))).toThrow('حالة البند');
    const noScen = JSON.parse(JSON.stringify(good));
    delete noScen.project.scenarios;
    expect(() => parseExport(JSON.stringify(noScen))).toThrow('السيناريوهات');
    expect(() => validateProject(null)).toThrow();
  });

  it('الترحيل يكمل البنود والمتغيرات المستحدثة دون المساس بقرارات المستخدم', () => {
    const p = createDefaultProject();
    const old = produce(p, (d) => {
      d.clauses = d.clauses.filter((c) => c.id !== 'END-20');
      d.clauses.find((c) => c.id === 'MEM-01')!.status = 'approved';
      delete (d.vars as Record<string, unknown>).late_suspend_months;
      delete (d as unknown as Record<string, unknown>).confirmations;
      delete (d as unknown as Record<string, unknown>).loanLedger;
    });
    const m = migrateProject(old);
    expect(m.clauses.some((c) => c.id === 'END-20')).toBe(true);
    expect(m.clauses.find((c) => c.id === 'MEM-01')!.status).toBe('approved');
    expect('late_suspend_months' in m.vars).toBe(true);
    expect(m.confirmations).toEqual({});
    expect(m.loanLedger).toEqual([]);
  });
});

describe('الاجتماعات والقرارات', () => {
  const run = (fn: (d: Project) => void): void => get().update(fn);

  it('تسجيل قرار يعتمد البديل ويرقّم القرار ويربطه بالبند ويظهر في المحضر', () => {
    let meetingId = '';
    run((d) => {
      meetingId = newMeeting(d);
      fillAgenda(d, meetingId);
    });
    const m = get().project.meetings[0];
    const item = m.agenda.find((a) => a.clauseId === 'SUB-03')!;
    expect(item).toBeTruthy();
    run((d) => void recordDecision(d, meetingId, item.id, { kind: 'adopt_alt', altId: 'b', rationale: 'اتفقنا', reservations: 'تحفظ أحد الأعضاء', owner: 'أمين السر', dueDate: '2027-01-01' }));
    const p = get().project;
    const c = p.clauses.find((x) => x.id === 'SUB-03')!;
    expect(c.status).toBe('approved');
    expect(c.selectedAlt).toBe('b');
    expect(c.rationale).toBe('اتفقنا');
    expect(c.decisionDate).toBe(p.meetings[0].date);
    expect(p.vars.duration_mode).toBe('by_gender'); // طُبقت قيم البديل
    const dec = p.meetings[0].decisions[0];
    expect(dec.number).toBe(1);
    expect(decisionNumber(dec.number)).toBe('ق-001');
    expect(dec.reservations).toBe('تحفظ أحد الأعضاء');
    expect(c.meetingDecisionId).toBe(dec.id);
  });

  it('لا يعتمد أي قرار جوهري تلقائيًا: فتح الاجتماع وتجهيز الجدول لا يغيّر الحالات', () => {
    run((d) => {
      const id = newMeeting(d);
      fillAgenda(d, id);
    });
    expect(get().project.clauses.every((c) => c.status === 'discuss')).toBe(true);
  });

  it('التأجيل والاستبعاد ينعكسان على حالة البند، وتغيير البديل يُسقط الاعتماد', () => {
    run((d) => {
      const id = newMeeting(d);
      fillAgenda(d, id);
    });
    const m = get().project.meetings[0];
    const a1 = m.agenda.find((a) => a.clauseId === 'LON-13')!;
    const a2 = m.agenda.find((a) => a.clauseId === 'FIN-14')!;
    run((d) => {
      recordDecision(d, m.id, a1.id, { kind: 'postpone', rationale: 'نؤجل', reservations: '', owner: '', dueDate: '' });
      recordDecision(d, m.id, a2.id, { kind: 'exclude', rationale: 'غير لازم', reservations: '', owner: '', dueDate: '' });
    });
    expect(get().project.clauses.find((c) => c.id === 'LON-13')!.status).toBe('postponed');
    expect(get().project.clauses.find((c) => c.id === 'FIN-14')!.status).toBe('excluded');
    run((d) => {
      setStatus(d, 'SUB-02', 'approved');
      chooseAlt(d, 'SUB-02', 'c');
    });
    expect(get().project.clauses.find((c) => c.id === 'SUB-02')!.status).toBe('discuss');
    expect(get().project.vars.monthly_contribution).toBe(200);
  });
});
