import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check as CheckIcon, ChevronDown, Copy, Link2, Plus, Scale, Trash2 } from 'lucide-react';
import type { Alternative, Clause, ClauseStatus } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { clauseText, selectedAlt, STATUS_LABEL } from '../lib/clauses';
import { chooseAlt, deleteCustomClause, duplicateClause, moveClause, setCustomText, setStatus } from '../lib/actions';
import { confirmAction, toast, useUi } from '../lib/ui';
import { resolveText, labelOf } from '../engine/context';
import { simulate } from '../engine/simulate';
import { dateLabel, money, uid } from '../lib/format';
import { CATEGORIES } from '../data/clauses';
import { Badge, Callout, cx, Resolved } from './ui';
import { Check, Field, SelectInput, TextArea, TextInput, VarField } from './fields';
import { VAR_BY_KEY } from '../data/variables';
import { go } from '../lib/nav';
import { clauseVarKeys } from '../lib/clauses';

const STATUS_TONE: Record<ClauseStatus, 'ok' | 'warn' | 'info' | 'bad'> = { approved: 'ok', discuss: 'warn', postponed: 'info', excluded: 'bad' };
const STATUS_ORDER: ClauseStatus[] = ['approved', 'discuss', 'postponed', 'excluded'];

const fmtSet = (k: string, v: unknown): string => {
  const d = VAR_BY_KEY[k];
  if (d?.type === 'select') return d.options?.find((o) => o.value === v)?.label ?? String(v);
  if (d?.type === 'currency' && typeof v === 'number') return money(v);
  if (d?.type === 'percent') return `${v}%`;
  return String(v);
};

/** أثر البديل على الأرقام: تُطبق قيمه مؤقتًا وتُقارن بالوضع الحالي */
const useAltImpact = (c: Clause, open: boolean) => {
  const { project } = useDerived();
  return useMemo(() => {
    if (!open) return null;
    const withSets = c.alternatives.filter((a) => a.sets && Object.keys(a.sets).length > 0);
    if (withSets.length === 0) return null;
    const rows = withSets.map((a) => {
      const q = { ...project, vars: { ...project.vars, ...a.sets } };
      const r = simulate(q, 'base');
      const last = r.years[r.years.length - 1];
      return {
        alt: a,
        commitment: r.totalCommitment,
        end: r.endLabel,
        purchased: r.purchases.length,
        index: r.sustainabilityIndex,
        shortfall: r.shortfallYears.length,
        netWorth: last.netWorth,
      };
    });
    const cur = simulate(project, 'base');
    return { rows, cur };
  }, [c, project, open]);
};

