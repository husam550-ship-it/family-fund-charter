import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import registrationScript from '../../registration/Code.gs?raw';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { attempt, confirmAction, toast } from '../lib/ui';
import { go } from '../lib/nav';
import { hasMissingMark, resolveText } from '../engine/context';
import { isUniform } from '../engine/subscriptions';
import { money, num } from '../lib/format';
import { deploymentIdOf, isEndpoint, joinLinkOf } from '../registration/link';
import { listAll, publishConfig, removeRecord } from '../registration/api';
import type { RegConfig, RegRecord } from '../registration/api';
import { applyGroupChanges, planGroupChanges, summarize } from '../registration/aggregate';
import { Badge, Callout, Card, SectionHead, Stat, Tabs } from '../components/ui';
import { Check, Field, NumInput, TextArea } from '../components/fields';
import { QrCode } from '../components/QrCode';

const KEY_STORE = 'ffc-registration-admin-key';
const REFRESH_MS = 20_000;

const readKey = (): string => {
  try {
    return window.localStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
};

const NumberList = ({ label, unit, values, onChange }: { label: string; unit: string; values: number[]; onChange: (v: number[]) => void }) => {
  const [draft, setDraft] = useState<number | null>(null);
  const add = (): void => {
    if (draft == null || draft <= 0 || values.includes(draft)) return;
    onChange([...values, draft].sort((a, b) => a - b));
    setDraft(null);
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && <span className="hint">لا خيارات؛ سيكتب المشارك رقمه بنفسه.</span>}
        {values.map((v) => (
          <span key={v} className="badge bg-brand-50 text-brand-800">
            {num(v)} {unit}
            <button aria-label={`حذف ${num(v)} ${unit}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <NumInput value={draft} onChange={setDraft} min={0} ariaLabel={`إضافة خيار: ${label}`} className="w-28" />
        <button className="btn btn-soft btn-sm" onClick={add}>
          إضافة
        </button>
      </div>
    </div>
  );
};

const Steps = () => (
  <ol className="list-decimal space-y-2 ps-6 text-sm leading-relaxed">
    <li>
      أنشئ جدول <b>Google Sheets</b> جديدًا في حسابك، ثم من القائمة: <b>الإضافات ← Apps Script</b>.
    </li>
    <li>
      احذف الشيفرة الموجودة والصق الشيفرة التالية كاملة ثم احفظ:{' '}
      <button className="btn btn-soft btn-sm" onClick={() => void attempt(() => navigator.clipboard.writeText(registrationScript), 'نُسخت الشيفرة.')}>
        نسخ الشيفرة
      </button>
    </li>
    <li>
      من <b>إعدادات المشروع ← خصائص النص البرمجي</b> أضف خاصية اسمها <code className="ltr">ADMIN_KEY</code> وقيمتها كلمة سر طويلة تختارها (12 حرفًا فأكثر). هذه كلمة الإدارة فلا تشاركها.
    </li>
    <li>
      اضغط <b>نشر ← عملية نشر جديدة</b>، النوع: <b>تطبيق ويب</b>. نفّذ باسم: <b>أنا</b>. من لديه حق الوصول: <b>أي شخص</b>. ثم انسخ «عنوان URL لتطبيق الويب».
    </li>
    <li>الصق العنوان وكلمة الإدارة في الخطوة التالية.</li>
  </ol>
);

export default function Registration() {
  const { project, ctx } = useDerived();
  const update = useStore((s) => s.update);
  const reg = project.registration;
  const [tab, setTab] = useState<'setup' | 'records'>('setup');
  const [adminKey, setAdminKey] = useState(readKey);
  const [records, setRecords] = useState<RegRecord[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);

  const endpointOk = isEndpoint(reg.endpoint);
  const deployment = endpointOk ? deploymentIdOf(reg.endpoint) : null;
  const link = deployment ? joinLinkOf(deployment) : null;
  const ready = deployment != null && adminKey.length > 0;

  const setKey = (v: string): void => {
    setAdminKey(v);
    try {
      window.localStorage.setItem(KEY_STORE, v);
    } catch {
      toast('تعذر حفظ كلمة الإدارة في هذا المتصفح؛ ستحتاج إلى إدخالها كل مرة.', 'error');
    }
  };

  const config = (): RegConfig => {
    const title = resolveText('{{charter_name}}', ctx);
    const fundName = resolveText('{{fund_name}}', ctx);
    if (hasMissingMark(title) || hasMissingMark(fundName)) throw new Error('أكمل اسم الميثاق واسم الصندوق في قسم الهوية قبل النشر.');
    return {
      title,
      fundName,
      intro: resolveText(reg.intro, ctx),
      amounts: reg.amounts,
      years: reg.years,
      branches: project.branches.map((b) => b.name.trim()).filter(Boolean),
      allowOneTime: reg.allowOneTime,
      open: reg.open,
    };
  };

  const publish = (): Promise<boolean> =>
    attempt(async () => {
      if (!deployment) throw new Error('أدخل رابط الخدمة الصحيح أولًا.');
      await publishConfig(deployment, adminKey, config());
    }, 'نُشرت إعدادات النموذج؛ ما يفتحه المشاركون الآن هو هذه النسخة.');

  const refresh = useCallback(async (): Promise<void> => {
    if (!deployment) return;
    setLoading(true);
    try {
      const res = await listAll(deployment, adminKey);
      setRecords(res.records);
      setLoadedAt(new Date().toLocaleTimeString('ar-SA-u-nu-latn'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [deployment, adminKey]);

  useEffect(() => {
    if (tab !== 'records' || !ready) return;
    void refresh();
    if (!auto) return;
    const t = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [tab, ready, auto, refresh]);

  const summary = records ? summarize(records) : null;
  const changes = records ? planGroupChanges(project, records) : [];

  const remove = async (r: RegRecord): Promise<void> => {
    if (!deployment) return;
    if (!(await confirmAction({ title: 'حذف التسجيل', message: `سيُحذف تسجيل «${r.name || r.id}» من الجدول نهائيًا.`, confirmLabel: 'حذف', danger: true }))) return;
    if (await attempt(() => removeRecord(deployment, adminKey, r.id), 'حُذف التسجيل.')) await refresh();
  };

  const apply = async (): Promise<void> => {
    const lines = changes.map((c) => `• ${c.name}: العدد ${c.before.target ?? '—'} ← ${c.after.target}، المبلغ ${c.before.monthlyAmount ?? '—'} ← ${c.after.monthlyAmount}، المدة ${c.before.years ?? '—'} ← ${c.after.years ?? '—'}`);
    const note = isUniform(project)
      ? '\n\nتنبيه: نموذج مدة الاشتراك الحالي «موحد»، فتُحتسب كل الفئات بالمبلغ والمدة العامين، ولا يؤثر على الحساب هنا سوى العدد. لاستعمال مبلغ ومدة كل فئة غيّر النموذج من قسم الاشتراكات.'
      : '';
    const ok = await confirmAction({
      title: 'تطبيق التسجيلات على فئات الاشتراك',
      message: `${lines.join('\n')}\n\nالمبلغ والمدة متوسطان للملتزمين في كل فئة (تقريب، لأن الفئة تُحسب بمبلغ ومدة واحدين). ما لم يُسجَّل من الأعداد سيُستبدل بهذه الأرقام.${note}`,
      confirmLabel: 'تطبيق',
    });
    if (!ok) return;
    update((d) => applyGroupChanges(d, changes));
    toast('طُبّقت التسجيلات على فئات الاشتراك.');
  };

  return (
    <div className="space-y-6">
      <SectionHead
        num="19 / تسجيل المشاركين والتزاماتهم"
        title="تسجيل المشاركين والتزاماتهم"
        sub="رابط يفتحه أفراد العائلة على هواتفهم: يسجلون بياناتهم الأساسية ثم يظهر لهم اختيار الالتزام، ويُحفظ ما يدخلونه مباشرة في جدول Google Sheets الخاص بك."
      />

      <Callout tone="gold" title="الخصوصية وحدود الالتزام">
        بيانات المشاركين تُحفظ في جدولك على Google، وليس في هذه المنصة ولا في المستودع ولا في نسخ المشروع الاحتياطية. والاشتراك المسجَّل هنا تعبير عن الرغبة لأغراض التخطيط، وليس التزامًا نظاميًا ولا تحصيلًا للمال.
      </Callout>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'setup', label: 'الإعداد والرابط' },
          { id: 'records', label: 'التسجيلات', badge: records?.length },
        ]}
      />

      {tab === 'setup' && (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 text-lg">١. تجهيز الخدمة (مرة واحدة)</h2>
            <Steps />
          </Card>

          <Card>
            <h2 className="mb-3 text-lg">٢. ربط الخدمة</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="عنوان تطبيق الويب (ينتهي بـ /exec)" hint={reg.endpoint && !endpointOk ? 'الرابط غير صحيح: يجب أن يبدأ بـ https://script.google.com/macros/s/ وينتهي بـ /exec' : undefined}>
                <input
                  className="input ltr text-end"
                  aria-label="عنوان تطبيق الويب"
                  value={reg.endpoint}
                  placeholder="https://script.google.com/macros/s/…/exec"
                  onChange={(e) => update((d) => void (d.registration.endpoint = e.target.value.trim()), 'reg-endpoint')}
                />
              </Field>
              <Field label="كلمة الإدارة (ADMIN_KEY)" hint="تُحفظ في هذا المتصفح فقط، ولا تدخل في ملفات المشروع ولا النسخ الاحتياطية.">
                <input className="input ltr text-end" type="password" aria-label="كلمة الإدارة" value={adminKey} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg">٣. إعداد النموذج</h2>
            <div className="space-y-4">
              <Field
                label="رسالة ترحيب تظهر للمشارك"
                hint={
                  <>
                    يمكن أن تحوي متغيرات مثل <code className="ltr">{'{{charter_name}}'}</code>.
                  </>
                }
              >
                <TextArea rows={4} ariaLabel="رسالة الترحيب" value={reg.intro} onChange={(v) => update((d) => void (d.registration.intro = v), 'reg-intro')} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberList label="خيارات الاشتراك الشهري المقترحة" unit="ريال" values={reg.amounts} onChange={(v) => update((d) => void (d.registration.amounts = v))} />
                <NumberList label="خيارات مدة الالتزام المقترحة" unit="سنة" values={reg.years} onChange={(v) => update((d) => void (d.registration.years = v))} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Check checked={reg.allowOneTime} onChange={(v) => update((d) => void (d.registration.allowOneTime = v))} label="اسأل عن مساهمة تأسيسية لمرة واحدة (اختياري للمشارك)" />
                <Check checked={reg.open} onChange={(v) => update((d) => void (d.registration.open = v))} label="استقبال التسجيلات مفتوح" />
              </div>
              <p className="hint">
                فروع العائلة التي يختار منها المشارك تُؤخذ من قسم «نطاق الذرية والعضوية»: {project.branches.length > 0 ? `${num(project.branches.length)} فرع` : 'لا فروع مدخلة، فسيكتب المشارك فرعه بنفسه'}.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-primary" disabled={!ready} onClick={() => void publish()}>
                  نشر إعدادات النموذج
                </button>
                {!ready && <span className="hint">أدخل عنوان الخدمة وكلمة الإدارة أولًا.</span>}
                <span className="hint">أعد النشر بعد أي تعديل في هذه الإعدادات أو في اسم الميثاق.</span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg">٤. رابط التسجيل للعائلة</h2>
            {link ? (
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <input className="input ltr text-end" readOnly aria-label="رابط التسجيل" value={link} onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={() => void attempt(() => navigator.clipboard.writeText(link), 'نُسخ الرابط.')}>
                      نسخ الرابط
                    </button>
                    <a className="btn btn-soft" href={link} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" /> فتح الصفحة
                    </a>
                  </div>
                  <p className="hint">يحوي الرابط معرّف الخدمة فقط؛ لا بيانات ولا كلمة إدارة. أرسله في مجموعة العائلة، أو اعرض رمز QR في الاجتماع (يظهر أيضًا في شريحة «ما المطلوب منك؟»).</p>
                </div>
                <QrCode value={link} size={168} label="رمز QR لرابط التسجيل" />
              </div>
            ) : (
              <p className="text-sm text-mute">يظهر الرابط بعد إدخال عنوان الخدمة الصحيح في الخطوة ٢.</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'records' && (
        <div className="space-y-5">
          {!ready ? (
            <Callout tone="warn">أدخل عنوان الخدمة وكلمة الإدارة في تبويب «الإعداد والرابط» لعرض التسجيلات.</Callout>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-soft" onClick={() => void refresh()} disabled={loading}>
                  <RefreshCw className="size-4" /> تحديث
                </button>
                <Check checked={auto} onChange={setAuto} label="تحديث تلقائي كل 20 ثانية" />
                {loadedAt && <span className="hint">آخر تحديث: {loadedAt}</span>}
              </div>
              {error && (
                <Callout tone="bad" title="تعذر جلب التسجيلات">
                  {error}
                </Callout>
              )}
              {summary && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="المسجلون" value={num(summary.total)} sub={`أكمل ${num(summary.complete)}`} />
                    <Stat label="ملتزمون بمبلغ شهري" value={num(summary.committed)} sub={`${num(summary.male)} ذكر · ${num(summary.female)} أنثى (كل المسجلين)`} />
                    <Stat label="إجمالي الاشتراك الشهري المعلن" value={money(summary.monthlyTotal)} sub={summary.monthlyAvg != null ? `المتوسط ${money(summary.monthlyAvg)}` : undefined} />
                    <Stat label="إجمالي الالتزام على المدة" value={money(summary.lifetimeTotal)} sub={`مساهمات مرة واحدة: ${money(summary.oneTimeTotal)}`} />
                  </div>
                  <p className="hint">كلها أرقام معلنة بالرغبة، وليست أموالًا محصّلة. المتطوعون للعمل: {num(summary.volunteers)}.</p>

                  {summary.byBranch.length > 0 && (
                    <Card>
                      <h2 className="mb-2 text-lg">بحسب الفرع</h2>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-brand-50 text-brand-900">
                            <th className="p-2 text-start">الفرع</th>
                            <th className="p-2 text-start">الملتزمون</th>
                            <th className="p-2 text-start">الاشتراك الشهري</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.byBranch.map((b) => (
                            <tr key={b.name} className="border-t border-line">
                              <td className="p-2">{b.name}</td>
                              <td className="p-2">{num(b.count)}</td>
                              <td className="p-2">{money(b.monthly)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  <Card>
                    <h2 className="mb-2 text-lg">التسجيلات</h2>
                    {records && records.length === 0 ? (
                      <p className="text-sm text-mute">لا تسجيلات بعد.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[56rem] text-sm">
                          <thead>
                            <tr className="bg-brand-50 text-brand-900">
                              {['الاسم', 'الجنس', 'الفرع', 'المدينة', 'الجوال', 'الشهري', 'المدة', 'مرة واحدة', 'الحالة', 'آخر تحديث', ''].map((h) => (
                                <th key={h} className="p-2 text-start">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {records?.map((r) => (
                              <tr key={r.id} className="border-t border-line align-top">
                                <td className="p-2 font-semibold">{r.name || '—'}</td>
                                <td className="p-2">{r.gender === 'male' ? 'ذكر' : r.gender === 'female' ? 'أنثى' : '—'}</td>
                                <td className="p-2">{r.branch || '—'}</td>
                                <td className="p-2">{r.city || '—'}</td>
                                <td className="ltr p-2 text-end">{r.phone || '—'}</td>
                                <td className="p-2">{r.monthly != null ? money(r.monthly) : '—'}</td>
                                <td className="p-2">{r.years != null ? `${num(r.years)} سنة` : '—'}</td>
                                <td className="p-2">{r.oneTime != null ? money(r.oneTime) : '—'}</td>
                                <td className="p-2">{r.complete ? <Badge tone="ok">مكتمل</Badge> : <Badge tone="warn">غير مكتمل</Badge>}</td>
                                <td className="p-2 text-xs text-mute">{new Date(r.updatedAt).toLocaleString('ar-SA-u-ca-gregory-nu-latn')}</td>
                                <td className="p-2">
                                  <button className="btn btn-ghost btn-sm" aria-label={`حذف تسجيل ${r.name || r.id}`} onClick={() => void remove(r)}>
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <Card>
                    <h2 className="mb-1 text-lg">استعمال التسجيلات في الخطة المالية</h2>
                    <p className="mb-3 text-sm text-mute">يحسب لكل فئة (بحسب الجنس) عدد الملتزمين ومتوسط مبلغهم ومدتهم، ثم يضعها في فئات الاشتراك بعد تأكيدك. لا تُحفظ أسماء المشاركين في المشروع.</p>
                    {changes.length === 0 ? (
                      <p className="text-sm text-mute">لا ملتزمين مكتملين بعد.</p>
                    ) : (
                      <>
                        <table className="mb-3 w-full text-sm">
                          <thead>
                            <tr className="bg-brand-50 text-brand-900">
                              <th className="p-2 text-start">الفئة</th>
                              <th className="p-2 text-start">العدد</th>
                              <th className="p-2 text-start">متوسط الشهري</th>
                              <th className="p-2 text-start">متوسط المدة (سنة)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((c) => (
                              <tr key={c.id} className="border-t border-line">
                                <td className="p-2">{c.name}</td>
                                <td className="p-2">{num(c.after.target ?? 0)}</td>
                                <td className="p-2">{money(c.after.monthlyAmount)}</td>
                                <td className="p-2">{c.after.years != null ? num(c.after.years, 1) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-primary" onClick={() => void apply()}>
                            تطبيق على فئات الاشتراك
                          </button>
                          <button className="btn btn-soft" onClick={() => go('subscriptions')}>
                            فتح قسم الاشتراكات
                          </button>
                        </div>
                      </>
                    )}
                  </Card>
                </>
              )}
              {!summary && !error && <p className="text-sm text-mute">جارٍ التحميل…</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
