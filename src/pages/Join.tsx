import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { ApiError, fetchConfig, fetchOwn, removeOwn, saveOwn } from '../registration/api';
import type { Gender, RegConfig, RegData } from '../registration/api';
import { isBasicComplete, isCommitmentComplete } from '../registration/rules';
import { Hosts, Badge, Callout, Card, cx } from '../components/ui';
import { Check, Field, NumInput, TextArea } from '../components/fields';
import { attempt, confirmAction } from '../lib/ui';
import { money, num } from '../lib/format';

// صفحة المشارك: رابط عام لا يحمل بيانات. تُحمَّل إعداداتها من خدمة التسجيل، ويُحفظ ما يدخله المشارك مباشرة.
// لا يُرسل شيء قبل الموافقة. هوية المشارك (معرّف ورمز سري) تُولَّد في متصفحه وتبقى فيه.

interface Own {
  id: string;
  token: string;
}

const EMPTY: RegData = {
  name: '',
  gender: '',
  branch: '',
  birthYear: null,
  city: '',
  phone: '',
  monthly: null,
  years: null,
  oneTime: null,
  volunteer: false,
  notes: '',
  complete: false,
};

const DEPLOYMENT_RE = /^[A-Za-z0-9_-]{20,}$/;
const OWN_RE = /^([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{16,64})$/;
const SAVE_DELAY_MS = 700;

const storeKey = (deployment: string): string => `ffc-join-${deployment}`;

const readOwn = (deployment: string): Own | null => {
  try {
    const raw = window.localStorage.getItem(storeKey(deployment));
    return raw ? (JSON.parse(raw) as Own) : null;
  } catch {
    return null;
  }
};

const writeOwn = (deployment: string, own: Own | null): boolean => {
  try {
    if (own) window.localStorage.setItem(storeKey(deployment), JSON.stringify(own));
    else window.localStorage.removeItem(storeKey(deployment));
    return true;
  } catch {
    return false;
  }
};

const random = (length: number): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => alphabet[b % alphabet.length]).join('');
};

const latinDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

type Mode = 'preset' | 'custom' | 'none';
const modeOf = (monthly: number | null, amounts: number[]): Mode | null =>
  monthly === null ? null : monthly === 0 ? 'none' : amounts.includes(monthly) ? 'preset' : 'custom';

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cx('rounded-xl border px-4 py-2 text-sm font-semibold', active ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-line bg-paper hover:border-brand-300')}
  >
    {children}
  </button>
);

