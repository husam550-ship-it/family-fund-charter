import type {
  AidType,
  Allocation,
  ApprovalLimit,
  Committee,
  Criterion,
  FundType,
  LoanFactor,
  LoanPurpose,
  LoanTrack,
  Phase,
  RaciRole,
  RaciRow,
  RaciValue,
  Risk,
  ScenarioAssumptions,
  ScenarioId,
  Tier,
} from '../types';

// بنى بيانات ابتدائية قابلة للتعديل كلها. القيم الرقمية المالية تُترك فارغة عمدًا.

export const RIGHT_LABELS: Record<string, string> = {
  aid: 'المساعدات الإنسانية',
  loan: 'التقدم للقروض',
  priority: 'أولوية القروض',
  vote: 'التصويت',
  candidacy: 'الترشح للمجلس',
  reports: 'الاطلاع على التقارير',
};

export const buildTiers = (): Tier[] => [
  {
    id: 'tier-member',
    name: 'منتسب بالنسب',
    description: 'كل فرد ضمن نطاق الذرية المعتمد ومسجل في سجل الأعضاء.',
    rights: { aid: 'yes', loan: 'conditional', priority: 'no', vote: 'yes', candidacy: 'conditional', reports: 'yes' },
    note: 'اقتراح مبدئي غير معتمد.',
  },
  {
    id: 'tier-regular',
    name: 'مشترك منتظم',
    description: 'مشترك يسدد اشتراكه في موعده.',
    rights: { aid: 'yes', loan: 'yes', priority: 'yes', vote: 'yes', candidacy: 'yes', reports: 'yes' },
    note: 'الأولوية عند تساوي الاستحقاق والحاجة فقط.',
  },
  {
    id: 'tier-late',
    name: 'مشترك متأخر مع القدرة',
    description: 'متأخر عن السداد رغم قدرته.',
    rights: { aid: 'yes', loan: 'conditional', priority: 'no', vote: 'yes', candidacy: 'conditional', reports: 'yes' },
    note: 'يُدرس طلبه وفق ضوابط معلنة ولا يُحرم آليًا.',
  },
  {
    id: 'tier-insolvent',
    name: 'مشترك معسر (معفى أو معلّق)',
    description: 'ثبت إعساره وفق الضوابط المعتمدة.',
    rights: { aid: 'yes', loan: 'conditional', priority: 'conditional', vote: 'yes', candidacy: 'conditional', reports: 'yes' },
    note: 'التكافل لا يسقط عنه، ويُعالج بآلية مستقلة عن مكافأة الانتظام.',
  },
  {
    id: 'tier-minor',
    name: 'قاصر',
    description: 'لم يبلغ سن الأهلية، ويتولى وليه شؤونه.',
    rights: { aid: 'yes', loan: 'no', priority: 'no', vote: 'no', candidacy: 'no', reports: 'conditional' },
    note: 'تنتقل صفته إلى منتسب عند بلوغ سن الأهلية.',
  },
  {
    id: 'tier-relative',
    name: 'قريب مستفيد (اختياري)',
    description: 'قريب يُسمى في اللائحة الأساسية، ولا يكون منتسبًا بالنسب.',
    rights: { aid: 'conditional', loan: 'conditional', priority: 'no', vote: 'no', candidacy: 'no', reports: 'no' },
    note: 'يتطلب تسمية الأقارب في اللائحة الأساسية وفق النص النظامي.',
  },
];

