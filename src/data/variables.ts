import type { VarDef } from '../types';

// سجل المتغيرات الذكية: يُدخل المتغير مرة واحدة ويُستخدم في النصوص والحسابات والتقارير.
// القيمة null تعني «لم يُحدد بعد» ولا يُفترض لها رقم فعلي.

const yesNo = [
  { value: 'yes', label: 'نعم' },
  { value: 'no', label: 'لا' },
];

export const VAR_GROUPS = [
  'الهوية',
  'العضوية',
  'الاشتراكات',
  'التحصيل',
  'القروض',
  'التكافل والتشغيل',
  'مجلس الأمناء',
  'الاستثمار والأوقاف',
  'المحاكاة',
] as const;

export const VAR_DEFS: VarDef[] = [
  // ── الهوية
  {
    key: 'family_name',
    label: 'اسم صاحب الاسم (العائلة)',
    type: 'text',
    group: 'الهوية',
    def: 'حسين عمر',
    help: 'يُستخدم في عنوان المشروع وفي نصوص الميثاق والتقارير. غيّره متى شئت فيتحدّث كل موضع تلقائيًا.',
  },
  {
    key: 'fund_name',
    label: 'اسم الصندوق المعتمد في الوثائق',
    type: 'text',
    group: 'الهوية',
    def: 'صندوق ذرية {{family_name}} العائلي',
    help: 'يمكن أن يحوي {{family_name}}. إن اختلفت التسمية الرسمية فعدّله هنا.',
  },
  {
    key: 'fund_official_name',
    label: 'التسمية الرسمية المقترحة للتسجيل (إن اختلفت)',
    type: 'text',
    group: 'الهوية',
    def: null,
    help: 'اتركه فارغًا إذا كان الاسم الرسمي هو نفسه اسم الصندوق.',
  },
  {
    key: 'namesake_status',
    label: 'حالة صاحب الاسم',
    type: 'select',
    group: 'الهوية',
    def: 'unknown',
    options: [
      { value: 'unknown', label: 'لم تُحدد' },
      { value: 'alive', label: 'على قيد الحياة' },
      { value: 'deceased', label: 'متوفى' },
    ],
    help: 'تؤثر في مراجعة قواعد التسمية.',
  },
  // ── العضوية
  { key: 'adult_age', label: 'سن الأهلية للاشتراك والتصويت', type: 'integer', group: 'العضوية', def: null, unit: 'سنة', min: 0, max: 100 },
  { key: 'generations_limit', label: 'عدد الأجيال المشمولة (إن حُدد)', type: 'integer', group: 'العضوية', def: null, min: 1, max: 20 },
  // ── الاشتراكات
  { key: 'subscription_start', label: 'تاريخ بداية الاشتراكات', type: 'month', group: 'الاشتراكات', def: null },
  { key: 'monthly_contribution', label: 'قيمة الاشتراك الشهري', type: 'currency', group: 'الاشتراكات', def: null, unit: 'ريال', min: 0 },
  { key: 'subscription_years', label: 'مدة الاشتراك', type: 'number', group: 'الاشتراكات', def: null, unit: 'سنة', min: 0, max: 60 },
  { key: 'grace_months', label: 'فترة السماح قبل أول استحقاق', type: 'integer', group: 'الاشتراكات', def: 0, unit: 'شهر', min: 0, max: 60 },
  { key: 'founding_payment', label: 'الدفعة التأسيسية الاختيارية لكل مشترك', type: 'currency', group: 'الاشتراكات', def: null, unit: 'ريال', min: 0 },
  { key: 'founding_support', label: 'الدعم التأسيسي (مرة واحدة)', type: 'currency', group: 'الاشتراكات', def: null, unit: 'ريال', min: 0 },
  { key: 'annual_donations', label: 'التبرعات السنوية الاختيارية المتوقعة', type: 'currency', group: 'الاشتراكات', def: null, unit: 'ريال/سنة', min: 0 },
  {
    key: 'duration_mode',
    label: 'نموذج مدة الاشتراك',
    type: 'select',
    group: 'الاشتراكات',
    def: 'uniform',
    options: [
      { value: 'uniform', label: 'مدة موحدة لجميع المشتركين' },
      { value: 'by_gender', label: 'مدة مختلفة بين الذكور والإناث' },
      { value: 'by_age', label: 'مدة بحسب عمر المشترك عند البداية' },
      { value: 'by_join', label: 'مدة بحسب تاريخ الانضمام' },
      { value: 'flexible', label: 'مدة مرنة بحسب القدرة المالية' },
      { value: 'custom', label: 'صيغة مخصصة' },
    ],
    help: 'يُحدَّد باختيار بديل في بند «نموذج مدة الاشتراك»، ويمكن تعديله هنا.',
  },
  {
    key: 'end_mode',
    label: 'نموذج انتهاء الالتزام',
    type: 'select',
    group: 'الاشتراكات',
    def: 'years',
    options: [
      { value: 'years', label: 'بعد عدد محدد من السنوات من بداية الاشتراكات' },
      { value: 'per_cohort', label: 'عند نهاية مدة كل فئة بحسب تاريخ انضمامها' },
      { value: 'fixed_date', label: 'بتاريخ محدد' },
    ],
  },
  { key: 'commitment_end_date', label: 'تاريخ انتهاء الالتزام (للنموذج «بتاريخ محدد»)', type: 'month', group: 'الاشتراكات', def: null },
  { key: 'late_suspend_months', label: 'مدة التأخر قبل إيقاف أولوية القروض', type: 'integer', group: 'الاشتراكات', def: null, unit: 'شهر', min: 1 },
  { key: 'pause_max_months', label: 'أقصى مدة للتوقف المؤقت عن الاشتراك', type: 'integer', group: 'الاشتراكات', def: null, unit: 'شهر', min: 1 },
  // ── التحصيل
  { key: 'regularity_rate', label: 'نسبة الانتظام المتوقعة', type: 'percent', group: 'التحصيل', def: 80, assumption: true, min: 0, max: 100, help: 'من يسدد في موعده.' },
  { key: 'late_rate', label: 'نسبة التأخر المتوقعة', type: 'percent', group: 'التحصيل', def: 15, assumption: true, min: 0, max: 100, help: 'من يسدد متأخرًا.' },
  { key: 'late_recovery_rate', label: 'نسبة ما يُستردّ من المتأخرين', type: 'percent', group: 'التحصيل', def: 60, assumption: true, min: 0, max: 100 },
  { key: 'exemption_rate', label: 'نسبة الإعفاء بسبب الإعسار', type: 'percent', group: 'التحصيل', def: 5, assumption: true, min: 0, max: 100, help: 'لا يُحصَّل منهم شيء، وفق قاعدة الإعفاء المعتمدة.' },
  // ── القروض
  { key: 'loan_max_amount', label: 'الحد الأعلى للقرض الواحد', type: 'currency', group: 'القروض', def: null, unit: 'ريال', min: 0 },
  { key: 'loan_avg_amount', label: 'متوسط القرض المتوقع', type: 'currency', group: 'القروض', def: null, unit: 'ريال', min: 0 },
  { key: 'loan_requests_per_year', label: 'عدد القروض المخطط تقديمها سنويًا', type: 'integer', group: 'القروض', def: null, min: 0 },
  { key: 'loan_term_months', label: 'مدة السداد المعتادة', type: 'integer', group: 'القروض', def: null, unit: 'شهر', min: 1, max: 240 },
  { key: 'loan_pool_pct', label: 'الحد الأعلى لرصيد القروض من موارد الصندوق', type: 'percent', group: 'القروض', def: null, min: 0, max: 100, help: 'السيولة المخصصة للإقراض كنسبة من مجموع النقد والقروض القائمة.' },
  { key: 'loan_cooldown_months', label: 'الفاصل الأدنى بين قرضين للعضو الواحد', type: 'integer', group: 'القروض', def: null, unit: 'شهر', min: 0 },
  // ── التكافل والتشغيل
  { key: 'aid_annual_budget', label: 'ميزانية المساعدات السنوية', type: 'currency', group: 'التكافل والتشغيل', def: null, unit: 'ريال/سنة', min: 0 },
  { key: 'operating_expenses_annual', label: 'المصروفات التشغيلية السنوية', type: 'currency', group: 'التكافل والتشغيل', def: null, unit: 'ريال/سنة', min: 0 },
  { key: 'min_cash_reserve', label: 'الاحتياطي النقدي الأدنى', type: 'currency', group: 'التكافل والتشغيل', def: null, unit: 'ريال', min: 0 },
  // ── مجلس الأمناء
  { key: 'board_members_count', label: 'عدد مقاعد مجلس الأمناء', type: 'integer', group: 'مجلس الأمناء', def: null, min: 1, max: 31 },
  { key: 'board_term_years', label: 'مدة الدورة', type: 'integer', group: 'مجلس الأمناء', def: null, unit: 'سنة', min: 1, max: 10 },
  { key: 'board_max_terms', label: 'عدد الدورات المتتالية المسموح بها', type: 'integer', group: 'مجلس الأمناء', def: null, min: 1, max: 10 },
  { key: 'board_meetings_per_year', label: 'عدد اجتماعات المجلس السنوية', type: 'integer', group: 'مجلس الأمناء', def: null, min: 1, max: 52 },
  { key: 'board_quorum_pct', label: 'نصاب اجتماع المجلس', type: 'percent', group: 'مجلس الأمناء', def: null, min: 1, max: 100 },
  { key: 'majority_ordinary_pct', label: 'نسبة التصويت للقرارات العادية', type: 'percent', group: 'مجلس الأمناء', def: null, min: 1, max: 100 },
  { key: 'majority_critical_pct', label: 'نسبة التصويت للقرارات المصيرية', type: 'percent', group: 'مجلس الأمناء', def: null, min: 1, max: 100 },
  { key: 'candidate_min_age', label: 'الحد الأدنى لسن الترشح للمجلس', type: 'integer', group: 'مجلس الأمناء', def: null, unit: 'سنة', min: 0, max: 100 },
  { key: 'review_cycle_years', label: 'دورة التقييم الدوري للائحة', type: 'integer', group: 'مجلس الأمناء', def: null, unit: 'سنة', min: 1 },
  { key: 'appeal_days', label: 'مدة الفصل في التظلم', type: 'integer', group: 'مجلس الأمناء', def: null, unit: 'يوم', min: 1 },
  // ── الاستثمار والأوقاف
  { key: 'endowment_target', label: 'قيمة الأصول الوقفية المستهدفة', type: 'currency', group: 'الاستثمار والأوقاف', def: null, unit: 'ريال', min: 0 },
  { key: 'endowments_target_count', label: 'عدد الأوقاف المستهدفة', type: 'integer', group: 'الاستثمار والأوقاف', def: null, min: 0 },
  { key: 'reinvest_share', label: 'نسبة إعادة استثمار صافي العوائد', type: 'percent', group: 'الاستثمار والأوقاف', def: null, min: 0, max: 100 },
  {
    key: 'allow_purchase_before_end',
    label: 'السماح بشراء أصل قبل انتهاء الاشتراكات',
    type: 'select',
    group: 'الاستثمار والأوقاف',
    def: 'yes',
    assumption: true,
    options: yesNo,
    help: 'إذا اخترت «لا» فلن يشتري النموذج أي أصل قبل نهاية الالتزام.',
  },
  // ── المحاكاة
  { key: 'horizon_years', label: 'أفق المحاكاة', type: 'integer', group: 'المحاكاة', def: 20, assumption: true, unit: 'سنة', min: 1, max: 30 },
];

