import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, Maximize2, Plus, Trash2, X } from 'lucide-react';
import type { AgendaItem, Meeting, DecisionKind, Vote } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { addClauseToAgenda, addCustomTopic, decisionNumber, fillAgenda, newMeeting, recordDecision } from '../lib/actions';
import { attempt, confirmAction, useUi } from '../lib/ui';
import { selectedAlt, STATUS_LABEL } from '../lib/clauses';
import { resolveText } from '../engine/context';
import { dateLabel, uid } from '../lib/format';
import { Badge, Callout, Card, cx, EmptyState, ProgressBar, Resolved, SectionHead, Tabs } from '../components/ui';
import { Check, Field, NumInput, SelectInput, TextArea, TextInput } from '../components/fields';
import { go, sectionLabel } from '../lib/nav';

type Tab = 'prepare' | 'record' | 'vote' | 'minutes';

const STATE_LABEL: Record<AgendaItem['state'], string> = { pending: 'لم يُناقش', discussing: 'قيد النقاش', decided: 'محسوم', postponed: 'مؤجل' };
const STATE_TONE: Record<AgendaItem['state'], 'warn' | 'info' | 'ok' | 'plain'> = { pending: 'warn', discussing: 'info', decided: 'ok', postponed: 'plain' };

export default function Meetings() {
  const { project: p } = useDerived();
  const update = useStore((s) => s.update);
  const [sel, setSel] = useState<string | null>(p.meetings[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>('prepare');
  const [presenting, setPresenting] = useState(false);
  const meeting = p.meetings.find((m) => m.id === sel) ?? p.meetings[0] ?? null;

  const create = (): void => {
    let id = '';
    update((d) => void (id = newMeeting(d)));
    setSel(id);
    setTab('prepare');
  };

  return (
    <div className="space-y-6">
      <SectionHead
        num="14 / الاجتماعات والتصويت والقرارات"
        title="الاجتماعات والتصويت والقرارات"
        sub="حوّل كل ما لم يُحسم إلى جدول أعمال، وتنقّل بين الموضوعات في وضع العرض، وسجّل القرارات بمبرراتها وتحفظاتها، واستخرج المحضر."
        actions={
          <button className="btn btn-primary" onClick={create}>
            <Plus className="size-4" /> اجتماع جديد
          </button>
        }
      />

      {p.meetings.length === 0 ? (
        <Card>
          <EmptyState>لا توجد اجتماعات. أنشئ اجتماعًا لتجهيز جدول الأعمال من البنود غير المحسومة.</EmptyState>
          <div className="mt-3 text-center">
            <button className="btn btn-primary" onClick={create}>
              <Plus className="size-4" /> إنشاء الاجتماع الأول
            </button>
          </div>
        </Card>
      ) : (
        meeting && (
          <>
            <Card>
              <div className="grid gap-3 md:grid-cols-[14rem_1fr_1fr_1fr_auto]">
                <Field label="الاجتماع">
                  <SelectInput value={meeting.id} ariaLabel="الاجتماع" options={p.meetings.map((m) => ({ value: m.id, label: m.title }))} onChange={setSel} />
                </Field>
                <Field label="عنوان الاجتماع">
                  <TextInput value={meeting.title} onChange={(v) => update((d) => void (d.meetings.find((m) => m.id === meeting.id)!.title = v), `mt:${meeting.id}`)} />
                </Field>
                <Field label="التاريخ">
                  <TextInput type="date" value={meeting.date} onChange={(v) => update((d) => void (d.meetings.find((m) => m.id === meeting.id)!.date = v))} />
                </Field>
                <Field label="المكان">
                  <TextInput value={meeting.place} onChange={(v) => update((d) => void (d.meetings.find((m) => m.id === meeting.id)!.place = v), `mp:${meeting.id}`)} />
                </Field>
                <div className="flex items-end gap-1.5">
                  <button
                    className="btn btn-gold"
                    onClick={() => {
                      if (meeting.agenda.length === 0) update((d) => void fillAgenda(d, meeting.id));
                      setPresenting(true);
                    }}
                  >
                    <Maximize2 className="size-4" /> وضع العرض
                  </button>
                  <button
                    className="btn btn-ghost text-bad"
                    aria-label="حذف الاجتماع"
                    onClick={async () => {
                      if (await confirmAction({ title: 'حذف الاجتماع', message: 'سيُحذف الاجتماع وجدول أعماله وقراراته المسجلة فيه. لا يُلغي ذلك اعتماد البنود التي طُبقت.', confirmLabel: 'حذف', danger: true })) {
                        update((d) => void (d.meetings = d.meetings.filter((m) => m.id !== meeting.id)));
                        setSel(null);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </Card>

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'prepare', label: 'وضع التحضير', badge: meeting.agenda.filter((a) => a.state === 'pending').length },
                { id: 'record', label: 'تسجيل القرارات', badge: meeting.decisions.length },
                { id: 'vote', label: 'التصويت الاستشاري' },
                { id: 'minutes', label: 'المحضر والمتابعة' },
              ]}
            />

            {tab === 'prepare' && <Prepare meeting={meeting} />}
            {tab === 'record' && <Record meeting={meeting} />}
            {tab === 'vote' && <Votes meeting={meeting} />}
            {tab === 'minutes' && <Minutes meeting={meeting} />}
            {presenting && <Present meeting={meeting} onClose={() => setPresenting(false)} />}
          </>
        )
      )}
    </div>
  );
}

// ───── وضع التحضير
const Prepare = ({ meeting }: { meeting: Meeting }) => {
  const { project: p, reqs } = useDerived();
  const update = useStore((s) => s.update);
  const [topic, setTopic] = useState('');
  const [clauseId, setClauseId] = useState('');
  const open = reqs.filter((r) => !r.done);
  const inAgenda = new Set(meeting.agenda.map((a) => a.clauseId));
  const addable = p.clauses.filter((c) => !inAgenda.has(c.id));
  const mut = (fn: (m: Meeting) => void, key?: string): void => update((d) => fn(d.meetings.find((m) => m.id === meeting.id)!), key);
  const move = (i: number, dir: -1 | 1): void =>
    mut((m) => {
      const j = i + dir;
      if (j < 0 || j >= m.agenda.length) return;
      [m.agenda[i], m.agenda[j]] = [m.agenda[j], m.agenda[i]];
    });

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-2 text-lg">لا تنسَ هذا السؤال</h2>
        <p className="mb-3 text-sm text-mute">أسئلة جوهرية لم تُحسم بعد بحسب حالة المشروع ({open.length}). اضغط للانتقال إلى موضعها.</p>
        {open.length === 0 ? (
          <Callout tone="ok">لا توجد أسئلة جوهرية مفتوحة.</Callout>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {open.map((r) => (
              <li key={r.req.id}>
                <button className="flex w-full items-start gap-2 rounded-lg border border-line bg-paper p-2 text-start text-sm hover:bg-brand-50" onClick={() => go(r.req.section)}>
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-gold" />
                  <span className="flex-1">{r.req.question}</span>
                  <span className="shrink-0 text-xs text-mute">{sectionLabel(r.req.section)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">جدول أعمال الاجتماع ({meeting.agenda.length})</h2>
          <button
            className="btn btn-soft"
            onClick={() => update((d) => void fillAgenda(d, meeting.id))}
          >
            <FileText className="size-4" /> إضافة كل البنود غير المحسومة (الأساسية أولًا)
          </button>
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="إضافة بند من المكتبة" className="min-w-60 flex-1">
            <SelectInput value={clauseId} options={[{ value: '', label: 'اختر…' }, ...addable.map((c) => ({ value: c.id, label: `${c.id} — ${c.title}` }))]} onChange={setClauseId} />
          </Field>
          <button className="btn btn-soft" disabled={!clauseId} onClick={() => { update((d) => addClauseToAgenda(d, meeting.id, clauseId)); setClauseId(''); }}>
            إضافة
          </button>
          <Field label="أو موضوع حر" className="min-w-60 flex-1">
            <TextInput value={topic} onChange={setTopic} placeholder="عنوان الموضوع" />
          </Field>
          <button className="btn btn-soft" disabled={!topic.trim()} onClick={() => { update((d) => addCustomTopic(d, meeting.id, topic.trim())); setTopic(''); }}>
            إضافة
          </button>
        </div>

        {meeting.agenda.length === 0 && <EmptyState>جدول الأعمال فارغ. أضف البنود غير المحسومة بضغطة واحدة.</EmptyState>}
        <ol className="space-y-2">
          {meeting.agenda.map((a, i) => {
            const c = a.clauseId ? p.clauses.find((x) => x.id === a.clauseId) : null;
            const set = (fn: (x: AgendaItem) => void, k: string): void => mut((m) => fn(m.agenda[i]), `ag:${a.id}:${k}`);
            return (
              <li key={a.id} className="rounded-xl border border-line bg-paper p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ltr grid size-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">{i + 1}</span>
                  <b className="min-w-0 flex-1 text-brand-900">{a.title}</b>
                  {c?.core && <Badge tone="gold">أساسي</Badge>}
                  {c && <Badge tone="plain">{STATUS_LABEL[c.status]}</Badge>}
                  <Badge tone={STATE_TONE[a.state]}>{STATE_LABEL[a.state]}</Badge>
                  <button className="btn btn-ghost btn-sm" aria-label="أعلى" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button className="btn btn-ghost btn-sm" aria-label="أسفل" onClick={() => move(i, 1)} disabled={i === meeting.agenda.length - 1}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => mut((m) => void (m.agenda = m.agenda.filter((x) => x.id !== a.id)))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="السؤال المطروح">
                    <TextArea rows={2} value={a.question} onChange={(v) => set((x) => void (x.question = v), 'q')} />
                  </Field>
                  <Field label="شرح مختصر">
                    <TextArea rows={2} value={a.summary} onChange={(v) => set((x) => void (x.summary = v), 's')} />
                  </Field>
                  <Field label="آثار الخيارات / ملاحظات التحضير">
                    <TextArea rows={2} value={a.impactText} onChange={(v) => set((x) => void (x.impactText = v), 'i')} />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="المسؤول عن المتابعة">
                      <TextInput value={a.owner} onChange={(v) => set((x) => void (x.owner = v), 'o')} />
                    </Field>
                    <Field label="الموعد المستهدف">
                      <TextInput type="date" value={a.targetDate} onChange={(v) => set((x) => void (x.targetDate = v), 'd')} />
                    </Field>
                  </div>
                </div>
                {a.recommendation && <p className="mt-2 rounded-lg bg-gold-soft px-3 py-1.5 text-xs text-gold-deep">التوصية المبدئية: {a.recommendation}</p>}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
};

// ───── نموذج تسجيل القرار
const KINDS: { id: DecisionKind; label: string }[] = [
  { id: 'adopt_alt', label: 'اعتماد أحد البدائل' },
  { id: 'custom', label: 'قرار مخصص' },
  { id: 'postpone', label: 'تأجيل' },
  { id: 'exclude', label: 'استبعاد' },
];

const DecisionForm = ({ meeting, item, big, onDone }: { meeting: Meeting; item: AgendaItem; big?: boolean; onDone?: () => void }) => {
  const { project: p, ctx } = useDerived();
  const update = useStore((s) => s.update);
  const clause = item.clauseId ? p.clauses.find((c) => c.id === item.clauseId) : null;
  const dec = item.decisionId ? meeting.decisions.find((d) => d.id === item.decisionId) : undefined;
  const hasAlts = !!clause;
  const [kind, setKind] = useState<DecisionKind>(dec?.kind ?? (hasAlts ? 'adopt_alt' : 'custom'));
  const [altId, setAltId] = useState(dec?.altId ?? (clause ? selectedAlt(clause).id : ''));
  const [text, setText] = useState(dec?.kind === 'custom' ? dec.text : '');
  const [rationale, setRationale] = useState(dec?.rationale ?? '');
  const [reservations, setReservations] = useState(dec?.reservations ?? '');
  const [owner, setOwner] = useState(dec?.owner ?? item.owner);
  const [due, setDue] = useState(dec?.dueDate ?? item.targetDate);

  const save = async (): Promise<void> => {
    const ok = await attempt(
      () => update((d) => void recordDecision(d, meeting.id, item.id, { kind, altId, text, rationale, reservations, owner, dueDate: due })),
      'سُجّل القرار وطُبّق على البند.',
    );
    if (ok) onDone?.();
  };

  return (
    <div className={cx('space-y-3 rounded-xl border border-brand-300 bg-brand-50/50 p-4', big && 'text-lg')}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="نوع القرار">
        {KINDS.filter((k) => hasAlts || k.id === 'custom' || k.id === 'postpone').map((k) => (
          <button key={k.id} role="radio" aria-checked={kind === k.id} className={cx('btn', big ? '' : 'btn-sm', kind === k.id ? 'btn-primary' : 'btn-soft')} onClick={() => setKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === 'adopt_alt' && clause && (
        <div className="space-y-1.5">
          {clause.alternatives.map((a) => (
            <label key={a.id} className={cx('flex cursor-pointer gap-2 rounded-lg border p-2 text-sm', altId === a.id ? 'border-brand-600 bg-paper' : 'border-line')}>
              <input type="radio" name={`alt-${item.id}`} className="mt-1 accent-brand-700" checked={altId === a.id} onChange={() => setAltId(a.id)} />
              <span>
                <b>{a.label}</b>
                <span className="block text-mute"><Resolved text={resolveText(a.text, ctx)} /></span>
              </span>
            </label>
          ))}
        </div>
      )}
      {kind === 'custom' && (
        <Field label="نص القرار المخصص">
          <TextArea rows={3} value={text} onChange={setText} placeholder="اكتب نص القرار كما اتفق عليه الحضور" />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مبررات القرار">
          <TextArea rows={2} value={rationale} onChange={setRationale} />
        </Field>
        <Field label="التحفظات والاعتراضات">
          <TextArea rows={2} value={reservations} onChange={setReservations} />
        </Field>
        <Field label="المسؤول عن المتابعة">
          <TextInput value={owner} onChange={setOwner} />
        </Field>
        <Field label="الموعد المستهدف للتنفيذ">
          <TextInput type="date" value={due} onChange={setDue} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button className={cx('btn btn-primary', big && 'text-lg')} onClick={() => void save()}>
          {dec ? 'تحديث القرار' : 'تسجيل القرار'}
        </button>
        {dec && <Badge tone="ok">{decisionNumber(dec.number)}</Badge>}
        <span className="hint">لا يُعتمد أي بند إلا بتسجيل قرارك هنا. وتصويت الاجتماع الاستشاري لا يغني عن إجراءات الاعتماد النظامية.</span>
      </div>
    </div>
  );
};

// ───── تسجيل القرارات
const Record = ({ meeting }: { meeting: Meeting }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const update = useStore((s) => s.update);
  if (meeting.agenda.length === 0) return <EmptyState>أضف بنودًا إلى جدول الأعمال أولًا (وضع التحضير).</EmptyState>;
  const done = meeting.agenda.filter((a) => a.state === 'decided' || a.state === 'postponed').length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ProgressBar value={(done / meeting.agenda.length) * 100} label="نسبة الحسم" />
        <span className="ltr shrink-0 text-sm text-mute">{done}/{meeting.agenda.length}</span>
      </div>
      {meeting.agenda.map((a, i) => {
        const dec = a.decisionId ? meeting.decisions.find((d) => d.id === a.decisionId) : null;
        const open = openId === a.id;
        return (
          <div key={a.id} className="rounded-xl border border-line bg-paper p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ltr grid size-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">{i + 1}</span>
              <b className="min-w-0 flex-1">{a.title}</b>
              <Badge tone={STATE_TONE[a.state]}>{STATE_LABEL[a.state]}</Badge>
              {dec && <Badge tone="ok">{decisionNumber(dec.number)}</Badge>}
              <select
                aria-label="حالة النقاش"
                className="input w-36"
                value={a.state}
                onChange={(e) => update((d) => void (d.meetings.find((m) => m.id === meeting.id)!.agenda[i].state = e.target.value as AgendaItem['state']))}
              >
                {(Object.keys(STATE_LABEL) as AgendaItem['state'][]).map((s) => (
                  <option key={s} value={s}>{STATE_LABEL[s]}</option>
                ))}
              </select>
              <button className="btn btn-soft btn-sm" onClick={() => setOpenId(open ? null : a.id)}>
                {open ? 'إغلاق' : dec ? 'تعديل القرار' : 'تسجيل قرار'}
              </button>
            </div>
            {dec && !open && <p className="mt-2 text-sm text-mute">{dec.kind === 'postpone' ? 'مؤجل.' : dec.kind === 'exclude' ? 'استُبعد.' : dec.text.slice(0, 220)}{dec.rationale && ` — المبرر: ${dec.rationale}`}</p>}
            {open && (
              <div className="mt-3">
                <DecisionForm meeting={meeting} item={a} onDone={() => setOpenId(null)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ───── التصويت الاستشاري
const tally = (v: Vote): { yes: number; no: number; abstain: number; total: number } => {
  if (v.mode === 'counts') return { yes: v.yes, no: v.no, abstain: v.abstain, total: v.yes + v.no + v.abstain };
  const c = { yes: 0, no: 0, abstain: 0 };
  v.named.forEach((n) => void (c[n.choice] += 1));
  return { ...c, total: v.named.length };
};

const Votes = ({ meeting }: { meeting: Meeting }) => {
  const update = useStore((s) => s.update);
  if (meeting.agenda.length === 0) return <EmptyState>لا بنود في جدول الأعمال.</EmptyState>;
  return (
    <div className="space-y-4">
      <Callout tone="warn" title="تصويت استشاري">
        نتائج هذا التصويت لا تُعد قرارًا نظاميًا ملزمًا تلقائيًا؛ بل تُربط بإجراءات الاعتماد المعتمدة. سجّل الأصوات يدويًا (أسماء أو أعداد) ثم اعتمد القرار في «تسجيل القرارات».
      </Callout>
      {meeting.agenda.map((a, i) => {
        const set = (fn: (v: Vote) => void, k: string): void => update((d) => fn(d.meetings.find((m) => m.id === meeting.id)!.agenda[i].vote), `vt:${a.id}:${k}`);
        const t = tally(a.vote);
        const leader = t.yes > t.no ? 'الأغلبية مع الموافقة' : t.no > t.yes ? 'الأغلبية ضد' : t.total > 0 ? 'تعادل' : '';
        return (
          <Card key={a.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <b className="flex-1">{i + 1}. {a.title}</b>
              <Badge tone="warn">استشاري غير ملزم</Badge>
              <div className="flex gap-1">
                {(['counts', 'named'] as const).map((m) => (
                  <button key={m} className={cx('btn btn-sm', a.vote.mode === m ? 'btn-primary' : 'btn-soft')} onClick={() => set((v) => void (v.mode = m), 'm')}>
                    {m === 'counts' ? 'أعداد' : 'بالأسماء'}
                  </button>
                ))}
              </div>
            </div>
            {a.vote.mode === 'counts' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="المؤيدون">
                  <NumInput value={a.vote.yes} min={0} onChange={(v) => set((x) => void (x.yes = v ?? 0), 'y')} />
                </Field>
                <Field label="المعارضون">
                  <NumInput value={a.vote.no} min={0} onChange={(v) => set((x) => void (x.no = v ?? 0), 'n')} />
                </Field>
                <Field label="الممتنعون">
                  <NumInput value={a.vote.abstain} min={0} onChange={(v) => set((x) => void (x.abstain = v ?? 0), 'a')} />
                </Field>
              </div>
            ) : (
              <div className="space-y-2">
                {a.vote.named.map((n, ni) => (
                  <div key={n.id} className="flex items-center gap-2">
                    <TextInput value={n.name} ariaLabel="اسم المصوّت" placeholder="الاسم" onChange={(v) => set((x) => void (x.named[ni].name = v), `nm${n.id}`)} />
                    <SelectInput
                      value={n.choice}
                      className="w-36"
                      options={[{ value: 'yes', label: 'مؤيد' }, { value: 'no', label: 'معارض' }, { value: 'abstain', label: 'ممتنع' }]}
                      onChange={(v) => set((x) => void (x.named[ni].choice = v as 'yes' | 'no' | 'abstain'), `nc${n.id}`)}
                    />
                    <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => set((x) => void (x.named = x.named.filter((y) => y.id !== n.id)), 'del')}>
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <button className="btn btn-soft btn-sm" onClick={() => set((x) => void x.named.push({ id: uid('vn'), name: '', choice: 'yes' }), 'add')}>
                  <Plus className="size-4" /> إضافة مصوّت
                </button>
              </div>
            )}
            {t.total > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex h-5 overflow-hidden rounded-full text-[0.7rem] font-bold text-white" role="img" aria-label={`مؤيد ${t.yes} معارض ${t.no} ممتنع ${t.abstain}`}>
                  <div className="grid place-items-center bg-ok" style={{ width: `${(t.yes / t.total) * 100}%` }}>{t.yes || ''}</div>
                  <div className="grid place-items-center bg-bad" style={{ width: `${(t.no / t.total) * 100}%` }}>{t.no || ''}</div>
                  <div className="grid place-items-center bg-mute" style={{ width: `${(t.abstain / t.total) * 100}%` }}>{t.abstain || ''}</div>
                </div>
                <p className="text-sm">
                  المجموع {t.total}: مؤيد {Math.round((t.yes / t.total) * 100)}% — معارض {Math.round((t.no / t.total) * 100)}% — ممتنع {Math.round((t.abstain / t.total) * 100)}%. <b>{leader}</b> (نتيجة استشارية).
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

// ───── المحضر والمتابعة
const Minutes = ({ meeting }: { meeting: Meeting }) => {
  const update = useStore((s) => s.update);
  const mut = (fn: (m: Meeting) => void, key?: string): void => update((d) => fn(d.meetings.find((m) => m.id === meeting.id)!), key);
  const undone = meeting.decisions.filter((d) => !d.done);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-3 text-lg">الحضور (اختياري، محفوظ محليًا)</h2>
        <TextArea
          rows={3}
          ariaLabel="الحضور"
          placeholder="اسم في كل سطر"
          value={meeting.attendees.join('\n')}
          onChange={(v) => mut((m) => void (m.attendees = v.split('\n')), `att:${meeting.id}`)}
        />
        <p className="hint mt-1">عدد الحضور: {meeting.attendees.filter((x) => x.trim()).length}</p>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg">محضر الاجتماع</h2>
        <TextArea rows={6} ariaLabel="المحضر" value={meeting.minutes} placeholder="تدوين المداولات والملاحظات العامة…" onChange={(v) => mut((m) => void (m.minutes = v), `min:${meeting.id}`)} />
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">قرارات الاجتماع ({meeting.decisions.length})</h2>
          <Badge tone={undone.length ? 'warn' : 'ok'}>غير منجزة: {undone.length}</Badge>
        </div>
        {meeting.decisions.length === 0 && <EmptyState>لا قرارات مسجلة بعد.</EmptyState>}
        <ul className="space-y-2">
          {meeting.decisions.map((d, i) => (
            <li key={d.id} className="rounded-xl border border-line bg-paper p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ok">{decisionNumber(d.number)}</Badge>
                <b className="flex-1">{d.title}</b>
                <Check checked={d.done} onChange={(v) => mut((m) => void (m.decisions[i].done = v))} label="منجز" />
              </div>
              <p className="mt-1">{d.kind === 'postpone' ? 'تأجيل.' : d.kind === 'exclude' ? 'استبعاد من الميثاق.' : d.text}</p>
              {d.rationale && <p className="text-mute">المبررات: {d.rationale}</p>}
              {d.reservations && <p className="text-warn">تحفظات: {d.reservations}</p>}
              <p className="text-xs text-mute">المسؤول: {d.owner || '—'} · الموعد: {d.dueDate ? dateLabel(d.dueDate) : '—'}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg">متابعات للاجتماع القادم</h2>
        <ul className="space-y-2">
          {meeting.followUps.map((f, i) => (
            <li key={f.id} className="grid items-center gap-2 sm:grid-cols-[auto_2fr_1fr_1fr_auto]">
              <Check checked={f.done} onChange={(v) => mut((m) => void (m.followUps[i].done = v))} label="" />
              <TextInput value={f.text} ariaLabel="المتابعة" placeholder="المهمة" onChange={(v) => mut((m) => void (m.followUps[i].text = v), `fu${f.id}`)} />
              <TextInput value={f.owner} ariaLabel="المسؤول" placeholder="المسؤول" onChange={(v) => mut((m) => void (m.followUps[i].owner = v), `fo${f.id}`)} />
              <TextInput type="date" value={f.dueDate} ariaLabel="الموعد" onChange={(v) => mut((m) => void (m.followUps[i].dueDate = v))} />
              <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف" onClick={() => mut((m) => void (m.followUps = m.followUps.filter((x) => x.id !== f.id)))}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-soft btn-sm mt-3" onClick={() => mut((m) => void m.followUps.push({ id: uid('fu'), text: '', owner: '', dueDate: '', done: false }))}>
          <Plus className="size-4" /> إضافة متابعة
        </button>
      </Card>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          onClick={() => {
            useUi.setState({ reportMeetingId: meeting.id });
            go('reports');
          }}
        >
          <FileText className="size-4" /> توليد المحضر وجدول الأعمال للطباعة والتصدير
        </button>
      </div>
    </div>
  );
};

// ───── وضع العرض
const Present = ({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) => {
  const { project: p, ctx } = useDerived();
  const [i, setI] = useState(0);
  const [deciding, setDeciding] = useState(false);
  const items = meeting.agenda;
  const item = items[Math.min(i, Math.max(0, items.length - 1))];
  const clause = useMemo(() => (item?.clauseId ? p.clauses.find((c) => c.id === item.clauseId) : null), [item, p.clauses]);
  const go1 = (d: number): void => {
    setI((x) => Math.min(items.length - 1, Math.max(0, x + d)));
    setDeciding(false);
  };
  if (!item) return null;
  const rec = clause?.recommendation;
  return (
    <div className="present fixed inset-0 z-[55] overflow-y-auto bg-ivory" role="dialog" aria-modal="true" aria-label="وضع العرض">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge tone="gold">{i + 1} من {items.length}</Badge>
            <Badge tone={STATE_TONE[item.state]}>{STATE_LABEL[item.state]}</Badge>
          </div>
          <button className="btn btn-soft" onClick={onClose}>
            <X className="size-5" /> خروج
          </button>
        </div>
        <ProgressBar value={((i + 1) / items.length) * 100} label="التقدم في جدول الأعمال" />
        <h2 className="present-title text-3xl leading-tight sm:text-5xl">{item.title}</h2>
        <p className="text-2xl font-semibold text-brand-800">{item.question}</p>
        {item.summary && <p className="max-w-4xl text-xl leading-relaxed text-mute">{item.summary}</p>}

        {clause && (
          <div className="grid gap-4 md:grid-cols-2">
            {clause.alternatives.map((a) => (
              <div key={a.id} className={cx('rounded-2xl border-2 p-5', rec?.altId === a.id ? 'border-gold bg-gold-soft/50' : 'border-line bg-paper')}>
                <div className="mb-2 flex items-center gap-2 text-xl font-bold text-brand-900">
                  {clause.alternatives.length > 1 ? a.label : 'الصيغة المقترحة'}
                  {rec?.altId === a.id && <Badge tone="gold">توصية مبدئية</Badge>}
                </div>
                <p className="text-lg leading-relaxed"><Resolved text={resolveText(a.text, ctx)} /></p>
                {(a.pros || a.cons || a.impact) && (
                  <ul className="mt-3 space-y-1 text-base">
                    {a.pros && <li><b className="text-ok">+ </b>{a.pros}</li>}
                    {a.cons && <li><b className="text-bad">− </b>{a.cons}</li>}
                    {a.impact && <li><b className="text-info">الأثر: </b>{a.impact}</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {rec && <p className="rounded-xl bg-gold-soft p-4 text-lg text-gold-deep">{rec.why} <span className="text-base">(توصية قابلة للرفض)</span></p>}

        {deciding ? (
          <DecisionForm meeting={meeting} item={item} big onDone={() => setDeciding(false)} />
        ) : (
          <button className="btn btn-primary text-xl" onClick={() => setDeciding(true)}>
            {item.decisionId ? 'تعديل القرار' : 'تسجيل قرار'}
          </button>
        )}

        <div className="flex items-center justify-between pt-4">
          <button className="btn btn-soft text-lg" onClick={() => go1(-1)} disabled={i === 0}>
            <ChevronRight className="size-5" /> السابق
          </button>
          <button className="btn btn-primary text-lg" onClick={() => go1(1)} disabled={i === items.length - 1}>
            التالي <ChevronLeft className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