export const buildLoanPurposes = (): LoanPurpose[] => {
  const p = (
    id: string,
    name: string,
    docs: string,
    priority: number,
    rescheduling = 'تُدرس إعادة الجدولة عند ثبوت التعثر دون زيادة الدين',
  ): LoanPurpose => ({
    id,
    name,
    maxAmount: null,
    termMonths: null,
    docs,
    priority,
    maxRepeat: '',
    collateral: '',
    exceptions: '',
    rescheduling,
  });
  return [
    p('lp-med', 'العلاج', 'تقرير طبي وفواتير أو تقدير تكلفة العلاج', 1),
    p('lp-edu', 'التعليم', 'قبول دراسي أو إثبات رسوم', 2),
    p('lp-mar', 'الزواج', 'وثيقة عقد الزواج أو إثبات الخطبة والتكاليف', 3),
    p('lp-house', 'السكن', 'عقد إيجار أو تقدير تكلفة التملك', 3),
    p('lp-renov', 'ترميم المسكن', 'عرض سعر وإثبات ملكية أو إذن المالك', 4),
    p('lp-debt', 'معالجة التعثر المالي', 'كشف الالتزامات وإثبات التعثر', 2),
    p('lp-emerg', 'الحوادث والظروف الطارئة', 'تقرير الحادث أو إثبات الظرف الطارئ', 1),
    p('lp-basic', 'احتياجات أساسية أخرى', 'إثبات الحاجة وفق تقدير اللجنة', 3),
    p('lp-custom', 'أغراض يحددها الأعضاء', 'بحسب ما يقرره الأعضاء', 4),
  ];
};

export const buildLoanFactors = (): LoanFactor[] => [
  { id: 'lf-need', label: 'درجة الحاجة الفعلية', weight: 25 },
  { id: 'lf-urgency', label: 'الاستعجال', weight: 15 },
  { id: 'lf-regular', label: 'انتظام الاشتراكات', weight: 15 },
  { id: 'lf-ability', label: 'القدرة على السداد', weight: 15 },
  { id: 'lf-obligations', label: 'الالتزامات المالية القائمة', weight: 10 },
  { id: 'lf-prior', label: 'سبق الانتفاع من الصندوق', weight: 8 },
  { id: 'lf-wait', label: 'مدة انتظار الطلب', weight: 7 },
  { id: 'lf-social', label: 'الوضع الاجتماعي الخاص', weight: 5 },
];

export const buildLoanTracks = (): LoanTrack[] => [
  {
    id: 'lt-ordinary',
    name: 'القروض العادية',
    share: 60,
    description: 'تخضع للمفاضلة بالنقاط ولأولوية المنتظم عند التساوي.',
  },
  {
    id: 'lt-humanitarian',
    name: 'القروض الإنسانية ذات الأولوية',
    share: 30,
    description: 'حالات علاج وطوارئ ومعالجة تعثر، تُدرس بمعيار الحاجة والاستعجال.',
  },
  {
    id: 'lt-exception',
    name: 'الاستثناءات المبررة',
    share: 10,
    description: 'بمحضر مسبب وموافقة الجهة المخولة، وتُسجل في سجل الاستثناءات.',
  },
];

export const buildFundTypes = (): FundType[] => [
  {
    id: 'fund-general',
    name: 'الموارد العامة',
    description: 'الاشتراكات والتبرعات غير المقيدة.',
    uses: { aid: true, loans: true, ops: true, investment: true, reserve: true },
  },
  {
    id: 'fund-restricted',
    name: 'التبرعات المقيدة',
    description: 'تبرعات اشترط المتبرع لها وجهًا محددًا.',
    uses: { aid: false, loans: false, ops: false, investment: false, reserve: false },
  },
  {
    id: 'fund-zakat',
    name: 'أموال الزكاة',
    description: 'تودع في حساب مستقل ويُمسك لها سجل مستقل وتُصرف في مصارفها الشرعية.',
    uses: { aid: true, loans: false, ops: false, investment: false, reserve: false },
  },
  {
    id: 'fund-waqf',
    name: 'الأموال الوقفية',
    description: 'عوائد الأوقاف وأصولها، وتُصرف بحسب وثيقة الوقف وشروط الواقف.',
    uses: { aid: true, loans: false, ops: false, investment: true, reserve: true },
  },
];