export default function Join({ route }: { route: string }) {
  const [deployment, ownFromLink] = route.split('/');
  const validRoute = DEPLOYMENT_RE.test(deployment ?? '');

  const [config, setConfig] = useState<RegConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [own, setOwn] = useState<Own | null>(null);
  const [data, setData] = useState<RegData>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [monthlyMode, setMonthlyMode] = useState<Mode | null>(null);
  const [yearsCustom, setYearsCustom] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(true);
  const touched = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const chain = useRef<Promise<void>>(Promise.resolve());

  // تحميل الإعدادات ثم تسجيل هذا المتصفح إن وُجد
  useEffect(() => {
    if (!validRoute) return;
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchConfig(deployment);
        if (!cfg) throw new Error('لم تُنشر إعدادات النموذج بعد. تواصل مع القائمين على الميثاق.');
        let mine = readOwn(deployment);
        const fromLink = ownFromLink ? OWN_RE.exec(ownFromLink) : null;
        if (fromLink) {
          mine = { id: fromLink[1], token: fromLink[2] };
          writeOwn(deployment, mine);
        }
        let record: RegData | null = null;
        if (mine) {
          try {
            record = await fetchOwn(deployment, mine);
          } catch (e) {
            if (!(e instanceof ApiError && e.code === 'not_found')) throw e;
          }
        }
        if (cancelled) return;
        setConfig(cfg);
        setOwn(mine);
        if (record) {
          setData(record);
          setConsent(true);
          setMonthlyMode(modeOf(record.monthly, cfg.amounts));
          setYearsCustom(record.years != null && !cfg.years.includes(record.years));
          setStatus('saved');
        }
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deployment, ownFromLink, validRoute]);

  const flush = useCallback((): void => {
    if (!own) return;
    chain.current = chain.current.then(async () => {
      setStatus('saving');
      try {
        const payload = { ...latest.current, complete: isCommitmentComplete(latest.current) };
        await saveOwn(deployment, own, payload);
        setStatus('saved');
        setSaveError(null);
        setSavedAt(new Date().toLocaleTimeString('ar-SA-u-nu-latn'));
      } catch (e) {
        setStatus('error');
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    });
  }, [deployment, own]);

  // حفظ مباشر بعد كل تعديل (بتأخير قصير لتجميع الكتابة)
  useEffect(() => {
    if (!touched.current || !consent || !own || data.name.trim().length < 3) return;
    setStatus('pending');
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [data, consent, own, flush]);

  const edit = (patch: Partial<RegData>): void => {
    touched.current = true;
    setData((d) => ({ ...d, ...patch }));
  };

  const agree = (): void => {
    const mine = { id: random(16), token: random(24) };
    setPersisted(writeOwn(deployment, mine));
    setOwn(mine);
    setConsent(true);
    touched.current = true;
  };

  const remove = async (): Promise<void> => {
    if (!own) return;
    if (!(await confirmAction({ title: 'حذف تسجيلي', message: 'سيُحذف تسجيلك وكل ما أدخلته من جدول الميثاق نهائيًا. هل تريد المتابعة؟', confirmLabel: 'حذف تسجيلي', danger: true }))) return;
    if (!(await attempt(() => removeOwn(deployment, own), 'حُذف تسجيلك.'))) return;
    writeOwn(deployment, null);
    touched.current = false;
    setOwn(null);
    setConsent(false);
    setData(EMPTY);
    setMonthlyMode(null);
    setYearsCustom(false);
    setStatus('idle');
  };

  const personalLink = own ? `${window.location.href.split('#')[0]}#/join/${deployment}/${own.id}.${own.token}` : null;

  if (!validRoute) {
    return (
      <Shell title="رابط غير صحيح">
        <Callout tone="bad">رابط التسجيل غير مكتمل. اطلب الرابط من القائمين على الميثاق.</Callout>
      </Shell>
    );
  }
  if (loadError) {
    return (
      <Shell title="تعذر فتح صفحة التسجيل">
        <Callout tone="bad">{loadError}</Callout>
        <button className="btn btn-soft mt-3" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </button>
      </Shell>
    );
  }
  if (!config) {
    return (
      <Shell title="جارٍ التحميل…">
        <p className="text-mute" role="status">
          جارٍ فتح صفحة التسجيل…
        </p>
      </Shell>
    );
  }

  const basicOk = isBasicComplete(data);
  const closed = !config.open;
  const total = data.monthly && data.years ? data.monthly * 12 * data.years : null;
  const chip = status === 'saved' ? { t: `تم الحفظ${savedAt ? ` ${savedAt}` : ''}`, c: 'bg-ok-soft text-ok' } : status === 'saving' ? { t: 'جارٍ الحفظ…', c: 'bg-info-soft text-info' } : status === 'pending' ? { t: 'سيُحفظ بعد لحظة…', c: 'bg-warn-soft text-warn' } : status === 'error' ? { t: 'تعذر الحفظ', c: 'bg-bad-soft text-bad' } : null;

  return (
    <Shell title={config.title} sub={config.fundName} chip={chip}>
      <p className="whitespace-pre-line leading-relaxed">{config.intro}</p>

      {closed && <Callout tone="warn">التسجيل مغلق حاليًا{own ? '، ويمكنك الاطلاع على ما سجّلته أو حذفه.' : '.'}</Callout>}
      {status === 'error' && (
        <Callout tone="bad" title="تعذر حفظ آخر تعديل">
          {saveError}
          <button className="btn btn-soft btn-sm mt-2" onClick={flush}>
            إعادة المحاولة
          </button>
        </Callout>
      )}

      {!consent ? (
        <Card>
          <h2 className="mb-2 text-lg">قبل أن تبدأ</h2>
          <p className="mb-3 text-sm leading-relaxed text-mute">
            ما تدخله (اسمك وبياناتك والتزامك) يُحفظ مباشرة في جدول يملكه القائمون على إعداد الميثاق ويطّلعون عليه وحدهم. هو تعبير عن رغبتك لأغراض التخطيط، وليس التزامًا نظاميًا، ولا يُطلب منك دفع شيء الآن. يمكنك تعديله أو حذفه في أي وقت.
          </p>
          <button className="btn btn-primary" onClick={agree} disabled={closed}>
            أوافق وأبدأ التسجيل
          </button>
        </Card>
      ) : (
        <fieldset disabled={closed} className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg">١. معلوماتك الأساسية</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الاسم الثلاثي *" className="sm:col-span-2" hint="كما يُعرف في العائلة.">
                <input className="input" aria-label="الاسم الثلاثي" value={data.name} maxLength={80} onChange={(e) => edit({ name: e.target.value })} />
              </Field>
              <div>
                <span className="label">الجنس *</span>
                <div role="radiogroup" aria-label="الجنس" className="flex gap-2">
                  {(['male', 'female'] as const).map((g: Exclude<Gender, ''>) => (
                    <Chip key={g} active={data.gender === g} onClick={() => edit({ gender: g })}>
                      {g === 'male' ? 'ذكر' : 'أنثى'}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label="الفرع في العائلة">
                {config.branches.length > 0 ? (
                  <select className="input" aria-label="الفرع في العائلة" value={data.branch} onChange={(e) => edit({ branch: e.target.value })}>
                    <option value="">— اختر —</option>
                    {config.branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="input" aria-label="الفرع في العائلة" value={data.branch} maxLength={60} onChange={(e) => edit({ branch: e.target.value })} />
                )}
              </Field>
              <Field label="سنة الميلاد (اختياري)">
                <NumInput value={data.birthYear} min={1900} max={new Date().getFullYear()} ariaLabel="سنة الميلاد" onChange={(v) => edit({ birthYear: v == null ? null : Math.round(v) })} />
              </Field>
              <Field label="المدينة (اختياري)">
                <input className="input" aria-label="المدينة" value={data.city} maxLength={60} onChange={(e) => edit({ city: e.target.value })} />
              </Field>
              <Field label="رقم الجوال (اختياري)" className="sm:col-span-2" hint="للتواصل بشأن الميثاق فقط.">
                <input
                  className="input ltr text-end"
                  inputMode="tel"
                  aria-label="رقم الجوال"
                  value={data.phone}
                  maxLength={20}
                  onChange={(e) => edit({ phone: latinDigits(e.target.value).replace(/[^0-9+\s-]/g, '') })}
                />
              </Field>
            </div>
            {!basicOk && <p className="hint mt-3">اكتب اسمك (كلمتان على الأقل) واختر الجنس ليظهر لك اختيار الالتزام.</p>}
          </Card>

          {basicOk && (
            <Card>
              <h2 className="mb-1 text-lg">٢. التزامك</h2>
              <p className="mb-4 text-sm text-mute">اختر ما تراه مناسبًا لقدرتك. يمكنك تغييره لاحقًا.</p>

              <div className="space-y-5">
                <div>
                  <span className="label">الاشتراك الشهري *</span>
                  <div role="radiogroup" aria-label="الاشتراك الشهري" className="flex flex-wrap gap-2">
                    {config.amounts.map((a) => (
                      <Chip
                        key={a}
                        active={monthlyMode === 'preset' && data.monthly === a}
                        onClick={() => {
                          setMonthlyMode('preset');
                          edit({ monthly: a });
                        }}
                      >
                        {money(a)}
                      </Chip>
                    ))}
                    <Chip
                      active={monthlyMode === 'custom'}
                      onClick={() => {
                        setMonthlyMode('custom');
                        edit({ monthly: null, years: monthlyMode === 'none' ? null : data.years });
                      }}
                    >
                      مبلغ آخر
                    </Chip>
                    <Chip
                      active={monthlyMode === 'none'}
                      onClick={() => {
                        setMonthlyMode('none');
                        edit({ monthly: 0, years: null });
                      }}
                    >
                      لا أرغب بالاشتراك حاليًا
                    </Chip>
                  </div>
                  {monthlyMode === 'custom' && (
                    <div className="mt-2 flex items-center gap-2">
                      <NumInput value={data.monthly} min={1} ariaLabel="مبلغ الاشتراك الشهري" className="w-40" onChange={(v) => edit({ monthly: v })} />
                      <span className="text-sm text-mute">ريال شهريًا</span>
                    </div>
                  )}
                </div>

                {data.monthly != null && data.monthly > 0 && (
                  <div>
                    <span className="label">مدة الالتزام *</span>
                    <div role="radiogroup" aria-label="مدة الالتزام" className="flex flex-wrap gap-2">
                      {config.years.map((y) => (
                        <Chip
                          key={y}
                          active={!yearsCustom && data.years === y}
                          onClick={() => {
                            setYearsCustom(false);
                            edit({ years: y });
                          }}
                        >
                          {num(y)} سنة
                        </Chip>
                      ))}
                      <Chip
                        active={yearsCustom}
                        onClick={() => {
                          setYearsCustom(true);
                          edit({ years: null });
                        }}
                      >
                        مدة أخرى
                      </Chip>
                    </div>
                    {(yearsCustom || config.years.length === 0) && (
                      <div className="mt-2 flex items-center gap-2">
                        <NumInput value={data.years} min={1} max={100} ariaLabel="مدة الالتزام بالسنوات" className="w-32" onChange={(v) => edit({ years: v })} />
                        <span className="text-sm text-mute">سنة</span>
                      </div>
                    )}
                  </div>
                )}

                {config.allowOneTime && (
                  <Field label="مساهمة تأسيسية لمرة واحدة (اختياري)" hint="إن رغبت بالمساهمة بمبلغ إضافي عند التأسيس.">
                    <div className="flex items-center gap-2">
                      <NumInput value={data.oneTime} min={0} ariaLabel="مساهمة لمرة واحدة" className="w-40" onChange={(v) => edit({ oneTime: v })} />
                      <span className="text-sm text-mute">ريال</span>
                    </div>
                  </Field>
                )}

                <Check checked={data.volunteer} onChange={(v) => edit({ volunteer: v })} label="أرغب بالمشاركة في العمل (لجنة أو مجلس أو خدمة)" />

                <Field label="ملاحظاتك واقتراحاتك (اختياري)">
                  <TextArea rows={3} ariaLabel="ملاحظاتك واقتراحاتك" value={data.notes} onChange={(v) => edit({ notes: v.slice(0, 1000) })} />
                </Field>
              </div>

              <div className="mt-5 rounded-xl bg-brand-50 p-4" aria-live="polite">
                <b className="text-brand-900">التزامك المعلن</b>
                {data.monthly === 0 ? (
                  <p className="mt-1 text-sm">لا ترغب بالاشتراك حاليًا، وسُجّلت رغبتك في المتابعة.</p>
                ) : total != null && data.monthly != null && data.years != null ? (
                  <p className="mt-1 text-sm">
                    {money(data.monthly)} شهريًا لمدة {num(data.years)} سنة = <b>{money(total)}</b> إجمالًا
                    {data.oneTime ? `، إضافة إلى مساهمة لمرة واحدة ${money(data.oneTime)}` : ''}.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-mute">لم يكتمل اختيارك بعد.</p>
                )}
                <div className="mt-2">{isCommitmentComplete(data) ? <Badge tone="ok">اكتمل تسجيلك</Badge> : <Badge tone="warn">باقٍ اختيار المبلغ والمدة</Badge>}</div>
              </div>
            </Card>
          )}
        </fieldset>
      )}

      {consent && own && (
        <Card>
          <h2 className="mb-2 text-base">رابطك الشخصي</h2>
          <p className="mb-3 text-sm text-mute">
            {persisted ? 'يتذكر هذا المتصفح تسجيلك.' : 'تعذر حفظ هويتك في هذا المتصفح.'} لفتح تسجيلك من هاتف آخر أو متصفح آخر انسخ الرابط الشخصي واحتفظ به؛ لا تشاركه مع غيرك لأنه يتيح تعديل تسجيلك.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-soft" onClick={() => void attempt(() => navigator.clipboard.writeText(personalLink ?? ''), 'نُسخ رابطك الشخصي.')}>
              <Copy className="size-4" /> نسخ رابطي الشخصي
            </button>
            <button className="btn btn-ghost text-bad" onClick={() => void remove()}>
              <Trash2 className="size-4" /> حذف تسجيلي
            </button>
          </div>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-mute">
        هذه الصفحة جزء من إعداد مسودة ميثاق للنقاش. لا تُنشئ التزامًا نظاميًا ولا تحصّل مالًا، وما تدخله لا يُعتمد إلا بعد قرار العائلة والجهات المختصة.
      </p>
    </Shell>
  );
}

const Shell = ({ title, sub, chip, children }: { title: string; sub?: string; chip?: { t: string; c: string } | null; children: React.ReactNode }) => (
  <div className="min-h-screen bg-ivory">
    <header className="border-b border-line bg-brand-900 px-4 py-6 text-ivory">
      <div className="mx-auto max-w-2xl">
        <div className="text-xs font-semibold text-gold-soft">مسودة للنقاش — تسجيل المشاركين</div>
        <h1 className="mt-1 text-2xl text-ivory sm:text-3xl">{title}</h1>
        {sub && <div className="mt-1 text-sm text-gold-soft">{sub}</div>}
      </div>
    </header>
    {chip && (
      <div className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <span className={cx('badge', chip.c)} aria-live="polite" role="status">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {chip.t}
          </span>
        </div>
      </div>
    )}
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">{children}</main>
    <Hosts />
  </div>
);