export const VAR_BY_KEY: Record<string, VarDef> = Object.fromEntries(VAR_DEFS.map((d) => [d.key, d]));

/** متغيرات مشتقة تُحسب من بقية المشروع ولا تُدخل يدويًا */
export const DERIVED_DEFS: { key: string; label: string }[] = [
  { key: 'annual_contribution', label: 'الاشتراك السنوي (الشهري × 12)' },
  { key: 'subscribers_total', label: 'عدد المشتركين المتوقع' },
  { key: 'male_target', label: 'عدد الذكور المستهدفين' },
  { key: 'female_target', label: 'عدد الإناث المستهدفات' },
  { key: 'actual_subscribers', label: 'عدد المشتركين الفعلي' },
  { key: 'subscription_end_date', label: 'تاريخ انتهاء الاشتراكات' },
  { key: 'total_commitment', label: 'إجمالي الالتزامات التعاقدية المتوقعة' },
  { key: 'assets_count', label: 'عدد الأصول المسجلة' },
  { key: 'loan_factors_list', label: 'قائمة عوامل المفاضلة بأوزانها' },
  { key: 'loan_track_1_pct', label: 'نسبة المسار الأول للقروض' },
  { key: 'loan_track_2_pct', label: 'نسبة المسار الثاني للقروض' },
  { key: 'loan_track_3_pct', label: 'نسبة المسار الثالث للقروض' },
];