export const buildAidTypes = (): AidType[] => {
  const a = (
    id: string,
    name: string,
    definition: string,
    eligibility: string,
    docs: string,
    confidentiality: AidType['confidentiality'],
  ): AidType => ({
    id,
    name,
    definition,
    eligibility,
    cap: null,
    approval: 'لجنة القروض والتكافل، وما زاد على سقفها يرفع للمجلس',
    docs,
    repeat: '',
    confidentiality,
    fundId: 'fund-general',
  });
  return [
    a('aid-med', 'المساعدة الطبية', 'المساهمة في تكاليف علاج لا تغطيها جهة أخرى.', 'منتسب مؤهل ثبتت حاجته.', 'تقرير طبي وفواتير وإثبات عدم التغطية', 'سرية تامة'),
    a('aid-live', 'المساعدة المعيشية', 'سد احتياج معيشي أساسي لأسرة محتاجة.', 'أسرة منتسبة ثبت عجزها المؤقت أو الدائم.', 'إثبات الدخل والالتزامات', 'مرتفعة'),
    a('aid-widow', 'مساندة الأرامل والأيتام', 'رعاية أسر فقدت عائلها.', 'أرملة منتسب أو أيتامه أو من في كفالته.', 'شهادة الوفاة وإثبات الإعالة', 'مرتفعة'),
    a('aid-disaster', 'الإغاثة عند الكوارث', 'عون عاجل عند حدوث كارثة لأحد الأفراد.', 'منتسب تضرر مباشرة.', 'تقرير الجهة المختصة أو شهود', 'عادية'),
    a('aid-edu', 'التعليم والتدريب', 'دعم رسوم دراسية أو تدريبية.', 'طالب أو متدرب منتسب.', 'قبول وإثبات الرسوم', 'عادية'),
    a('aid-death', 'حالات الوفاة', 'مساهمة في نفقات وفاة منتسب.', 'أسرة المتوفى المنتسب.', 'شهادة الوفاة', 'مرتفعة'),
    a('aid-critical', 'الحالات الاجتماعية الحرجة', 'حالات تتطلب تدخلًا خاصًا غير مصنفة.', 'بحسب تقدير اللجنة.', 'تقرير اجتماعي', 'سرية تامة'),
    a('aid-other', 'خدمات إضافية حسب احتياجات العائلة', 'خدمات يقرها المجلس بحسب الحاجة.', 'بحسب القرار المعتمد.', 'بحسب الخدمة', 'عادية'),
  ];
};

export const buildActivityBudget = (): Allocation[] => [
  { id: 'ab-med', label: 'المساعدة الطبية', share: 25, note: '' },
  { id: 'ab-live', label: 'المساعدة المعيشية', share: 20, note: '' },
  { id: 'ab-widow', label: 'مساندة الأرامل والأيتام', share: 15, note: '' },
  { id: 'ab-disaster', label: 'الإغاثة عند الكوارث', share: 5, note: '' },
  { id: 'ab-edu', label: 'التعليم والتدريب', share: 15, note: '' },
  { id: 'ab-death', label: 'حالات الوفاة', share: 5, note: '' },
  { id: 'ab-critical', label: 'الحالات الاجتماعية الحرجة', share: 10, note: '' },
  { id: 'ab-other', label: 'خدمات إضافية', share: 5, note: '' },
];

export const buildReturnsAllocation = (): Allocation[] => [
  { id: 'ra-aid', label: 'التكافل والمساعدات', share: 30, note: '' },
  { id: 'ra-loans', label: 'الإقراض الحسن (إن كان مسموحًا ومناسبًا لشروط المصدر)', share: 10, note: 'يُراجع جواز ذلك مع شروط الوقف' },
  { id: 'ra-maint', label: 'الصيانة', share: 15, note: '' },
  { id: 'ra-reserve', label: 'الاحتياطيات', share: 15, note: '' },
  { id: 'ra-reinvest', label: 'إعادة الاستثمار', share: 20, note: '' },
  { id: 'ra-other', label: 'مصارف أخرى يحددها الميثاق والوثيقة الوقفية', share: 10, note: '' },
];

export const buildCriteria = (): Criterion[] =>
  [
    'النزاهة وحسن السيرة',
    'الالتزام بميثاق الصندوق',
    'القدرة على تحمل المسؤولية',
    'عدم وجود تعارض مصالح غير قابل للمعالجة',
    'الاستعداد لحضور الاجتماعات',
    'المعرفة المالية أو الإدارية المناسبة لبعض المقاعد',
    'الإفصاح عن العلاقات والمصالح',
    'المحافظة على سرية بيانات المستفيدين',
    'الالتزام بقواعد الحوكمة',
    'عدم استغلال المنصب لمصلحة شخصية',
    'عدم احتكار المناصب',
  ].map((label, i) => ({ id: `cr-${i + 1}`, label, mode: 'undecided' as const }));

