// نماذج البيانات: ملف واحد يصف كل ما يُحفظ في المشروع.

export type VarValue = number | string | boolean | null;
export type Vars = Record<string, VarValue>;

export type VarType =
  | 'text'
  | 'integer'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'month'
  | 'boolean'
  | 'select';

export interface VarDef {
  key: string;
  label: string;
  type: VarType;
  group: string;
  help?: string;
  unit?: string;
  options?: { value: string; label: string }[];
  /** قيمة ابتدائية؛ null تعني «لم يُحدد بعد» وسيظهر تنبيه استكمال */
  def: VarValue;
  /** افتراض تحليلي وليس قرارًا أو معلومة فعلية */
  assumption?: boolean;
  min?: number;
  max?: number;
}

// ───────── البنود ─────────
export type CategoryId =
  | 'foundation'
  | 'membership'
  | 'contributions'
  | 'loans'
  | 'aid'
  | 'board'
  | 'finance'
  | 'endowment'
  | 'continuity';

export type ClauseStatus = 'approved' | 'discuss' | 'postponed' | 'excluded';

export interface Alternative {
  id: string;
  label: string;
  text: string;
  pros: string;
  cons: string;
  impact: string;
  /** قيم متغيرات تُطبّق عند اختيار هذا البديل */
  sets?: Record<string, VarValue>;
  /** وسوم يقرؤها محرك العدالة والتعارضات */
  flags?: string[];
}

export interface Clause {
  id: string;
  category: CategoryId;
  title: string;
  explanation: string;
  why: string;
  alternatives: Alternative[];
  selectedAlt: string;
  customText: string | null;
  questions: string[];
  related: string[];
  affects: string[];
  status: ClauseStatus;
  rationale: string;
  notes: string;
  decisionDate: string | null;
  meetingDecisionId: string | null;
  legalRef: string;
  /** يحتاج تحققًا نظاميًا قبل الاعتماد */
  legalCheck: boolean;
  /** بند أساسي يدخل في معايير الاكتمال */
  core: boolean;
  contested: boolean;
  recommendation: { altId: string; why: string } | null;
  custom: boolean;
  /** لقطة المتغيرات وقت الاعتماد لاكتشاف تغيّرها لاحقًا */
  approvedVars: Vars | null;
  order: number;
}

// ───────── الهوية ─────────
export interface IdentityOption {
  id: string;
  text: string;
  custom: boolean;
}
export interface IdentityGroup {
  id: string;
  label: string;
  hint: string;
  multi: boolean;
  options: IdentityOption[];
  selected: string[];
  /** لا يُعد الاختيار معتمدًا حتى يؤكده المستخدم */
  confirmed: boolean;
}
export interface Identity {
  namingMode: 'undecided' | 'family' | 'different' | 'general';
  groups: IdentityGroup[];
}

// ───────── العضوية ─────────
export type RightKey = 'aid' | 'loan' | 'priority' | 'vote' | 'candidacy' | 'reports';
export type RightLevel = 'yes' | 'conditional' | 'no' | 'undecided';
export interface Tier {
  id: string;
  name: string;
  description: string;
  rights: Record<RightKey, RightLevel>;
  note: string;
}
export interface Branch {
  id: string;
  name: string;
  note: string;
}

// ───────── الاشتراكات ─────────
export interface ContribGroup {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'mixed';
  target: number | null;
  participation: number;
  monthlyAmount: number | null;
  years: number | null;
  joinOffsetMonths: number;
  actual: number | null;
}
export interface ContribOption {
  id: string;
  name: string;
  monthly: number | null;
  years: number | null;
  illustrative: boolean;
}

// ───────── القروض والمساعدات ─────────
export interface LoanPurpose {
  id: string;
  name: string;
  maxAmount: number | null;
  termMonths: number | null;
  docs: string;
  priority: number;
  maxRepeat: string;
  collateral: string;
  exceptions: string;
  rescheduling: string;
}
export interface LoanFactor {
  id: string;
  label: string;
  weight: number;
}
export interface LoanTrack {
  id: string;
  name: string;
  share: number;
  description: string;
}
/** قرض مخطط بعينه يُضاف إلى المحاكاة (اختياري) */
export interface LoanEntry {
  id: string;
  label: string;
  amount: number | null;
  startYm: string;
  termMonths: number | null;
}
export interface Applicant {
  id: string;
  name: string;
  scores: Record<string, number>;
}

