import type {
  AgendaItem,
  CategoryId,
  Clause,
  ClauseStatus,
  DecisionKind,
  Meeting,
  MeetingDecision,
  Project,
  VarValue,
  Vote,
} from '../types';
import { todayIso, uid } from './format';
import { clauseText, clauseVarKeys, selectedAlt } from './clauses';

// تعديلات نقية على نسخة قابلة للتعديل من المشروع (immer draft).

const findClause = (d: Project, id: string): Clause => {
  const c = d.clauses.find((x) => x.id === id);
  if (!c) throw new Error(`البند غير موجود: ${id}`);
  return c;
};

const snapshotVars = (d: Project, c: Clause): Record<string, VarValue> => {
  const out: Record<string, VarValue> = {};
  for (const k of clauseVarKeys(c, clauseText(c))) if (k in d.vars) out[k] = d.vars[k];
  return out;
};

export const setStatus = (d: Project, id: string, status: ClauseStatus, date: string = todayIso()): void => {
  const c = findClause(d, id);
  c.status = status;
  if (status === 'approved') {
    c.decisionDate = date;
    c.approvedVars = snapshotVars(d, c);
  } else {
    c.decisionDate = null;
    c.approvedVars = null;
    c.meetingDecisionId = null;
  }
};

/** اختيار بديل: يطبق قيم متغيراته، ويُسقط الاعتماد السابق لأن القرار تغيّر */
export const chooseAlt = (d: Project, id: string, altId: string): void => {
  const c = findClause(d, id);
  const alt = c.alternatives.find((a) => a.id === altId);
  if (!alt) throw new Error(`البديل غير موجود: ${id}/${altId}`);
  c.selectedAlt = altId;
  c.customText = null;
  for (const [k, v] of Object.entries(alt.sets ?? {})) d.vars[k] = v;
  if (c.status === 'approved') setStatus(d, id, 'discuss');
};

export const setCustomText = (d: Project, id: string, text: string | null): void => {
  const c = findClause(d, id);
  c.customText = text === '' ? null : text;
  if (c.status === 'approved') setStatus(d, id, 'discuss');
};

export const newClause = (d: Project, category: CategoryId): string => {
  const id = `CUS-${String(d.clauses.filter((c) => c.custom).length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`;
  const order = Math.max(-1, ...d.clauses.map((c) => c.order)) + 1;
  d.clauses.push({
    id,
    category,
    title: 'بند جديد',
    explanation: '',
    why: 'بند أضافه المستخدم.',
    alternatives: [{ id: 'a', label: 'الصيغة المقترحة', text: 'اكتب نص البند هنا.', pros: '', cons: '', impact: '' }],
    selectedAlt: 'a',
    customText: null,
    questions: [],
    related: [],
    affects: [],
    status: 'discuss',
    rationale: '',
    notes: '',
    decisionDate: null,
    meetingDecisionId: null,
    legalRef: '',
    legalCheck: false,
    core: false,
    contested: false,
    recommendation: null,
    custom: true,
    approvedVars: null,
    order,
  });
  return id;
};

/** تكرار بند لتعديل نسخته دون المساس بالأصل */
export const duplicateClause = (d: Project, id: string): string => {
  const src = findClause(d, id);
  const copyId = `CUS-${Math.random().toString(36).slice(2, 7)}`;
  const order = Math.max(-1, ...d.clauses.map((c) => c.order)) + 1;
  d.clauses.push({
    ...(JSON.parse(JSON.stringify(src)) as Clause),
    id: copyId,
    title: `${src.title} (نسخة)`,
    status: 'discuss',
    decisionDate: null,
    meetingDecisionId: null,
    approvedVars: null,
    core: false,
    custom: true,
    order,
  });
  return copyId;
};

export const deleteCustomClause = (d: Project, id: string): void => {
  const c = findClause(d, id);
  if (!c.custom) throw new Error('لا يُحذف البند المقترح من المكتبة؛ استبعده من الميثاق بدلًا من ذلك.');
  d.clauses = d.clauses.filter((x) => x.id !== id);
};

/** تحريك بند خطوة لأعلى أو لأسفل ضمن مجاله */
export const moveClause = (d: Project, id: string, dir: -1 | 1): void => {
  const c = findClause(d, id);
  const peers = d.clauses.filter((x) => x.category === c.category).sort((a, b) => a.order - b.order);
  const i = peers.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= peers.length) return;
  const other = peers[j];
  const tmp = c.order;
  c.order = other.order;
  other.order = tmp;
};

// ───── الاجتماعات والقرارات

export const emptyVote = (): Vote => ({ mode: 'counts', yes: 0, no: 0, abstain: 0, named: [] });

export const newMeeting = (d: Project): string => {
  const id = uid('mtg');
  d.meetings.push({
    id,
    title: `الاجتماع ${d.meetings.length + 1}`,
    date: todayIso(),
    place: '',
    attendees: [],
    agenda: [],
    decisions: [],
    minutes: '',
    followUps: [],
  });
  return id;
};