export const ClauseCard = ({ id, defaultOpen = false }: { id: string; defaultOpen?: boolean }) => {
  const clause = useStore((s) => s.project.clauses.find((c) => c.id === id));
  const update = useStore((s) => s.update);
  const { ctx } = useDerived();
  const focus = useUi((s) => s.focusClause);
  const [open, setOpen] = useState(defaultOpen || focus === id);
  const [compare, setCompare] = useState(false);
  const [editing, setEditing] = useState(false);
  const impact = useAltImpact(clause as Clause, open);
  if (!clause) return null;
  const c = clause;
  const alt = selectedAlt(c);
  const text = clauseText(c);
  const resolved = resolveText(text, ctx);
  const varKeys = clauseVarKeys(c, text).filter((k) => k in VAR_BY_KEY);
  const rec = c.recommendation;

  const setStat = (st: ClauseStatus): void => update((d) => setStatus(d, c.id, st));
  const patch = (fn: (d: Clause) => void, key?: string): void =>
    update((d) => {
      const t = d.clauses.find((x) => x.id === c.id);
      if (t) fn(t);
    }, key);

  const pickAlt = (a: Alternative): void => {
    update((d) => chooseAlt(d, c.id, a.id));
    if (a.sets) toast(`طُبّقت قيم البديل على المتغيرات (${Object.keys(a.sets).map(labelOf).join('، ')})`, 'info');
  };

  return (
    <article id={`clause-${c.id}`} className={cx('rounded-xl border bg-paper', open ? 'border-brand-300 shadow-sm' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-start" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronDown className={cx('size-4 shrink-0 text-mute transition-transform', open && 'rotate-180')} aria-hidden />
          <span className="ltr shrink-0 rounded bg-brand-50 px-1.5 text-xs font-bold text-brand-800">{c.id}</span>
          <span className="min-w-0 font-bold text-brand-900">{c.title}</span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.core && <Badge tone="gold">أساسي</Badge>}
          {c.legalCheck && <Badge tone="info" title={c.legalRef}>يحتاج تحققًا نظاميًا</Badge>}
          {c.contested && <Badge tone="bad">خلافي</Badge>}
          {c.alternatives.length > 1 && <Badge>{c.alternatives.length} بدائل</Badge>}
          <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
          {c.status !== 'approved' && (
            <button className="btn btn-soft btn-sm" onClick={() => setStat('approved')} title="اعتماد البند بصيغته الحالية">
              <CheckIcon className="size-3.5" /> اعتماد
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line p-4">
          {(c.explanation || c.why) && (
            <div className="space-y-1 text-sm">
              {c.explanation && <p>{c.explanation}</p>}
              <p className="text-mute">
                <b className="text-brand-800">لماذا يُقترح؟ </b>
                {c.why}
              </p>
            </div>
          )}
          {c.legalCheck && (
            <Callout tone="info" title="يحتاج تحققًا نظاميًا قبل الاعتماد النهائي">
              {c.legalRef || 'لم يُحدد مرجع.'}
            </Callout>
          )}

          {c.questions.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm">أسئلة للنقاش</h4>
              <ul className="list-disc space-y-0.5 ps-5 text-sm">
                {c.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* البدائل */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm">{c.alternatives.length > 1 ? 'البدائل: اختر صيغة أو قارن بينها' : 'الصيغة المقترحة'}</h4>
              <div className="flex gap-2">
                {c.alternatives.length > 1 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setCompare(!compare)}>
                    <Scale className="size-4" /> {compare ? 'العرض المفصل' : 'مقارنة جنبًا إلى جنب'}
                  </button>
                )}
              </div>
            </div>

            {compare ? (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-50 text-brand-900">
                      <th className="w-24 p-2 text-start">&nbsp;</th>
                      {c.alternatives.map((a) => (
                        <th key={a.id} className={cx('p-2 text-start align-top', a.id === c.selectedAlt && 'bg-brand-100')}>
                          {a.label}
                          {rec?.altId === a.id && <Badge tone="gold">موصى به</Badge>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['النص', (a: Alternative) => <Resolved text={resolveText(a.text, ctx)} />],
                        ['المزايا', (a: Alternative) => a.pros || '—'],
                        ['العيوب', (a: Alternative) => a.cons || '—'],
                        ['الأثر المتوقع', (a: Alternative) => a.impact || '—'],
                      ] as [string, (a: Alternative) => ReactNode][]
                    ).map(([label, fn]) => (
                      <tr key={label} className="border-t border-line align-top">
                        <th className="bg-ivory p-2 text-start font-semibold text-brand-800">{label}</th>
                        {c.alternatives.map((a) => (
                          <td key={a.id} className={cx('p-2', a.id === c.selectedAlt && 'bg-brand-50/60')}>
                            {fn(a)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-line">
                      <td className="bg-ivory" />
                      {c.alternatives.map((a) => (
                        <td key={a.id} className="p-2">
                          <button className={cx('btn btn-sm', a.id === c.selectedAlt ? 'btn-primary' : 'btn-soft')} onClick={() => pickAlt(a)}>
                            {a.id === c.selectedAlt ? 'المختار' : 'اختيار'}
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                {c.alternatives.map((a) => {
                  const sel = a.id === c.selectedAlt;
                  return (
                    <div key={a.id} className={cx('rounded-xl border p-3', sel ? 'border-brand-500 bg-brand-50/60' : 'border-line')}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-brand-900">
                          <span className={cx('grid size-5 place-items-center rounded-full border-2', sel ? 'border-brand-700 bg-brand-700 text-white' : 'border-line')}>
                            {sel && <CheckIcon className="size-3" />}
                          </span>
                          {c.alternatives.length > 1 ? a.label : 'الصيغة المقترحة'}
                          {rec?.altId === a.id && <Badge tone="gold">توصية مبدئية</Badge>}
                          {a.flags && a.flags.length > 0 && <Badge tone="warn">قد يُثير تنبيه عدالة أو تعارضًا</Badge>}
                        </div>
                        {c.alternatives.length > 1 && !sel && (
                          <button className="btn btn-soft btn-sm" onClick={() => pickAlt(a)}>
                            اختيار هذا البديل
                          </button>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">
                        <Resolved text={resolveText(a.text, ctx)} />
                      </p>
                      {(a.pros || a.cons || a.impact) && (
                        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                          {a.pros && (
                            <div>
                              <dt className="font-bold text-ok">المزايا</dt>
                              <dd className="text-mute">{a.pros}</dd>
                            </div>
                          )}
                          {a.cons && (
                            <div>
                              <dt className="font-bold text-bad">العيوب</dt>
                              <dd className="text-mute">{a.cons}</dd>
                            </div>
                          )}
                          {a.impact && (
                            <div>
                              <dt className="font-bold text-info">الأثر المتوقع</dt>
                              <dd className="text-mute">{a.impact}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      {a.sets && (
                        <p className="mt-2 text-xs text-mute">
                          عند اختياره يضبط:{' '}
                          {Object.entries(a.sets)
                            .map(([k, v]) => `${labelOf(k)} = ${fmtSet(k, v)}`)
                            .join('، ')}
                        </p>
                      )}
                    </div>
                  );
                })}
                {rec && (
                  <p className="rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold-deep">
                    <b>التوصية المبدئية (قابلة للرفض): </b>
                    {c.alternatives.find((a) => a.id === rec.altId)?.label} — {rec.why}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* الأثر على الأرقام */}
          {impact && impact.rows.length > 0 && (
            <div className="rounded-xl border border-info/30 bg-info-soft/60 p-3">
              <h4 className="mb-2 text-sm text-info">أثر البدائل على الأرقام (السيناريو الأساسي، ببقية المدخلات الحالية)</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-xs">
                  <thead>
                    <tr className="text-start text-mute">
                      <th className="p-1 text-start">البديل</th>
                      <th className="p-1 text-start">إجمالي الالتزامات</th>
                      <th className="p-1 text-start">نهاية الالتزام</th>
                      <th className="p-1 text-start">أصول ممكنة الشراء</th>
                      <th className="p-1 text-start">سنوات نقص السيولة</th>
                      <th className="p-1 text-start">مؤشر الاستدامة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.rows.map((r) => (
                      <tr key={r.alt.id} className={cx('border-t border-info/20', r.alt.id === c.selectedAlt && 'font-bold')}>
                        <td className="p-1">{r.alt.label}</td>
                        <td className="p-1">{money(r.commitment)}</td>
                        <td className="p-1">{r.end ?? '—'}</td>
                        <td className="p-1">{r.purchased} من {impact.cur.purchases.length + impact.cur.notPurchased.length}</td>
                        <td className="p-1">{r.shortfall}</td>
                        <td className="p-1">{r.index ?? '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-info/20 text-mute">
                      <td className="p-1">الوضع الحالي</td>
                      <td className="p-1">{money(impact.cur.totalCommitment)}</td>
                      <td className="p-1">{impact.cur.endLabel ?? '—'}</td>
                      <td className="p-1">{impact.cur.purchases.length}</td>
                      <td className="p-1">{impact.cur.shortfallYears.length}</td>
                      <td className="p-1">{impact.cur.sustainabilityIndex ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="hint mt-1">أرقام تقديرية للمقارنة فقط، وليست نتائج مضمونة.</p>
            </div>
          )}

          {/* المتغيرات المرتبطة */}
          {varKeys.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm">المتغيرات المرتبطة بهذا البند (تعديلها يحدّث كل المواضع)</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {varKeys.map((k) => (
                  <VarField key={k} k={k} hideHelp />
                ))}
              </div>
            </div>
          )}

          {/* النص المعتمد */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm">نص البند في الميثاق {c.customText != null && <Badge tone="gold">معدّل يدويًا</Badge>}</h4>
              {c.customText != null && (
                <button className="btn btn-ghost btn-sm" onClick={() => update((d) => setCustomText(d, c.id, null))}>
                  إعادة صيغة البديل
                </button>
              )}
            </div>
            <TextArea
              rows={4}
              value={text}
              ariaLabel="نص البند"
              onChange={(v) => update((d) => setCustomText(d, c.id, v), `ct:${c.id}`)}
            />
            <p className="hint mt-1">يمكنك استعمال المتغيرات بصيغة {'{{اسم_المتغير}}'} مثل {'{{monthly_contribution}}'} فتُستبدل تلقائيًا.</p>
            <div className="mt-2 rounded-lg border border-line bg-ivory p-3 text-sm leading-relaxed">
              <span className="mb-1 block text-xs font-bold text-mute">المعاينة كما ستظهر في الميثاق</span>
              <Resolved text={resolved} />
            </div>
          </div>

          {/* القرار */}
          <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
            <div>
              <span className="label">الحالة</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    className={cx('btn btn-sm', c.status === st ? 'btn-primary' : 'btn-soft')}
                    onClick={() => setStat(st)}
                    aria-pressed={c.status === st}
                  >
                    {STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-mute">
                {c.decisionDate && <span>تاريخ اعتماد القرار: {dateLabel(c.decisionDate)}. </span>}
                {c.meetingDecisionId && <span>مرتبط بقرار اجتماع.</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <Check checked={c.contested} onChange={(v) => patch((t) => void (t.contested = v))} label="مسألة خلافية" />
              </div>
            </div>
            <Field label="مبرر الاعتماد أو الرفض أو التأجيل">
              <TextArea rows={3} value={c.rationale} onChange={(v) => patch((t) => void (t.rationale = v), `ra:${c.id}`)} placeholder="لماذا اتخذنا هذا القرار؟" />
            </Field>
            <Field label="ملاحظات" className="sm:col-span-2">
              <TextArea rows={2} value={c.notes} onChange={(v) => patch((t) => void (t.notes = v), `no:${c.id}`)} />
            </Field>
          </div>

          {c.related.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link2 className="size-4 text-mute" aria-hidden />
              <span className="font-semibold text-mute">بنود مرتبطة:</span>
              <RelatedChips ids={c.related} />
            </div>
          )}

          {/* الإدارة */}
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button className="btn btn-ghost btn-sm" onClick={() => moveBy(c.id, -1, update)}>
              <ArrowUp className="size-4" /> أعلى
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => moveBy(c.id, 1, update)}>
              <ArrowDown className="size-4" /> أسفل
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => update((d) => void duplicateClause(d, c.id))}>
              <Copy className="size-4" /> تكرار البند
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
              {editing ? 'إخفاء تحرير التفاصيل' : 'تحرير التفاصيل والبدائل'}
            </button>
            {c.status !== 'excluded' && (
              <button className="btn btn-ghost btn-sm" onClick={() => setStat('excluded')} title="يبقى في المكتبة ويُحذف من النسخة النهائية">
                استبعاد من الميثاق
              </button>
            )}
            {c.custom && (
              <button
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (await confirmAction({ title: 'حذف البند', message: `سيُحذف البند «${c.title}» نهائيًا لأنه من إضافتك.`, confirmLabel: 'حذف', danger: true })) {
                    update((d) => deleteCustomClause(d, c.id));
                  }
                }}
              >
                <Trash2 className="size-4" /> حذف
              </button>
            )}
          </div>

          {editing && <ClauseEditor c={c} />}
          <p className="hint">البديل المختار: {alt.label}</p>
        </div>
      )}
    </article>
  );
};

const moveBy = (id: string, dir: -1 | 1, update: (fn: (d: import('../types').Project) => void) => void): void =>
  update((d) => moveClause(d, id, dir));

const RelatedChips = ({ ids }: { ids: string[] }) => {
  const clauses = useStore((s) => s.project.clauses);
  return (
    <>
      {ids.map((id) => {
        const t = clauses.find((x) => x.id === id);
        if (!t) return null;
        return (
          <button
            key={id}
            className="rounded-full border border-line bg-ivory px-2 py-0.5 hover:bg-brand-50"
            onClick={() => {
              useUi.setState({ focusClause: id });
              go('library');
            }}
          >
            <span className="ltr me-1 font-bold text-brand-800">{id}</span>
            {t.title}
          </button>
        );
      })}
    </>
  );
};

const ClauseEditor = ({ c }: { c: Clause }) => {
  const update = useStore((s) => s.update);
  const patch = (fn: (d: Clause) => void, key: string): void =>
    update((d) => {
      const t = d.clauses.find((x) => x.id === c.id);
      if (t) fn(t);
    }, key);
  const patchAlt = (altId: string, fn: (a: Alternative) => void, key: string): void =>
    patch((t) => {
      const a = t.alternatives.find((x) => x.id === altId);
      if (a) fn(a);
    }, key);
  return (
    <div className="space-y-4 rounded-xl border border-gold/40 bg-gold-soft/30 p-4">
      <h4 className="text-sm">تحرير تفاصيل البند</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان">
          <TextInput value={c.title} onChange={(v) => patch((t) => void (t.title = v), `ti:${c.id}`)} />
        </Field>
        <Field label="التصنيف">
          <SelectInput
            value={c.category}
            options={CATEGORIES.map((x) => ({ value: x.id, label: x.label }))}
            onChange={(v) => patch((t) => void (t.category = v as Clause['category']), `cat:${c.id}`)}
          />
        </Field>
        <Field label="شرح مبسط" className="sm:col-span-2">
          <TextArea rows={2} value={c.explanation} onChange={(v) => patch((t) => void (t.explanation = v), `ex:${c.id}`)} />
        </Field>
        <Field label="سبب اقتراح البند" className="sm:col-span-2">
          <TextArea rows={2} value={c.why} onChange={(v) => patch((t) => void (t.why = v), `wh:${c.id}`)} />
        </Field>
        <Field label="أسئلة للنقاش (سؤال في كل سطر)" className="sm:col-span-2">
          <TextArea
            rows={3}
            value={c.questions.join('\n')}
            onChange={(v) => patch((t) => void (t.questions = v.split('\n').filter((x) => x.trim() !== '')), `q:${c.id}`)}
          />
        </Field>
        <Field label="المرجع النظامي (إن وُجد)" className="sm:col-span-2">
          <TextInput value={c.legalRef} onChange={(v) => patch((t) => void (t.legalRef = v), `lr:${c.id}`)} />
        </Field>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <Check checked={c.legalCheck} onChange={(v) => patch((t) => void (t.legalCheck = v), `lc:${c.id}`)} label="يحتاج تحققًا نظاميًا" />
          <Check checked={c.core} onChange={(v) => patch((t) => void (t.core = v), `co:${c.id}`)} label="بند أساسي (يدخل في معايير الاكتمال)" />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm">البدائل</h4>
        {c.alternatives.map((a) => (
          <div key={a.id} className="space-y-2 rounded-lg border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <TextInput value={a.label} ariaLabel="عنوان البديل" onChange={(v) => patchAlt(a.id, (x) => void (x.label = v), `al:${c.id}${a.id}`)} />
              {c.alternatives.length > 1 && (
                <button
                  className="btn btn-ghost btn-sm text-bad"
                  aria-label="حذف البديل"
                  onClick={() =>
                    patch((t) => {
                      t.alternatives = t.alternatives.filter((x) => x.id !== a.id);
                      if (t.selectedAlt === a.id) t.selectedAlt = t.alternatives[0].id;
                    }, `del:${c.id}${a.id}`)
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <TextArea rows={3} ariaLabel="نص البديل" value={a.text} onChange={(v) => patchAlt(a.id, (x) => void (x.text = v), `at:${c.id}${a.id}`)} />
            <div className="grid gap-2 sm:grid-cols-3">
              <TextArea rows={2} ariaLabel="المزايا" placeholder="المزايا" value={a.pros} onChange={(v) => patchAlt(a.id, (x) => void (x.pros = v), `ap:${c.id}${a.id}`)} />
              <TextArea rows={2} ariaLabel="العيوب" placeholder="العيوب" value={a.cons} onChange={(v) => patchAlt(a.id, (x) => void (x.cons = v), `ac:${c.id}${a.id}`)} />
              <TextArea rows={2} ariaLabel="الأثر المتوقع" placeholder="الأثر المتوقع" value={a.impact} onChange={(v) => patchAlt(a.id, (x) => void (x.impact = v), `ai:${c.id}${a.id}`)} />
            </div>
          </div>
        ))}
        <button
          className="btn btn-soft btn-sm"
          onClick={() =>
            patch((t) => {
              t.alternatives.push({ id: uid('alt'), label: 'بديل جديد', text: 'اكتب صيغة البديل هنا.', pros: '', cons: '', impact: '' });
            }, `addalt:${c.id}`)
          }
        >
          <Plus className="size-4" /> إضافة بديل
        </button>
      </div>
    </div>
  );
};