export const buildCommittees = (): Committee[] => {
  const c = (id: string, name: string, duties: string, members: string, powers: string, reporting: string): Committee => ({
    id,
    name,
    duties,
    members,
    term: 'بمدة دورة المجلس ما لم يقرر خلاف ذلك',
    powers,
    delegation: '',
    reporting,
    recusal: 'ينسحب العضو من أي مسألة له أو لأقاربه مصلحة فيها، ويُثبت ذلك في المحضر.',
  });
  return [
    c(
      'cm-loans',
      'لجنة القروض والتكافل',
      'دراسة طلبات القروض والمساعدات وفق اللائحة، وتطبيق نظام المفاضلة، ومتابعة القروض المتعثرة.',
      'عضو من المجلس رئيسًا، وأعضاء من المجلس أو الهيئة العائلية.',
      'الموافقة ضمن السقف المفوض، ورفع ما زاد للمجلس.',
      'تقرير ربع سنوي للمجلس.',
    ),
    c(
      'cm-finance',
      'اللجنة المالية والمراجعة',
      'مراجعة الميزانية والتقارير المالية، والإشراف على المراجع الخارجي، ومتابعة الرقابة الداخلية.',
      'عضو من المجلس رئيسًا، ومختص مالي.',
      'التوصية للمجلس بالميزانية والتقارير.',
      'تقرير ربع سنوي وتقرير سنوي.',
    ),
    c(
      'cm-invest',
      'لجنة الاستثمار والأوقاف',
      'دراسة جدوى الأصول، وتوصية المجلس بالشراء والبيع، ومتابعة أداء الأصول والنظارة.',
      'عضو من المجلس رئيسًا، ومختص عقاري أو استثماري.',
      'التوصية للمجلس، ولا تشتري بنفسها.',
      'تقرير نصف سنوي.',
    ),
    c(
      'cm-gov',
      'لجنة الترشيحات والحوكمة',
      'فرز أهلية المرشحين، وتنظيم الاختيار، ومراجعة سياسات الحوكمة وتعارض المصالح.',
      'عضو من المجلس رئيسًا، وعضوان من الهيئة العائلية.',
      'التوصية والتنظيم دون الاختيار.',
      'تقرير سنوي.',
    ),
    c(
      'cm-appeals',
      'لجنة التظلمات',
      'النظر في تظلمات المتقدمين والأعضاء من القرارات الصادرة بشأنهم.',
      'أعضاء لا صلة لهم بالطلب موضوع التظلم.',
      'الفصل في التظلم خلال المدة المعتمدة.',
      'تقرير سنوي بأعداد التظلمات ونتائجها.',
    ),
    c(
      'cm-risk',
      'لجنة إدارة المخاطر',
      'متابعة سجل المخاطر ومؤشرات الإنذار المبكر وخطة الاستمرارية.',
      'عضو من المجلس رئيسًا، وعضو مالي.',
      'التوصية للمجلس بالإجراءات الوقائية.',
      'تقرير نصف سنوي.',
    ),
  ];
};

export const buildApprovalLimits = (): ApprovalLimit[] => [
  { id: 'al-1', level: 'المسؤول التنفيذي أو أمين الصندوق', limit: null, approver: 'رئيس المجلس عند التجاوز', note: '' },
  { id: 'al-2', level: 'رئيس المجلس', limit: null, approver: 'اللجنة المالية', note: '' },
  { id: 'al-3', level: 'اللجنة المالية', limit: null, approver: 'مجلس الأمناء', note: '' },
  { id: 'al-4', level: 'مجلس الأمناء', limit: null, approver: 'موافقة مشددة', note: '' },
];

/** أمثلة افتراضية قابلة للاختيار لحدود الاعتماد، وليست أحكامًا نظامية */
export const APPROVAL_LIMIT_EXAMPLES: { name: string; limits: (number | null)[] }[] = [
  { name: 'مثال 1 (حدود متحفظة): 5,000 / 20,000 / 100,000 / أعلى', limits: [5000, 20000, 100000, null] },
  { name: 'مثال 2 (حدود متوسطة): 10,000 / 50,000 / 250,000 / أعلى', limits: [10000, 50000, 250000, null] },
  { name: 'مثال 3 (حدود أوسع): 25,000 / 100,000 / 500,000 / أعلى', limits: [25000, 100000, 500000, null] },
];