const meetingOf = (d: Project, id: string): Meeting => {
  const m = d.meetings.find((x) => x.id === id);
  if (!m) throw new Error(`الاجتماع غير موجود: ${id}`);
  return m;
};

const agendaFromClause = (c: Clause): AgendaItem => ({
  id: uid('ag'),
  clauseId: c.id,
  title: c.title,
  question: c.questions[0] ?? c.title,
  summary: c.explanation || c.why,
  optionsText: c.alternatives.map((a) => a.label).join(' | '),
  impactText: '',
  recommendation: c.recommendation ? (c.alternatives.find((a) => a.id === c.recommendation!.altId)?.label ?? '') : '',
  state: 'pending',
  decisionId: null,
  vote: emptyVote(),
  notes: '',
  owner: '',
  targetDate: '',
});

/** يضيف إلى جدول الأعمال كل البنود غير المحسومة (الأساسية أولًا) التي لم تُدرج بعد */
export const fillAgenda = (d: Project, meetingId: string): number => {
  const m = meetingOf(d, meetingId);
  const have = new Set(m.agenda.map((a) => a.clauseId));
  const todo = d.clauses
    .filter((c) => c.status === 'discuss' && !have.has(c.id))
    .sort((a, b) => Number(b.core) - Number(a.core) || a.order - b.order);
  for (const c of todo) m.agenda.push(agendaFromClause(c));
  return todo.length;
};

export const addClauseToAgenda = (d: Project, meetingId: string, clauseId: string): void => {
  const m = meetingOf(d, meetingId);
  if (m.agenda.some((a) => a.clauseId === clauseId)) return;
  m.agenda.push(agendaFromClause(findClause(d, clauseId)));
};

export const addCustomTopic = (d: Project, meetingId: string, title: string): void => {
  meetingOf(d, meetingId).agenda.push({
    id: uid('ag'),
    clauseId: null,
    title,
    question: title,
    summary: '',
    optionsText: '',
    impactText: '',
    recommendation: '',
    state: 'pending',
    decisionId: null,
    vote: emptyVote(),
    notes: '',
    owner: '',
    targetDate: '',
  });
};

export interface DecisionInput {
  kind: DecisionKind;
  altId?: string;
  text?: string;
  rationale: string;
  reservations: string;
  owner: string;
  dueDate: string;
}

export const decisionNumber = (n: number): string => `ق-${String(n).padStart(3, '0')}`;

/** يسجل قرارًا على بند من جدول الأعمال، ويطبقه على البند المرتبط (اختيار البديل واعتماده) */
export const recordDecision = (d: Project, meetingId: string, agendaId: string, input: DecisionInput): MeetingDecision => {
  const m = meetingOf(d, meetingId);
  const item = m.agenda.find((a) => a.id === agendaId);
  if (!item) throw new Error('بند جدول الأعمال غير موجود.');

  let text = input.text ?? '';
  const clause = item.clauseId ? findClause(d, item.clauseId) : null;
  if (clause) {
    if (input.kind === 'adopt_alt') {
      if (!input.altId) throw new Error('اختر البديل المراد اعتماده.');
      chooseAlt(d, clause.id, input.altId);
      text = clauseText(clause);
    } else if (input.kind === 'custom') {
      if (!input.text?.trim()) throw new Error('اكتب نص القرار المخصص.');
      clause.customText = input.text;
      text = input.text;
    }
  }
  if (!clause && !text.trim() && input.kind !== 'postpone') throw new Error('اكتب نص القرار.');

  let dec = item.decisionId ? m.decisions.find((x) => x.id === item.decisionId) : undefined;
  if (!dec) {
    d.counters.decision += 1;
    dec = {
      id: uid('dec'),
      number: d.counters.decision,
      agendaId,
      clauseId: item.clauseId,
      altId: null,
      kind: input.kind,
      title: item.title,
      text: '',
      rationale: '',
      reservations: '',
      owner: '',
      dueDate: '',
      done: false,
    };
    m.decisions.push(dec);
  }
  dec.kind = input.kind;
  dec.altId = input.kind === 'adopt_alt' ? (input.altId ?? null) : null;
  dec.text = text;
  dec.rationale = input.rationale;
  dec.reservations = input.reservations;
  dec.owner = input.owner;
  dec.dueDate = input.dueDate;

  if (clause) {
    clause.rationale = input.rationale;
    clause.meetingDecisionId = dec.id;
    const status: ClauseStatus = input.kind === 'postpone' ? 'postponed' : input.kind === 'exclude' ? 'excluded' : 'approved';
    setStatus(d, clause.id, status, m.date || todayIso());
    clause.meetingDecisionId = dec.id;
    if (status !== 'approved') clause.rationale = input.rationale;
  }
  item.state = input.kind === 'postpone' ? 'postponed' : 'decided';
  item.decisionId = dec.id;
  return dec;
};

export const selectedLabel = (c: Clause): string => selectedAlt(c).label;
