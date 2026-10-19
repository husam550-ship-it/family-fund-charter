import type { Branch, ContribGroup, Project, Vars } from '../types';
import { todayIso, uid } from '../lib/format';
import { VAR_DEFS } from './variables';
import { buildClauseLibrary } from './clauses';
import { buildIdentity } from './identity';
import {
  buildActivityBudget,
  buildAidTypes,
  buildApprovalLimits,
  buildCommittees,
  buildCriteria,
  buildFoundingPhases,
  buildFundTypes,
  buildLoanFactors,
  buildLoanPurposes,
  buildLoanTracks,
  buildRaci,
  buildReturnsAllocation,
  buildRisks,
  buildScenarios,
  buildTiers,
  buildTransitionPhases,
} from './structures';
import { buildLegalRefs, buildReviewItems } from './legal';

export const SCHEMA_VERSION = 1;

export const DEFAULT_PROJECT_NAME = 'مشروع {{charter_name}}';

export const DOC_DEFS: { id: string; title: string }[] = [
  { id: 'charter', title: '{{charter_name}}' },
  { id: 'bylaws', title: 'مسودة اللائحة الأساسية للصندوق' },
  { id: 'contrib', title: 'لائحة الاشتراكات والالتزامات' },
  { id: 'loans', title: 'لائحة القروض الحسنة والتكافل' },
  { id: 'board', title: 'ميثاق مجلس الأمناء والحوكمة' },
  { id: 'finpol', title: 'السياسة المالية والاستثمارية' },
  { id: 'endow', title: 'تصور الأوقاف والأصول العقارية' },
  { id: 'plan', title: 'الخطة المالية والاستدامة' },
  { id: 'agenda', title: 'جدول أعمال الاجتماع العائلي' },
  { id: 'minutes', title: 'محضر الاجتماع وقراراته' },
  { id: 'open', title: 'تقرير القرارات غير المحسومة' },
  { id: 'risk', title: 'تقرير مخاطر المشروع وفجواته' },
  { id: 'summary', title: 'الملخص التنفيذي لأفراد العائلة' },
  { id: 'explainer', title: 'الشرح المبسط لـ{{charter_name}}' },
];

export const defaultVars = (): Vars => Object.fromEntries(VAR_DEFS.map((d) => [d.key, d.def]));

const defaultGroups = (): ContribGroup[] => [
  { id: 'grp-male', name: 'الذكور', gender: 'male', target: null, participation: 100, monthlyAmount: null, years: null, joinOffsetMonths: 0, actual: null },
  { id: 'grp-female', name: 'الإناث', gender: 'female', target: null, participation: 100, monthlyAmount: null, years: null, joinOffsetMonths: 0, actual: null },
];

const defaultBranches = (): Branch[] => [];

export const createDefaultProject = (): Project => {
  const now = new Date().toISOString();
  const raci = buildRaci();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('proj'),
    name: DEFAULT_PROJECT_NAME,
    createdAt: now,
    updatedAt: now,
    vars: defaultVars(),
    clauses: buildClauseLibrary(),
    identity: buildIdentity(),
    tiers: buildTiers(),
    branches: defaultBranches(),
    groups: defaultGroups(),
    contribOptions: [],
    loanPurposes: buildLoanPurposes(),
    loanFactors: buildLoanFactors(),
    loanTracks: buildLoanTracks(),
    loanLedger: [],
    applicants: [],
    fundTypes: buildFundTypes(),
    aidTypes: buildAidTypes(),
    activityBudget: buildActivityBudget(),
    criteria: buildCriteria(),
    committees: buildCommittees(),
    approvalLimits: buildApprovalLimits(),
    raciRoles: raci.roles,
    raci: raci.rows,
    assets: [],
    returnsAllocation: buildReturnsAllocation(),
    foundingPhases: buildFoundingPhases(),
    transitionPhases: buildTransitionPhases(),
    scenarios: buildScenarios(),
    risks: buildRisks(),
    meetings: [],
    legalRefs: buildLegalRefs(),
    reviewItems: buildReviewItems(),
    findings: {},
    docSettings: {
      titles: {},
      issueDate: todayIso(),
      reviewDate: '',
      version: '0.1 (مسودة للنقاش)',
      includeProposed: true,
      signatures: false,
      signatories: [
        { id: 'sg-1', name: '', role: 'رئيس مجلس الأمناء' },
        { id: 'sg-2', name: '', role: 'نائب الرئيس' },
        { id: 'sg-3', name: '', role: 'أمين السر' },
      ],
      footerLine: '{{fund_name}} — مسودة قيد النقاش غير معتمدة نظامًا',
    },
    presentation: { hidden: {}, extra: {} },
    registration: {
      endpoint: '',
      intro:
        'يسرّنا مشاركتك في بناء ميثاق عائلتنا. سجّل بياناتك الأساسية ثم اختر الالتزام الذي تراه مناسبًا. ما تدخله يُحفظ مباشرة ويمكنك تعديله في أي وقت قبل اعتماد الميثاق.',
      amounts: [],
      years: [],
      allowOneTime: true,
      open: true,
    },
    confirmations: {},
    counters: { decision: 0 },
    demo: false,
  };
};