export const buildRaci = (): { roles: RaciRole[]; rows: RaciRow[] } => {
  const roles: RaciRole[] = [
    { id: 'r-chair', name: 'رئيس المجلس' },
    { id: 'r-board', name: 'المجلس' },
    { id: 'r-fin', name: 'اللجنة المالية' },
    { id: 'r-loans', name: 'لجنة القروض' },
    { id: 'r-treasurer', name: 'أمين الصندوق' },
    { id: 'r-family', name: 'الهيئة العائلية' },
  ];
  const row = (id: string, process: string, v: Partial<Record<string, RaciValue>>): RaciRow => ({
    id,
    process,
    cells: Object.fromEntries(roles.map((r) => [r.id, v[r.id] ?? ''])),
  });
  return {
    roles,
    rows: [
      row('rr-budget', 'اعتماد الميزانية السنوية', { 'r-chair': 'R', 'r-board': 'A', 'r-fin': 'C', 'r-treasurer': 'R', 'r-family': 'I' }),
      row('rr-spend', 'الصرف التشغيلي ضمن الميزانية', { 'r-chair': 'A', 'r-fin': 'I', 'r-treasurer': 'R' }),
      row('rr-loan', 'اعتماد القروض', { 'r-chair': 'I', 'r-board': 'A', 'r-loans': 'R', 'r-treasurer': 'C' }),
      row('rr-aid', 'اعتماد المساعدات', { 'r-board': 'A', 'r-loans': 'R', 'r-treasurer': 'C' }),
      row('rr-asset', 'شراء الأصول العقارية', { 'r-chair': 'R', 'r-board': 'A', 'r-fin': 'C', 'r-family': 'I' }),
      row('rr-audit', 'التعاقد مع المراجع الخارجي', { 'r-board': 'A', 'r-fin': 'R' }),
      row('rr-amend', 'تعديل الميثاق', { 'r-chair': 'R', 'r-board': 'A', 'r-family': 'C' }),
      row('rr-board-sel', 'اختيار المجلس', { 'r-board': 'R', 'r-family': 'C' }),
      row('rr-report', 'إعداد التقرير السنوي', { 'r-chair': 'A', 'r-fin': 'C', 'r-treasurer': 'R', 'r-family': 'I' }),
      row('rr-default', 'متابعة القروض المتعثرة', { 'r-board': 'I', 'r-loans': 'R', 'r-fin': 'A', 'r-treasurer': 'C' }),
    ],
  };
};

const ph = (id: string, title: string, detail: string, when = ''): Phase => ({ id, title, detail, status: 'todo', when });

export const buildFoundingPhases = (): Phase[] => [
  ph('fp-1', 'النقاش والاتفاق على المبادئ', 'اجتماعات العائلة لحسم النطاق والاشتراك والحوكمة باستخدام هذه المنصة.'),
  ph('fp-2', 'اعتماد مسودة الميثاق', 'اعتماد البنود الجوهرية وتوقيع المسودة بين أصحاب الشأن.'),
  ph('fp-3', 'المراجعة النظامية والشرعية والمالية', 'عرض المسودة على مختصين قبل التأسيس الرسمي.'),
  ph('fp-4', 'تجهيز طلب التأسيس واللائحة الأساسية', 'إعداد اللائحة الأساسية وفق النموذج المعتمد وبيانات المؤسسين.'),
  ph('fp-5', 'الترخيص والتأسيس الرسمي', 'تقديم الطلب للجهة المختصة وانتظار الإعلان والبت.'),
  ph('fp-6', 'فتح الحساب البنكي وبدء الاشتراكات', 'فتح حساب باسم الصندوق وبدء التحصيل وفق الجدول المعتمد.'),
  ph('fp-7', 'بناء الاحتياطي وتفعيل القروض والتكافل', 'تكوين السيولة الأولى وبدء الخدمات وفق اللوائح.'),
  ph('fp-8', 'الاستحواذ على أول أصل', 'دراسة الجدوى وشراء أول أصل بعد استيفاء ضوابط الاحتياطي.'),
  ph('fp-9', 'الاستقلال المالي بعد انتهاء الاشتراكات', 'تغطية النشاط من عوائد الأصول المستدامة.'),
];

