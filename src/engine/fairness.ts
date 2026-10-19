import type { Project } from '../types';
import { activeFlags, clauseMap, clauseText, isActive } from '../lib/clauses';
import { money } from '../lib/format';
import { groupPlans, numVar } from './subscriptions';
import { simulate } from './simulate';

// اختبار عدالة الميثاق: تنبيهات تفسيرية وليست أحكامًا قانونية أو شرعية قطعية.

export type Severity = 'high' | 'medium' | 'low';

export interface FairnessFinding {
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  clauseIds: string[];
  impact: string;
  fixes: string[];
}

const GENDER_PRIORITY =
  /(الذكور|الرجال|الإناث|النساء)[^.،\n]{0,40}(أولوية|أحق|يُقدَّمون|يقدمون|يفضّلون|يفضلون)|(أولوية|أحق|يُقدَّم|يقدم)[^.،\n]{0,40}(الذكور|الرجال|الإناث|النساء)/;

const FLAG_RULES: {
  flag: string;
  rule: string;
  severity: Severity;
  title: string;
  impact: string;
  fixes: string[];
}[] = [
  {
    flag: 'gender_privilege',
    rule: 'gender',
    severity: 'high',
    title: 'امتياز قائم على الجنس دون مسوّغ مقبول',
    impact: 'يخالف مبدأ المساواة المؤسس، ويثير الاعتراض والتظلم.',
    fixes: ['إلغاء التمييز بين الجنسين في هذا البند.', 'استبدال المعيار بمعيار الحاجة والقدرة.'],
  },
  {
    flag: 'aid_contributors_only',
    rule: 'aid-contributors',
    severity: 'high',
    title: 'استبعاد غير المشتركين من أي مساعدة إنسانية',
    impact: 'قد يُحرم المعسر والمحتاج من العون الأساسي، ويتعارض مع «التكافل لا يسقط عن أحد».',
    fixes: ['حصر الأولوية في القروض لا في المساعدة الإنسانية.', 'إتاحة مساعدة إنسانية لغير المشترك بقرار مسبب.'],
  },
  {
    flag: 'loan_contributors_only',
    rule: 'loan-contributors',
    severity: 'medium',
    title: 'اقتصار القروض على المشتركين المنتظمين',
    impact: 'يُحرم غير المنتظم آليًا ولو كان معسرًا.',
    fixes: ['جعل الانتظام أولوية عند التساوي لا شرطًا للتقدم.', 'دراسة طلب غير المنتظم وفق ضوابط معلنة.'],
  },
  {
    flag: 'no_insolvency_distinction',
    rule: 'insolvency',
    severity: 'high',
    title: 'عدم التمييز بين المتأخر لإعساره والمتأخر مع قدرته',
    impact: 'يظلم المعسر ويعامله معاملة المماطل.',
    fixes: ['وضع معايير معلنة لإثبات الإعسار وإعفائه أو تعليق اشتراكه.', 'إبقاء الإجراءات التأديبية للمماطل القادر فقط.'],
  },
  {
    flag: 'self_approval',
    rule: 'self-approval',
    severity: 'high',
    title: 'اعتماد صاحب المصلحة لطلبه الخاص',
    impact: 'تعارض مصالح صريح يهدد الثقة بالمجلس.',
    fixes: ['منع صاحب المصلحة من المشاركة في النظر والتصويت والتنحي الإلزامي.'],
  },
  {
    flag: 'open_ended',
    rule: 'open-ended',
    severity: 'high',
    title: 'اشتراكات تستمر بلا موعد انتهاء واضح',
    impact: 'التزام مفتوح يخيف المشتركين ويخالف مبدأ نهاية محددة للالتزام.',
    fixes: ['تحديد تاريخ أو مدة ملزمة لانتهاء الاشتراكات.', 'جعل أي استمرار اختياريًا بموافقة مستقلة.'],
  },
  {
    flag: 'forced_extension',
    rule: 'forced-extension',
    severity: 'high',
    title: 'تمديد الاشتراكات على من لم يوافق',
    impact: 'يُلزم المشترك بأكثر مما التزم به.',
    fixes: ['إلغاء التمديد القسري واعتماد مساهمات اختيارية بموافقة مستقلة.'],
  },
  {
    flag: 'unmeasurable_privilege',
    rule: 'unmeasurable',
    severity: 'medium',
    title: 'امتيازات مالية غير محددة أو غير قابلة للقياس',
    impact: 'يفتح باب المحاباة وصعوبة المحاسبة.',
    fixes: ['حذف الامتياز أو تعريفه بمقدار ومعيار وفترة واضحة.'],
  },
  {
    flag: 'money_privilege',
    rule: 'money-privilege',
    severity: 'medium',
    title: 'امتياز مرتبط بمقدار المساهمة المالية',
    impact: 'يخالف مبدأ أن المساهمة لا تمنح سلطة إدارية ويخلق طبقات داخل العائلة.',
    fixes: ['جعل الفئات الأعلى مساهمة بلا امتياز إداري أو تصويتي.'],
  },
  {
    flag: 'weighted_by_money',
    rule: 'weighted-vote',
    severity: 'high',
    title: 'أصوات موزونة بمقدار المساهمة',
    impact: 'يمنح الأعلى مساهمة نفوذًا أكبر ويقوض المساواة.',
    fixes: ['صوت واحد لكل عضو بالغ مؤهل.'],
  },
  {
    flag: 'retroactive',
    rule: 'retroactive',
    severity: 'high',
    title: 'تغيير القواعد بأثر رجعي على المشتركين',
    impact: 'يمس الحقوق المكتسبة ويزعزع الثقة.',
    fixes: ['عدم الرجعية، أو قصرها على ما فيه مصلحة المنتسبين وبرضا المتأثرين.'],
  },
  {
    flag: 'branch_monopoly',
    rule: 'branch-monopoly',
    severity: 'high',
    title: 'تصويت أو ترشيح يحتكره فرع عائلي',
    impact: 'يقصي بقية الفروع ويولّد النزاع.',
    fixes: ['فتح الترشح لجميع الفروع مع حد أقصى لمقاعد الفرع الواحد.'],
  },
  {
    flag: 'binds_future_generations',
    rule: 'future-binding',
    severity: 'high',
    title: 'تحميل الجيل التالي التزامات لم يوافق عليها',
    impact: 'يخالف عدالة التوزيع بين الأجيال ويجعل الالتزام مفتوحًا.',
    fixes: ['جعل التزام كل جيل بدورة مستقلة برضاه، أو اعتماد العوائد مصدرًا.'],
  },
  {
    flag: 'late_penalty',
    rule: 'late-penalty',
    severity: 'medium',
    title: 'غرامة مالية على تأخر الاشتراك',
    impact: 'تضر بالمعسر وتتعارض مع روح التكافل، وتحتاج مراجعة شرعية.',
    fixes: ['استبدال الغرامة بتقسيط دون زيادة وأثر في الأولوية فقط.'],
  },
  {
    flag: 'membership_requires_payment',
    rule: 'membership-payment',
    severity: 'high',
    title: 'ربط العضوية بالاشتراك',
    impact: 'يقصي غير المشترك من الانتساب ويتعارض مع مبدأ عدم الإقصاء.',
    fixes: ['فصل العضوية (حق بالنسب) عن الاشتراك (التزام مالي).'],
  },
  {
    flag: 'excludes_daughters_line',
    rule: 'daughters-line',
    severity: 'medium',
    title: 'استبعاد جيل منحدر من الإناث من الصندوق',
    impact: 'قد يُفهم تفاوتًا بين فرعي الأبناء والبنات في الانتفاع، رغم مبدأ المساواة.',
    fixes: ['معاملتهم بصفة «قريب مستفيد» بحقوق محددة.', 'مساندة إنسانية مستقلة عن موارد الصندوق مع توثيق المسوّغ.'],
  },
];

