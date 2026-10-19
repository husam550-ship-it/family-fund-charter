// أسئلة «لا تنسَ هذا السؤال» ومعايير الاكتمال القابلة للفحص.
// كل متطلب يُفحص من حالة المشروع: بنود معتمدة، ومتغيرات مُدخلة، وأحوال مخصوصة.

export type SectionId =
  | 'dashboard'
  | 'identity'
  | 'membership'
  | 'subscriptions'
  | 'rights'
  | 'loans'
  | 'aid'
  | 'board'
  | 'finance'
  | 'endowments'
  | 'assets'
  | 'simulation'
  | 'risks'
  | 'meetings'
  | 'library'
  | 'review'
  | 'reports';

export type Custom =
  | 'identity_confirmed'
  | 'loan_weights_100'
  | 'criteria_decided'
  | 'approval_limits_set'
  | 'assets_registered'
  | 'tiers_defined'
  | 'groups_defined'
  | 'meeting_recorded'
  | 'committees_defined'
  | 'allocation_100';

export interface Requirement {
  id: string;
  question: string;
  section: SectionId;
  /** يجب أن تكون كلها معتمدة */
  clauses?: string[];
  /** يجب أن تكون كلها مُدخلة */
  vars?: string[];
  custom?: Custom;
}

export const REQUIREMENTS: Requirement[] = [
  { id: 'q-identity', question: 'هل أكّدنا الهوية والرؤية والرسالة والقيم؟', section: 'identity', custom: 'identity_confirmed' },
  { id: 'q-name', question: 'هل تم التحقق من اسم الصندوق وحالة صاحب الاسم؟', section: 'identity', clauses: ['FND-01'] },
  { id: 'q-legal', question: 'هل حُددت الجهة النظامية ومسار التأسيس والأغراض؟', section: 'review', clauses: ['FND-09', 'FND-15'] },
  { id: 'q-scope', question: 'هل تم تحديد نطاق الذرية؟', section: 'membership', clauses: ['MEM-01'] },
  { id: 'q-daughters', question: 'هل تشمل العضوية أبناء البنات عبر الأجيال؟', section: 'membership', clauses: ['MEM-02'] },
  { id: 'q-beneficiary', question: 'هل وحّدنا تعريف المستفيد بين الأقسام؟', section: 'membership', clauses: ['FND-12'] },
  { id: 'q-tiers', question: 'هل حددنا فئات العضوية وحقوق كل فئة؟', section: 'membership', custom: 'tiers_defined' },
  { id: 'q-age', question: 'هل حددنا سن الأهلية للاشتراك والتصويت؟', section: 'membership', clauses: ['MEM-05'], vars: ['adult_age'] },
  { id: 'q-newgen', question: 'هل عالجنا حال الأجيال الجديدة بعد انتهاء الاشتراكات؟', section: 'membership', clauses: ['MEM-10'] },
  { id: 'q-refund', question: 'هل حددنا إن كانت مساهمة المشترك مستردة أم لا؟', section: 'membership', clauses: ['MEM-11'] },
  { id: 'q-vote', question: 'هل اتفقنا على قاعدة التصويت وتمثيل الفروع؟', section: 'membership', clauses: ['MEM-13', 'MEM-14'] },
  { id: 'q-groups', question: 'هل أدخلنا فئات المشتركين وأعدادهم المستهدفة؟', section: 'subscriptions', custom: 'groups_defined' },
  { id: 'q-amount', question: 'هل تم تحديد قيمة الاشتراك ومدته وتاريخ بدايته؟', section: 'subscriptions', clauses: ['SUB-02'], vars: ['monthly_contribution', 'subscription_years', 'subscription_start'] },
  { id: 'q-duration', question: 'هل تم اعتماد مدة الاشتراكات لكل فئة؟', section: 'subscriptions', clauses: ['SUB-03'] },
  { id: 'q-end', question: 'هل حُدد نموذج انتهاء الالتزام وتاريخه؟', section: 'subscriptions', clauses: ['SUB-04', 'SUB-05', 'SUB-06'] },
  { id: 'q-shortfall', question: 'هل لدينا خطة عند عدم تحقق الهدف المالي بعد انتهاء الاشتراكات؟', section: 'subscriptions', clauses: ['SUB-07'] },
  { id: 'q-exempt', question: 'هل انتهينا من نظام الإعفاءات والتمييز بين الإعسار والتأخر مع القدرة؟', section: 'subscriptions', clauses: ['SUB-08', 'SUB-12'] },
  { id: 'q-late', question: 'هل وضحنا حق المتعثر وطريقة معالجة المتأخرات؟', section: 'subscriptions', clauses: ['SUB-11', 'FND-07'] },
  { id: 'q-lend-legal', question: 'هل تم التحقق من مشروعية الإقراض الحسن ضمن أغراض الصندوق؟', section: 'loans', clauses: ['LON-02'] },
  { id: 'q-loan-cap', question: 'هل تم اعتماد سقوف القروض ومدد السداد؟', section: 'loans', clauses: ['LON-09', 'LON-10'], vars: ['loan_max_amount', 'loan_term_months'] },
  { id: 'q-loan-pool', question: 'هل حددنا السيولة المخصصة للإقراض؟', section: 'loans', clauses: ['LON-17'], vars: ['loan_pool_pct'] },
  { id: 'q-loan-weights', question: 'هل ضبطنا أوزان المفاضلة بمجموع 100%؟', section: 'loans', custom: 'loan_weights_100' },
  { id: 'q-loan-priority', question: 'هل حسمنا أولوية المنتظم دون احتكار؟', section: 'loans', clauses: ['LON-03', 'LON-04'] },
  { id: 'q-aid-elig', question: 'هل حددنا أهلية المساعدة الإنسانية لغير المشترك؟', section: 'aid', clauses: ['AID-05', 'MEM-08'] },
  { id: 'q-aid-budget', question: 'هل حددنا ميزانية المساعدات وتوزيعها على الأنشطة؟', section: 'aid', clauses: ['AID-08'], vars: ['aid_annual_budget'] },
  { id: 'q-funds', question: 'هل فصلنا الزكاة والتبرعات المقيدة والموارد العامة والأموال الوقفية؟', section: 'aid', clauses: ['AID-07', 'AID-03'] },
  { id: 'q-board-model', question: 'هل حددنا طريقة اختيار مجلس الأمناء؟', section: 'board', clauses: ['BRD-10'] },
  { id: 'q-board-size', question: 'هل حددنا عدد المقاعد والمدة والدورات؟', section: 'board', clauses: ['BRD-11', 'BRD-12'], vars: ['board_members_count', 'board_term_years'] },
  { id: 'q-quorum', question: 'هل حددنا النصاب ونسب التصويت؟', section: 'board', clauses: ['BRD-15'], vars: ['board_quorum_pct', 'majority_ordinary_pct', 'majority_critical_pct'] },
  { id: 'q-criteria', question: 'هل حسمنا شروط عضوية المجلس؟', section: 'board', custom: 'criteria_decided' },
  { id: 'q-conflict', question: 'هل وضعنا شروط تضارب المصالح؟', section: 'board', clauses: ['BRD-04', 'FIN-12'] },
  { id: 'q-transition', question: 'هل حددنا خطة انتقال مجلس الأمناء؟', section: 'board', clauses: ['BRD-17'] },
  { id: 'q-committees', question: 'هل حددنا اختصاصات اللجان؟', section: 'board', custom: 'committees_defined' },
  { id: 'q-limits', question: 'هل وضعنا حدود الاعتماد المالي وجهات الاعتماد؟', section: 'finance', clauses: ['BRD-08', 'FIN-04'], custom: 'approval_limits_set' },
  { id: 'q-audit', question: 'هل حددنا المراجع الخارجي وحسابات الصندوق؟', section: 'finance', clauses: ['FIN-08', 'FIN-02'] },
  { id: 'q-reserve', question: 'هل حددنا الاحتياطي النقدي الأدنى؟', section: 'finance', clauses: ['FIN-10'], vars: ['min_cash_reserve'] },
  { id: 'q-ops', question: 'هل قدّرنا المصروفات التشغيلية السنوية؟', section: 'finance', vars: ['operating_expenses_annual'] },
  { id: 'q-first-asset', question: 'هل قررنا متى نبدأ شراء أول أصل وهل يجوز قبل انتهاء الاشتراكات؟', section: 'endowments', clauses: ['END-09'] },
  { id: 'q-ownership', question: 'هل حددنا ملكية الأصول: للصندوق أم وقف بوثيقة مستقلة، وجهة النظارة؟', section: 'endowments', clauses: ['END-12', 'END-13'] },
  { id: 'q-endowments', question: 'هل حددنا عدد الأوقاف وتكاليفها؟', section: 'assets', vars: ['endowments_target_count', 'endowment_target'], custom: 'assets_registered' },
  { id: 'q-returns', question: 'هل حددنا توزيع العوائد ونسبة إعادة الاستثمار؟', section: 'endowments', clauses: ['END-06', 'END-19'], vars: ['reinvest_share'], custom: 'allocation_100' },
  { id: 'q-appeal', question: 'هل وضعنا آلية التظلم وإجراءاتها؟', section: 'rights', clauses: ['FND-06', 'CON-10'] },
  { id: 'q-disputes', question: 'هل وضعنا آلية حل النزاعات؟', section: 'rights', clauses: ['CON-07'] },
  { id: 'q-amend', question: 'هل وضعنا آلية تعديل الميثاق؟', section: 'board', clauses: ['CON-08', 'CON-05'] },
  { id: 'q-continuity', question: 'هل وضعنا خطة استمرارية الأعمال؟', section: 'risks', clauses: ['CON-11'] },
  { id: 'q-meeting', question: 'هل سجلنا اجتماعًا وقراراته؟', section: 'meetings', custom: 'meeting_recorded' },
];
