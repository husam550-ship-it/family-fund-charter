import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Loader2, Presentation, ShieldCheck, UserPlus } from 'lucide-react';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { go, SECTIONS, sectionLabel } from '../lib/nav';
import { clauseCounts, sectionCompletion } from '../engine/progress';
import { runReview } from '../engine/review';
import { expectedCount } from '../engine/subscriptions';
import { compactMoney, hijriOfYm, pct, num } from '../lib/format';
import { resolveText } from '../engine/context';
import { addMonths } from '../lib/format';
import { Badge, Callout, Card, ProgressBar, Ring, SectionHead, Stat, Term } from '../components/ui';
import { SelectInput, VarField } from '../components/fields';
import type { Phase } from '../types';

const NEXT: Record<Phase['status'], Phase['status']> = { todo: 'doing', doing: 'done', done: 'todo' };

const safeGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* التخزين قد يكون ممنوعًا في بعض الأوضاع؛ التنبيه يظهر فقط */
  }
};

export default function Dashboard() {
  const { project: p, ctx, sims, reqs, percent } = useDerived();
  const update = useStore((s) => s.update);
  const [hideNote, setHideNote] = useState(() => safeGet('ffc-privacy-ok') === '1');
  const counts = clauseCounts(p);
  const base = sims.base;
  const last = base.years[base.years.length - 1];
  const subscribers = p.groups.reduce((s, g) => s + expectedCount(g), 0);
  const assetsTarget = p.vars.endowment_target != null ? (p.vars.endowment_target as number) : p.assets.reduce((s, a) => s + (a.targetCost ?? 0), 0);
  const review = useMemo(() => runReview(p), [p]);
  const open = reqs.filter((r) => !r.done);
  const secs = sectionCompletion(reqs);
  const endYm = base.endMonth != null && base.endMonth > 0 ? addMonths(base.startYm, base.endMonth - 1) : null;
  const deceased = p.vars.namesake_status === 'deceased';
  const top = [...review.byKind.conflict, ...review.byKind.financial, ...review.byKind.legal].filter((c) => c.severity === 'high').slice(0, 5);

  return (
    <div className="space-y-6">
      <SectionHead
        num="01 / لوحة المشروع"
        title={resolveText(p.name, ctx)}
        sub="مركز القيادة: ما اتفقنا عليه، وما لم نحسمه، وأثر ذلك على الأرقام. جميع الأرقام تقديرية ولا تمثل أموالًا محصلة."
      />

      {!hideNote && (
        <Callout tone="gold" title="بياناتك على جهازك فقط">
          <div className="space-y-2">
            <p>
              هذا موقع ثابت وعام، لكن الأسماء والأرقام والقرارات التي تدخلها تُحفظ في هذا المتصفح ولا تُرفع إلى أي مكان. للعمل من جهاز آخر انقل ملف نسخة احتياطية JSON يدويًا (زر «البيانات» في الأعلى).
            </p>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => {
                safeSet('ffc-privacy-ok', '1');
                setHideNote(true);
              }}
            >
              فهمت
            </button>
          </div>
        </Callout>
      )}

      {p.demo && (
        <Callout tone="warn" title="تعرض المنصة الآن بيانات توضيحية غير حقيقية">
          الأرقام والأصول المعروضة للتجربة فقط وليست أعدادًا ولا أموالًا ولا عقارات فعلية. يمكن مسحها من زر «البيانات ← بيانات توضيحية».
        </Callout>
      )}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <VarField k="family_name" />
          <VarField k="charter_name" />
          <VarField k="fund_name" />
          <div>
            <label className="label">حالة صاحب الاسم</label>
            <SelectInput
              value={String(p.vars.namesake_status ?? 'unknown')}
              ariaLabel="حالة صاحب الاسم"
              onChange={(v) => update((d) => void (d.vars.namesake_status = v), 'ns')}
              options={[
                { value: 'unknown', label: 'لم تُحدد' },
                { value: 'alive', label: 'على قيد الحياة' },
                { value: 'deceased', label: 'متوفى' },
              ]}
            />
          </div>
        </div>
        <p className="hint mt-2">كل ما يظهر من الاسم في العناوين والنصوص والتقارير يتحدّث تلقائيًا عند تعديله.</p>
        {deceased && (
          <div className="mt-3">
            <Callout tone="warn" title="تنبيه تسمية">
              القواعد المطّلع عليها تشترط أن يكون صاحب الاسم حيًّا عند التسمية باسم شخص. فكّر في تسمية رسمية مختلفة أو اسم عام مع الإبقاء على الهوية العائلية في الميثاق، واستوضح من المركز. راجع قسم «مراجعة الميثاق ← المرجعية النظامية».
            </Callout>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg">جاهز للاجتماع العائلي؟</h2>
        <p className="mb-3 text-sm text-mute">اعرض الشرح المبسط على الحضور قبل النقاش، وأرسل رابط التسجيل ليسجل كل فرد بياناته والتزامه.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => go('present')}>
            <Presentation className="size-4" /> عرض الميثاق للأسرة
          </button>
          <button className="btn btn-soft" onClick={() => go('registration')}>
            <UserPlus className="size-4" /> رابط التسجيل والالتزامات
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card col-span-2 flex items-center gap-4 p-4">
          <Ring value={percent} size={76} label={`اكتمال ${percent}%`} />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-mute">نسبة اكتمال مشروع الميثاق</div>
            <div className="text-sm">
              {reqs.filter((r) => r.done).length} من {reqs.length} متطلبًا قابلًا للفحص
            </div>
            <p className="hint">بلوغ 100% لا يعني اعتمادًا نظاميًا.</p>
          </div>
        </div>
        <Stat label="البنود المعتمدة" value={`${counts.approved} من ${counts.total}`} />
        <Stat label="بنود تنتظر قرارًا" value={counts.discuss + counts.postponed} sub={`مؤجل: ${counts.postponed}`} tone={counts.discuss > 0 ? 'warn' : undefined} />
        <Stat label="مسائل خلافية" value={counts.contested} />
        <Stat label="أسئلة لم تُناقش" value={counts.openQuestions} />
        <Stat label="المشتركون المستهدفون" value={subscribers > 0 ? num(subscribers) : '—'} sub="تقديري" />
        <Stat
          label={<Term k="commitments">إجمالي الاشتراكات المتوقعة</Term>}
          value={base.totalCommitment > 0 ? compactMoney(base.totalCommitment) : '—'}
          sub={base.totalCommitment > 0 ? `بعد التحصيل المتوقع: ${compactMoney(base.totalCollected)} (تقدير)` : 'أدخل الفئات والاشتراك'}
        />
        <Stat label="قيمة الأصول المستهدفة" value={assetsTarget > 0 ? compactMoney(assetsTarget) : '—'} sub={`${p.assets.length} أصل مسجل`} />
        <Stat label={<Term k="reserve">الاحتياطي المتوقع</Term>} value={last.reserve > 0 ? compactMoney(last.reserve) : '—'} sub="الحد الأدنى + مخصصات الصيانة" />
        <Stat
          label="انتهاء الالتزام بالاشتراكات"
          value={base.endLabel ?? '—'}
          sub={endYm ? hijriOfYm(endYm) : 'يحتاج مدة وتاريخ بداية'}
        />
        <Stat
          label={<Term k="coverage">تغطية النفقات بالعوائد المستدامة</Term>}
          value={base.finalCoverage != null ? pct(base.finalCoverage * 100) : '—'}
          sub="السيناريو الأساسي، آخر الأفق"
          tone={base.finalCoverage != null && base.finalCoverage < 1 ? 'warn' : undefined}
        />
        <Stat
          label={<Term k="sustainability">مؤشر الاستدامة المالية</Term>}
          value={base.sustainabilityIndex != null ? `${base.sustainabilityIndex} من 100` : '—'}
          sub="تقدير مركّب، وليس ضمانًا"
        />
        <Stat label="تعارضات تحتاج حلًا" value={review.byKind.conflict.length} tone={review.byKind.conflict.length > 0 ? 'bad' : 'ok'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">لا تنسَ هذا السؤال</h2>
            <button className="btn btn-soft btn-sm" onClick={() => go('meetings')}>
              تحضير الاجتماع <ArrowLeft className="size-4" />
            </button>
          </div>
          {open.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ok">
              <ShieldCheck className="size-5" /> لا توجد أسئلة جوهرية مفتوحة بحسب المتطلبات الحالية.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {open.slice(0, 9).map((r) => (
                <li key={r.req.id}>
                  <button className="flex w-full items-start gap-2 rounded-lg p-2 text-start text-sm hover:bg-brand-50" onClick={() => go(r.req.section)}>
                    <Circle className="mt-1 size-3.5 shrink-0 text-gold" aria-hidden />
                    <span className="flex-1">{r.req.question}</span>
                    <span className="shrink-0 text-xs text-mute">{sectionLabel(r.req.section)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open.length > 9 && <p className="mt-2 text-xs text-mute">و{open.length - 9} أسئلة أخرى في قسم «مراجعة الميثاق».</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg">تقدم الأقسام</h2>
          <ul className="space-y-2.5">
            {SECTIONS.filter((s) => secs[s.id]).map((s) => {
              const c = secs[s.id]!;
              const v = (c.done / c.total) * 100;
              return (
                <li key={s.id}>
                  <button className="block w-full text-start" onClick={() => go(s.id)}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold">{s.label}</span>
                      <span className="ltr text-mute">
                        {c.done}/{c.total}
                      </span>
                    </div>
                    <ProgressBar value={v} label={s.label} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-lg">مراحل تأسيس الصندوق</h2>
        <p className="mb-4 text-sm text-mute">اضغط على المرحلة لتغيير حالتها (لم تبدأ ← جارية ← منجزة).</p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {p.foundingPhases.map((ph, i) => (
            <li key={ph.id}>
              <button
                className="flex h-full w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-start hover:border-brand-300"
                onClick={() => update((d) => void (d.foundingPhases[i].status = NEXT[ph.status]))}
                aria-label={`${ph.title}: ${ph.status === 'done' ? 'منجزة' : ph.status === 'doing' ? 'جارية' : 'لم تبدأ'}`}
              >
                {ph.status === 'done' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : ph.status === 'doing' ? <Loader2 className="mt-0.5 size-5 shrink-0 text-gold" /> : <Circle className="mt-0.5 size-5 shrink-0 text-line" />}
                <span>
                  <span className="ltr me-1 text-xs font-bold text-gold-deep">{i + 1}</span>
                  <b className="text-sm text-brand-900">{ph.title}</b>
                  <span className="block text-xs text-mute">{ph.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">أبرز ما يحتاج انتباهًا</h2>
          <button className="btn btn-soft btn-sm" onClick={() => go('review')}>
            الفحص الكامل <ArrowLeft className="size-4" />
          </button>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-mute">لا توجد تنبيهات عالية الأهمية الآن.</p>
        ) : (
          <ul className="space-y-2">
            {top.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-2 text-sm">
                <Badge tone="bad">{c.kind === 'financial' ? 'مالي' : c.kind === 'legal' ? 'نظامي' : 'تعارض'}</Badge>
                <button className="flex-1 text-start hover:underline" onClick={() => go(c.section)}>
                  <b>{c.title}</b>
                  <span className="block text-xs text-mute">{c.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint mt-3">الأرقام في هذه اللوحة تقديرية مبنية على افتراضات أدخلتها، ولا تمثل أموالًا محصلة فعليًا.</p>
      </Card>
    </div>
  );
}