const ABSENCE_RULES: {
  rule: string;
  ids: string[];
  severity: Severity;
  title: string;
  impact: string;
  fixes: string[];
}[] = [
  {
    rule: 'no-appeal',
    ids: ['FND-06', 'CON-10'],
    severity: 'high',
    title: 'غياب حق التظلم أو آليته',
    impact: 'القرار الصادر بشأن الطلب لا يُراجع، فيتحول الخلاف إلى نزاع.',
    fixes: ['اعتماد بند حق التظلم وتشكيل لجنة تظلمات ومدة للفصل.'],
  },
  {
    rule: 'no-conflict',
    ids: ['BRD-04', 'FIN-12'],
    severity: 'high',
    title: 'غياب آلية معالجة تعارض المصالح',
    impact: 'يهدد الثقة بقرارات المجلس واللجان.',
    fixes: ['اعتماد الإفصاح والتنحي وإقرار سنوي بالمصالح.'],
  },
  {
    rule: 'no-self-approval-guard',
    ids: ['LON-08'],
    severity: 'high',
    title: 'غياب منع صاحب المصلحة من اعتماد طلبه',
    impact: 'قد يعتمد رئيس المجلس أو عضو قرضه الخاص.',
    fixes: ['اعتماد بند منع المشاركة في طلبه الخاص.'],
  },
];