export type UseKey = 'aid' | 'loans' | 'ops' | 'investment' | 'reserve';
export interface FundType {
  id: string;
  name: string;
  description: string;
  uses: Record<UseKey, boolean>;
}
export interface AidType {
  id: string;
  name: string;
  definition: string;
  eligibility: string;
  cap: number | null;
  approval: string;
  docs: string;
  repeat: string;
  confidentiality: 'عادية' | 'مرتفعة' | 'سرية تامة';
  fundId: string;
}
export interface Allocation {
  id: string;
  label: string;
  share: number;
  note: string;
}

// ───────── الحوكمة ─────────
export type CriterionMode = 'undecided' | 'required' | 'preferred' | 'none';
export interface Criterion {
  id: string;
  label: string;
  mode: CriterionMode;
}
export interface Committee {
  id: string;
  name: string;
  duties: string;
  members: string;
  term: string;
  powers: string;
  delegation: string;
  reporting: string;
  recusal: string;
}
export interface ApprovalLimit {
  id: string;
  level: string;
  limit: number | null;
  approver: string;
  note: string;
}
export interface RaciRole {
  id: string;
  name: string;
}
export type RaciValue = '' | 'R' | 'A' | 'C' | 'I';
export interface RaciRow {
  id: string;
  process: string;
  cells: Record<string, RaciValue>;
}

// ───────── الأصول ─────────
export type AssetType = 'land' | 'residential' | 'commercial' | 'units' | 'warehouse' | 'portfolio' | 'other';
export type AssetStatus = 'idea' | 'targeted' | 'buying' | 'owned' | 'waqf_documented';
export type OwnershipState = 'none' | 'pending' | 'deed';
export type WaqfDocState = 'none' | 'drafting' | 'submitted' | 'documented';
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  location: string;
  area: number | null;
  units: number | null;
  targetCost: number | null;
  estimatedValue: number | null;
  fundingAvailable: number | null;
  targetYear: number | null;
  fundingSource: string;
  annualGrossIncome: number | null;
  occupancy: number | null;
  annualMaintenance: number | null;
  annualOpex: number | null;
  growthRate: number | null;
  reservePct: number | null;
  ownership: OwnershipState;
  deedNumber: string;
  waqfDoc: WaqfDocState;
  waqfConditions: string;
  nazir: string;
  distribution: string;
  /** المخطط له بعد التملك: ملك للصندوق أو وقف مستقل */
  holding: 'fund' | 'waqf';
  notes: string;
}

export interface Phase {
  id: string;
  title: string;
  detail: string;
  status: 'todo' | 'doing' | 'done';
  when: string;
}

// ───────── السيناريوهات ─────────
export type ScenarioId = 'conservative' | 'base' | 'optimistic';
export interface ScenarioAssumptions {
  name: string;
  /** تعديل (بنقاط مئوية) على نسبة التحصيل المشتقة من نسب الانتظام والتأخر */
  collectionDelta: number;
  subscriberGrowth: number;
  loanDefault: number;
  inflation: number;
  rentGrowth: number;
  occupancyDelta: number;
  propertyGrowth: number;
  portfolioReturn: number;
}

// ───────── المخاطر ─────────
export type RiskStatus = 'open' | 'mitigating' | 'accepted' | 'closed';
export interface Risk {
  id: string;
  title: string;
  probability: number;
  impact: number;
  prevention: string;
  response: string;
  owner: string;
  indicator: string;
  status: RiskStatus;
}