export const buildTransitionPhases = (): Phase[] => [
  ph('tp-1', 'المرحلة 1: التأسيس وبناء الاحتياطي', 'جمع الاشتراكات وبناء احتياطي نقدي أدنى قبل أي استحواذ.'),
  ph('tp-2', 'المرحلة 2: دراسة الأصول المستهدفة', 'مقارنة الفرص العقارية والاستثمارية ودراسة الجدوى.'),
  ph('tp-3', 'المرحلة 3: الاستحواذ على أول أصل', 'الشراء بعد توافر السيولة والاحتياطي وموافقة المجلس.'),
  ph('tp-4', 'المرحلة 4: تجهيز الوقف والنظارة', 'مراجعة شروط الواقف والنظارة وتوثيق الوقف لدى الجهة المختصة وتسجيله عند الاقتضاء.'),
  ph('tp-5', 'المرحلة 5: التوسع وتنويع الأصول', 'إضافة أصول بحسب الخطة مع الحفاظ على التنويع.'),
  ph('tp-6', 'المرحلة 6: تمويل النشاط من العوائد', 'الانتقال التدريجي من الاعتماد على الاشتراكات إلى العوائد.'),
];

export const SCENARIO_ORDER: ScenarioId[] = ['conservative', 'base', 'optimistic'];

/** افتراضات تحليلية قابلة للتعديل، وليست توقعات ولا ضمانات */
export const buildScenarios = (): Record<ScenarioId, ScenarioAssumptions> => ({
  conservative: {
    name: 'متحفظ',
    collectionDelta: -15,
    subscriberGrowth: 0,
    loanDefault: 10,
    inflation: 3.5,
    rentGrowth: 0,
    occupancyDelta: -10,
    propertyGrowth: 4,
    portfolioReturn: 2,
  },
  base: {
    name: 'أساسي',
    collectionDelta: 0,
    subscriberGrowth: 0,
    loanDefault: 5,
    inflation: 2.5,
    rentGrowth: 2,
    occupancyDelta: 0,
    propertyGrowth: 3,
    portfolioReturn: 4,
  },
  optimistic: {
    name: 'متفائل',
    collectionDelta: 5,
    subscriberGrowth: 2,
    loanDefault: 2,
    inflation: 2,
    rentGrowth: 3,
    occupancyDelta: 5,
    propertyGrowth: 2,
    portfolioReturn: 6,
  },
});