export const fairnessFindings = (p: Project): FairnessFinding[] => {
  const out: FairnessFinding[] = [];
  const flags = activeFlags(p);
  const cm = clauseMap(p);
  const titleOf = (ids: string[]): string => ids.map((i) => cm.get(i)?.title ?? i).join('، ');

  for (const r of FLAG_RULES) {
    const cs = flags.get(r.flag) ?? [];
    if (cs.length === 0) continue;
    const ids = cs.map((c) => c.id);
    out.push({
      id: `${r.rule}:${ids.join('+')}`,
      rule: r.rule,
      severity: r.severity,
      title: r.title,
      clauseIds: ids,
      impact: `${r.impact} (البند: ${titleOf(ids)})`,
      fixes: r.fixes,
    });
  }

  // فحص نصي تقريبي للصياغات المعدلة يدويًا
  for (const c of p.clauses) {
    if (!isActive(c) || c.customText == null) continue;
    if (GENDER_PRIORITY.test(clauseText(c))) {
      out.push({
        id: `gender-text:${c.id}`,
        rule: 'gender-text',
        severity: 'medium',
        title: 'صياغة معدلة قد تمنح أفضلية قائمة على الجنس',
        clauseIds: [c.id],
        impact: `ورد في النص ما يوحي بأولوية مرتبطة بالجنس (فحص نصي تقريبي). البند: ${c.title}`,
        fixes: ['مراجعة الصياغة وإزالة التمييز غير المبرر، أو تسجيل المسوّغ المقبول.'],
      });
    }
  }

  for (const r of ABSENCE_RULES) {
    const excluded = r.ids.filter((id) => cm.get(id)?.status === 'excluded');
    if (excluded.length === 0) continue;
    out.push({
      id: `${r.rule}:${excluded.join('+')}`,
      rule: r.rule,
      severity: r.severity,
      title: r.title,
      clauseIds: excluded,
      impact: `${r.impact} (البند المستبعد: ${titleOf(excluded)})`,
      fixes: r.fixes,
    });
  }

  // فئات في جدول الحقوق بلا أي مساعدة إنسانية
  for (const t of p.tiers) {
    if (t.rights.aid === 'no' && t.id !== 'tier-minor' && t.id !== 'tier-relative') {
      out.push({
        id: `tier-aid:${t.id}`,
        rule: 'tier-aid',
        severity: 'high',
        title: `فئة «${t.name}» بلا أي مساعدة إنسانية في جدول الحقوق`,
        clauseIds: [],
        impact: 'قد يُحرم أفراد هذه الفئة من العون الأساسي.',
        fixes: ['منح الفئة المساعدة الإنسانية بشروط الحاجة، وحصر الفروق في أولوية القروض.'],
      });
    }
  }

  // سقف قرض مرتفع قد يستنزف السيولة
  const maxLoan = numVar(p, 'loan_max_amount');
  if (maxLoan != null && maxLoan > 0) {
    const y1 = simulate(p, 'base').years[0];
    const resources = y1.endCash + y1.loansOutstanding;
    if (resources > 0 && maxLoan / resources > 0.15) {
      out.push({
        id: 'loan-ceiling:LON-09',
        rule: 'loan-ceiling',
        severity: 'medium',
        title: 'سقف القرض مرتفع قياسًا بسيولة الصندوق',
        clauseIds: ['LON-09'],
        impact: `سقف القرض ${money(maxLoan)} يمثل ${Math.round((maxLoan / resources) * 100)}% من موارد الصندوق المقدرة نهاية السنة الأولى (${money(resources)})، فقد يستنزف السيولة ويقلل عدد المستفيدين.`,
        fixes: ['خفض السقف أو ربطه بنسبة من السيولة.', 'رفع السيولة قبل بدء الإقراض.'],
      });
    }
  }

  // تفاوت مدة السداد دون إظهار أثره المالي
  const plans = groupPlans(p).filter((g) => g.count > 0 && g.amount > 0 && g.years != null);
  if (plans.length > 1) {
    const totals = plans.map((g) => ({ g, total: g.amount * ((g.end ?? 0) - g.begin) }));
    const min = Math.min(...totals.map((t) => t.total));
    const max = Math.max(...totals.map((t) => t.total));
    if (max - min > 0.5) {
      const hi = totals.find((t) => t.total === max)!;
      const lo = totals.find((t) => t.total === min)!;
      out.push({
        id: 'duration-gap:groups',
        rule: 'duration-gap',
        severity: 'medium',
        title: 'تفاوت إجمالي المساهمة بين الفئات',
        clauseIds: ['SUB-03'],
        impact: `إجمالي مساهمة الفرد في فئة «${hi.g.name}» ${money(hi.total)} مقابل ${money(lo.total)} في فئة «${lo.g.name}» (فرق ${money(max - min)}). يجب أن يظهر مسوّغ التفاوت للأعضاء، ولا يترتب عليه اختلاف في الحقوق الأساسية.`,
        fixes: ['توحيد المدة والقيمة.', 'تسجيل مسوّغ مقبول ومعلن للتفاوت مع ضمان تساوي الحقوق.'],
      });
    }
  }

  return out;
};