// ───────── الاجتماعات ─────────
export interface Vote {
  mode: 'counts' | 'named';
  yes: number;
  no: number;
  abstain: number;
  named: { id: string; name: string; choice: 'yes' | 'no' | 'abstain' }[];
}
export type AgendaState = 'pending' | 'discussing' | 'decided' | 'postponed';
export interface AgendaItem {
  id: string;
  clauseId: string | null;
  title: string;
  question: string;
  summary: string;
  optionsText: string;
  impactText: string;
  recommendation: string;
  state: AgendaState;
  decisionId: string | null;
  vote: Vote;
  notes: string;
  owner: string;
  targetDate: string;
}
export type DecisionKind = 'adopt_alt' | 'custom' | 'postpone' | 'exclude';
export interface MeetingDecision {
  id: string;
  number: number;
  agendaId: string;
  clauseId: string | null;
  altId: string | null;
  kind: DecisionKind;
  title: string;
  text: string;
  rationale: string;
  reservations: string;
  owner: string;
  dueDate: string;
  done: boolean;
}
export interface FollowUp {
  id: string;
  text: string;
  owner: string;
  dueDate: string;
  done: boolean;
}
export interface Meeting {
  id: string;
  title: string;
  date: string;
  place: string;
  attendees: string[];
  agenda: AgendaItem[];
  decisions: MeetingDecision[];
  minutes: string;
  followUps: FollowUp[];
}

// ───────── المرجعية النظامية والمراجعة ─────────
export type LegalClass = 'verified' | 'governance' | 'review';
export interface LegalRef {
  id: string;
  topic: string;
  summary: string;
  cls: LegalClass;
  source: string;
  url: string;
  accessed: string;
  builtin: boolean;
  note: string;
}
export interface ReviewItem {
  id: string;
  text: string;
  done: boolean;
  note: string;
  builtin: boolean;
}
export type FindingStatus = 'open' | 'resolved' | 'accepted';
export interface FindingState {
  status: FindingStatus;
  note: string;
}

// ───────── المستندات ─────────
export interface Signatory {
  id: string;
  name: string;
  role: string;
}
export interface DocSettings {
  titles: Record<string, string>;
  issueDate: string;
  reviewDate: string;
  version: string;
  includeProposed: boolean;
  signatures: boolean;
  signatories: Signatory[];
  footerLine: string;
}

// ───────── العرض والتسجيل ─────────
export interface PresentationSettings {
  /** شرائح مخفاة من العرض ومن وثيقة الشرح المبسط */
  hidden: Record<string, boolean>;
  /** نقطة إضافية يكتبها المستخدم لكل شريحة */
  extra: Record<string, string>;
}
export interface RegSettings {
  /** رابط نشر خدمة التسجيل (Google Apps Script) */
  endpoint: string;
  intro: string;
  /** خيارات الاشتراك الشهري المقترحة للمشاركين (ريال) */
  amounts: number[];
  /** خيارات مدة الالتزام المقترحة (سنوات) */
  years: number[];
  allowOneTime: boolean;
  /** استقبال التسجيلات */
  open: boolean;
}

// ───────── المشروع ─────────
export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  vars: Vars;
  clauses: Clause[];
  identity: Identity;
  tiers: Tier[];
  branches: Branch[];
  groups: ContribGroup[];
  contribOptions: ContribOption[];
  loanPurposes: LoanPurpose[];
  loanFactors: LoanFactor[];
  loanTracks: LoanTrack[];
  loanLedger: LoanEntry[];
  applicants: Applicant[];
  fundTypes: FundType[];
  aidTypes: AidType[];
  activityBudget: Allocation[];
  criteria: Criterion[];
  committees: Committee[];
  approvalLimits: ApprovalLimit[];
  raciRoles: RaciRole[];
  raci: RaciRow[];
  assets: Asset[];
  returnsAllocation: Allocation[];
  foundingPhases: Phase[];
  transitionPhases: Phase[];
  scenarios: Record<ScenarioId, ScenarioAssumptions>;
  risks: Risk[];
  meetings: Meeting[];
  legalRefs: LegalRef[];
  reviewItems: ReviewItem[];
  findings: Record<string, FindingState>;
  docSettings: DocSettings;
  presentation: PresentationSettings;
  registration: RegSettings;
  /** اعتماد صريح من المستخدم لبنى مقترحة (فئات، أوزان، لجان…) */
  confirmations: Record<string, boolean>;
  counters: { decision: number };
  /** true إذا حُمّلت بيانات توضيحية غير حقيقية */
  demo: boolean;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export interface BackupEntry {
  id: string;
  at: string;
  label: string;
  project: Project;
}