export const buildRisks = (): Risk[] => {
  const r = (
    id: string,
    title: string,
    probability: number,
    impact: number,
    prevention: string,
    response: string,
    owner: string,
    indicator: string,
  ): Risk => ({ id, title, probability, impact, prevention, response, owner, indicator, status: 'open' });
  return [
    r('rk-collection', 'انخفاض التحصيل', 3, 4, 'تذكير منتظم وتقسيط وتسهيل طرق السداد.', 'مراجعة الميزانية وتأجيل الاستثمار.', 'اللجنة المالية', 'نسبة التحصيل الشهرية أقل من المستهدف لثلاثة أشهر'),
    r('rk-default', 'ارتفاع التعثر في القروض', 3, 4, 'دراسة القدرة على السداد وضمانات ملائمة.', 'إعادة جدولة وتقليص سقف القروض الجديدة.', 'لجنة القروض والتكافل', 'نسبة القروض المتأخرة'),
    r('rk-liquidity', 'نقص السيولة', 3, 5, 'احتياطي نقدي أدنى وسقف لرصيد القروض.', 'إيقاف القروض الجديدة وتأجيل الشراء.', 'اللجنة المالية', 'الرصيد النقدي أقل من الاحتياطي الأدنى'),
    r('rk-misuse', 'إساءة استخدام المال', 2, 5, 'فصل المهام واعتماد مزدوج ومراجعة خارجية.', 'تجميد الصلاحيات وفتح تحقيق مستقل.', 'المجلس', 'ملاحظات المراجع الداخلي والخارجي'),
    r('rk-conflict', 'تعارض المصالح', 3, 4, 'إقرار سنوي بالإفصاح وسجل التنحي.', 'إلغاء القرار المتأثر وإعادته بدون صاحب المصلحة.', 'لجنة الترشيحات والحوكمة', 'عدد حالات الإفصاح غير المسجلة'),
    r('rk-family', 'الخلافات العائلية', 3, 4, 'آلية إصلاح ذات البين ووضوح القواعد.', 'وساطة ثم تحكيم وفق الميثاق.', 'المجلس', 'عدد التظلمات والشكاوى'),
    r('rk-participation', 'انخفاض المشاركة', 3, 3, 'تواصل دوري وتقارير ميسرة واجتماع سنوي.', 'حملة تواصل وتحديث السجلات.', 'المجلس', 'نسبة حضور الاجتماع السنوي'),
    r('rk-board', 'عجز مجلس الأمناء', 2, 5, 'خطة انتقال ومقاعد احتياطية.', 'تفعيل آلية شغل المقاعد وإبلاغ الجهة المختصة.', 'لجنة الترشيحات والحوكمة', 'غياب النصاب في اجتماعين متتاليين'),
    r('rk-keyperson', 'وفاة أو استقالة مسؤول رئيسي', 2, 4, 'تفويض مكتوب ونسخ احتياطية للصلاحيات والسجلات.', 'تفعيل البدلاء وتسليم موثق.', 'رئيس المجلس', 'اعتماد العمل على شخص واحد'),
    r('rk-records', 'فقدان السجلات', 2, 5, 'نسخ احتياطية دورية في أكثر من مكان وأرشفة منظمة.', 'استعادة من النسخ ومراجعة مع المراجع.', 'أمين الصندوق', 'تاريخ آخر نسخة احتياطية'),
    r('rk-fraud', 'الاحتيال', 2, 5, 'رقابة داخلية وإبلاغ آمن ومراجعة مفاجئة.', 'إبلاغ الجهات المختصة وفق النظام.', 'اللجنة المالية', 'عمليات خارج الحدود المعتمدة'),
    r('rk-asset', 'ضعف أداء العقارات', 3, 4, 'دراسة جدوى وتنويع وإدارة محترفة.', 'تحسين أو إعادة تأجير أو استبدال بإذن.', 'لجنة الاستثمار والأوقاف', 'صافي العائد أقل من المستهدف'),
    r('rk-vacancy', 'شغور العقارات', 3, 3, 'تسويق مبكر وعقود طويلة.', 'خفض الإيجار مؤقتًا أو تغيير الاستخدام.', 'لجنة الاستثمار والأوقاف', 'نسبة الإشغال'),
    r('rk-maint', 'تكاليف صيانة مفاجئة', 3, 3, 'احتياطي صيانة لكل أصل وفحص دوري.', 'استخدام الاحتياطي وتأجيل غير الضروري.', 'لجنة الاستثمار والأوقاف', 'رصيد احتياطي الصيانة'),
    r('rk-regulatory', 'تغير المتطلبات النظامية', 2, 4, 'متابعة الأنظمة الصادرة وعرض اللائحة على مختص دوريًا.', 'تعديل اللائحة وفق الإجراء المعتمد.', 'لجنة الترشيحات والحوكمة', 'صدور تحديث على القواعد ذات الصلة'),
    r('rk-target', 'عدم تحقق هدف الاستدامة', 3, 5, 'متابعة الخطة المالية سنويًا ومراجعة الافتراضات.', 'تقليص النفقات أو تأجيل الاستثمار أو مساهمات اختيارية مستقلة.', 'اللجنة المالية', 'مؤشر الاستدامة في الخطة'),
    r('rk-beneficiaries', 'تضخم عدد المستفيدين مقارنة بالموارد', 3, 4, 'ربط الاستفادة بالحاجة وضوابط معلنة وتقدير سنوي.', 'ترتيب الأولويات وتقليص السقوف مؤقتًا.', 'لجنة القروض والتكافل', 'نسبة الطلبات إلى المخصصات'),
  ];
};
