import type { Project } from '../types';
import type { SimResult } from '../engine/simulate';
import { resolveText } from '../engine/context';
import type { Ctx } from '../engine/context';
import { clauseCounts, evaluateRequirements } from '../engine/progress';
import { money, num, pct } from '../lib/format';

// الشرح المبسط للميثاق: مصدر واحد تُبنى منه شرائح العرض ووثيقة «الشرح المبسط».
// الشرائح تشرح الفكرة بلغة بسيطة، وتعرض الأرقام فقط متى أُدخلت، ولا تقول إن شيئًا اعتُمد ما لم يُعتمد.

export interface SlideFact {
  label: string;
  value: string;
}

export interface Slide {
  id: string;
  title: string;
  lead?: string;
  points: string[];
  facts: SlideFact[];
  /** السؤال الذي سنقرره في النقاش */
  ask?: string;
  kind: 'cover' | 'normal' | 'open';
  /** رابط يُعرض معه رمز QR */
  qr?: string;
  hidden: boolean;
}

export interface SlideInput {
  p: Project;
  ctx: Ctx;
  base: SimResult;
  joinLink: string | null;
}

type Draft = Omit<Slide, 'hidden' | 'facts' | 'points'> & { points?: string[]; facts?: SlideFact[] };

const pairs = (ctx: Ctx, rows: [string, string][]): SlideFact[] =>
  rows.filter(([, key]) => ctx[key] !== undefined).map(([label, key]) => ({ label, value: ctx[key] as string }));

const identityText = (p: Project, ctx: Ctx, group: string): string | null => {
  const g = p.identity.groups.find((x) => x.id === group);
  const opt = g?.options.find((o) => g.selected.includes(o.id));
  return opt ? resolveText(opt.text, ctx) : null;
};

const allocationLine = (title: string, rows: { label: string; share: number }[]): string | null => {
  const used = rows.filter((r) => r.share > 0);
  return used.length === 0 ? null : `${title}: ${used.map((r) => `${r.label} ${num(r.share, 1)}%`).join('، ')}.`;
};

export const allSlides = ({ p, ctx, base, joinLink }: SlideInput): Slide[] => {
  const R = (t: string): string => resolveText(t, ctx);
  const counts = clauseCounts(p);
  const openQuestions = evaluateRequirements(p).filter((r) => !r.done);
  const vision = identityText(p, ctx, 'vision');
  const mission = identityText(p, ctx, 'mission');
  const drafts: Draft[] = [];

  drafts.push({
    id: 'cover',
    kind: 'cover',
    title: R('{{charter_name}}'),
    lead: 'عرض مبسط قبل بدء النقاش',
    points: ['هذه مسودة للنقاش؛ لا شيء فيها معتمد بعد، وما سنتفق عليه سيُسجَّل في المحضر.'],
  });

  drafts.push({
    id: 'why',
    kind: 'normal',
    title: 'لماذا نجتمع؟',
    lead: 'لنبني معًا ميثاقًا مكتوبًا يحفظ التكافل بيننا ويستمر مع الأجيال القادمة.',
    points: [
      'نريد قواعد واضحة يعرفها الجميع، فلا يعتمد الأمر على الاجتهاد الفردي أو الذاكرة.',
      'نريد أن يعرف كل فرد: ماذا يدفع؟ وماذا يستفيد؟ ومن يدير؟ وكيف تُحفظ الأموال؟',
      'نريد أن نتفق على المبادئ أولًا، ثم نناقش التفاصيل خطوة بخطوة.',
    ],
    facts: [...(vision ? [{ label: 'الرؤية المقترحة', value: vision }] : []), ...(mission ? [{ label: 'الرسالة المقترحة', value: mission }] : [])],
  });

  drafts.push({
    id: 'what',
    kind: 'normal',
    title: 'ما هو الصندوق العائلي؟',
    lead: 'مال مشترك تجمعه الأسرة بإرادتها، وتديره بقواعد مكتوبة، لخدمة أفرادها.',
    points: [
      'يجمع اشتراكات بالقدر والمدة اللذين نتفق عليهما.',
      'يُنفق على أوجه نحددها مسبقًا: قروض حسنة، ومساعدات، ومشاريع تبقى وتنفع.',
      'تديره جهة معروفة بصلاحيات محددة، وتحاسَب أمام الأسرة.',
      'ليس شركة تجارية، وغايته خدمة الأسرة وتكافلها.',
    ],
    ask: 'هل هذه الصورة العامة هي ما نريده؟',
  });

  drafts.push({
    id: 'how',
    kind: 'normal',
    title: 'كيف يعمل؟ خمس خطوات',
    points: [
      '١. نشترك: نتفق على قيمة الاشتراك ومدته.',
      '٢. نجمع ونحفظ: أموال الصندوق في حساب باسمه وتحت رقابة واضحة.',
      '٣. نخدم: قروض حسنة ومساعدات لمن يحتاج وفق شروط معلنة.',
      '٤. نستثمر ونوقف: أصول تدرّ عائدًا يخدم الأسرة حتى بعد انتهاء الاشتراكات.',
      '٥. نراجع ونحاسب: تقارير واجتماعات دورية، ومراجعة للميثاق كل فترة.',
    ],
  });

  drafts.push({
    id: 'members',
    kind: 'normal',
    title: 'من يشملهم الصندوق؟',
    lead: 'أول ما نحدده: من هم أفراد الذرية، وما حقوقهم؟',
    points: [
      'هل يشمل الأبناء والبنات وأبناءهم، وإلى أي جيل؟',
      'ما الفرق بين من يشترك ومن لا يشترك؟',
      'ما سنّ الأهلية للاشتراك وللتصويت؟',
    ],
    facts: pairs(ctx, [
      ['سنّ الأهلية', 'adult_age'],
      ['عدد الأجيال المشمولة', 'generations_limit'],
    ]),
    ask: 'كيف نعرّف «أفراد الذرية»؟',
  });

  drafts.push({
    id: 'pay',
    kind: 'normal',
    title: 'ما الذي ندفعه؟',
    lead: 'الاشتراك هو أساس موارد الصندوق.',
    points: [
      'نحدد القيمة، والمدة، وتاريخ البداية، وما يحدث عند التأخر أو التوقف المؤقت.',
      'قد نختار مدة واحدة للجميع، أو تختلف المدة بحسب الفئة، مع بقاء الحقوق الأساسية للجميع.',
      'الأرقام المعروضة هنا تقديرية حتى يُتفق عليها.',
    ],
    facts: pairs(ctx, [
      ['الاشتراك الشهري', 'monthly_contribution'],
      ['مدة الاشتراك (سنة)', 'subscription_years'],
      ['بداية الاشتراكات', 'subscription_start'],
      ['المشتركون المتوقعون', 'subscribers_total'],
      ['إجمالي الالتزامات المتوقعة', 'total_commitment'],
    ]),
    ask: 'كم يدفع كل مشترك، ولكم سنة؟',
  });

  drafts.push({
    id: 'rights',
    kind: 'normal',
    title: 'ماذا نحصل عليه؟ الحقوق والعدالة',
    lead: 'المبدأ الذي نريده: العدالة بين المشتركين.',
    points: [
      'من يلتزم التزامًا متقاربًا يحصل على حقوق متقاربة.',
      'نحدد من يستفيد من القروض والمساعدات، ومن يصوّت، ومن يترشح للمجلس.',
      'أي قاعدة تفرّق بين المشتركين تظهر لنا تنبيهًا لنقررها عن علم.',
    ],
    ask: 'ما الحقوق التي نتساوى فيها كلنا؟ وما الذي يختلف ولماذا؟',
  });

  drafts.push({
    id: 'loans',
    kind: 'normal',
    title: 'القروض الحسنة',
    lead: 'قرض بلا زيادة، يُسترد على أقساط، ويعود ليخدم غيرك.',
    points: [
      'القرض ليس هبة، والقسط المردود ليس ربحًا للصندوق.',
      'نحدد: أقصى مبلغ، ومدة السداد، وأغراض القرض، ومن له الأولوية عند ازدحام الطلبات.',
      'نضع حدًا لما يُخصَّص للقروض حتى لا تنفد السيولة.',
    ],
    facts: pairs(ctx, [
      ['الحد الأعلى للقرض', 'loan_max_amount'],
      ['مدة السداد المعتادة (شهر)', 'loan_term_months'],
      ['الحد الأعلى لرصيد القروض', 'loan_pool_pct'],
    ]),
    ask: 'ما شروط القرض وأولويات الطلبات؟',
  });

  const aidLine = allocationLine('توزيع ميزانية المساعدات المقترح للنقاش', p.activityBudget);
  drafts.push({
    id: 'aid',
    kind: 'normal',
    title: 'المساعدات والتكافل',
    lead: 'عون لا يُسترد، للحالات التي نتفق على استحقاقها.',
    points: [
      'نحدد الحالات المستحقة وسقف كل نوع ومن يعتمد وما المستندات المطلوبة.',
      'نحفظ خصوصية أصحاب الحاجة، فلا تُعلن أسماؤهم.',
      ...(aidLine ? [aidLine] : []),
    ],
    facts: pairs(ctx, [['ميزانية المساعدات السنوية', 'aid_annual_budget']]),
    ask: 'ما الحالات المستحقة؟ ومن يقرر؟',
  });

  drafts.push({
    id: 'board',
    kind: 'normal',
    title: 'من يدير الصندوق؟',
    lead: 'مجلس أمناء بقواعد واضحة، وبمدة محددة.',
    points: [
      'نحدد كيف يُختار الأعضاء، وما شروط الترشح، وما مدة الدورة.',
      'لجان متخصصة (مثل القروض والاستثمار)، وحدود لما يستطيع كل مستوى اعتماده.',
      'لا ينفرد أحد بقرار مالي، ويُنحّى صاحب المصلحة عن القرار الذي يخصه.',
    ],
    facts: pairs(ctx, [
      ['مقاعد المجلس', 'board_members_count'],
      ['مدة الدورة (سنة)', 'board_term_years'],
      ['اجتماعات المجلس سنويًا', 'board_meetings_per_year'],
      ['النصاب', 'board_quorum_pct'],
      ['نسبة القرارات العادية', 'majority_ordinary_pct'],
      ['نسبة القرارات المصيرية', 'majority_critical_pct'],
    ]),
    ask: 'كم عضوًا؟ وكيف يُختارون؟ وما نصاب القرار؟',
  });

  drafts.push({
    id: 'finance',
    kind: 'normal',
    title: 'كيف نحفظ المال ونراقبه؟',
    points: [
      'حساب باسم الصندوق وليس باسم شخص، وأكثر من توقيع على الصرف.',
      'تقارير دورية تُعرض على الجميع، ومراجع مستقل للحسابات.',
      'احتياطي نقدي أدنى لا نمسّه، حتى لا يتعثر الصندوق عند الطوارئ.',
    ],
    facts: pairs(ctx, [
      ['الاحتياطي النقدي الأدنى', 'min_cash_reserve'],
      ['المصروفات التشغيلية السنوية', 'operating_expenses_annual'],
    ]),
    ask: 'من يوقّع؟ ومن يراجع؟ وكم الاحتياطي؟',
  });

  const returnsLine = allocationLine('توزيع العوائد المقترح للنقاش', p.returnsAllocation);
  drafts.push({
    id: 'endow',
    kind: 'normal',
    title: 'الاستثمار والأوقاف',
    lead: 'نريد أن يبقى أثر الصندوق بعد انتهاء الاشتراكات.',
    points: [
      'نشتري أصولًا مثل عقار مؤجَّر يدرّ عائدًا يخدم الأسرة سنوات طويلة.',
      'قد نوقف بعض الأصول بوثيقة وقف مستقلة تُوثَّق رسميًا، فيُحفظ أصلها وتُصرف منفعتها.',
      'العائد غير مضمون وللعقار مخاطره (الإشغال، والصيانة، وتقلب السعر)، فنقيّم قبل الشراء.',
      ...(returnsLine ? [returnsLine] : []),
    ],
    facts: pairs(ctx, [
      ['قيمة الأصول الوقفية المستهدفة', 'endowment_target'],
      ['عدد الأوقاف المستهدفة', 'endowments_target_count'],
      ['الأصول المسجلة حاليًا', 'assets_count'],
    ]),
    ask: 'ما الذي نشتريه؟ وما الذي نوقفه؟ وكيف نوزع العوائد؟',
  });

  if (base.totalCommitment > 0) {
    drafts.push({
      id: 'numbers',
      kind: 'normal',
      title: p.demo ? 'ماذا تقول الأرقام؟ (بيانات توضيحية)' : 'ماذا تقول الأرقام؟',
      points: [
        ...(p.demo ? ['هذه الأرقام توضيحية غير حقيقية للتجربة فقط.'] : []),
        'أرقام تقديرية مبنية على المدخلات الحالية، وليست أموالًا محصّلة ولا نتيجة مضمونة.',
        `إجمالي الالتزامات التعاقدية إذا التزم الجميع بالمدخلات الحالية: نحو ${money(base.totalCommitment)}.`,
        ...(base.endLabel ? [`تنتهي الاشتراكات في ${base.endLabel}.`] : []),
        ...(base.finalCoverage != null ? [`في نهاية الأفق تغطي عوائد الأصول نحو ${pct(base.finalCoverage * 100)} من تكلفة النشاط.`] : []),
      ],
      facts: pairs(ctx, [
        ['المشتركون المتوقعون', 'subscribers_total'],
        ['الاشتراك الشهري', 'monthly_contribution'],
        ['مدة الاشتراك (سنة)', 'subscription_years'],
      ]),
    });
  }

  drafts.push({
    id: 'open',
    kind: 'open',
    title: 'ما الذي لم نحسمه بعد؟',
    lead: `بنود تنتظر قرارًا: ${num(counts.discuss + counts.postponed)} من ${num(counts.total)}. وهذه أبرز الأسئلة المفتوحة:`,
    points: openQuestions.length === 0 ? ['حُسمت الأسئلة الجوهرية كلها، ويبقى اعتماد الصياغة النهائية.'] : openQuestions.slice(0, 8).map((r) => r.req.question),
  });

  drafts.push({
    id: 'discuss',
    kind: 'normal',
    title: 'كيف سنتناقش؟',
    points: [
      'نناقش بندًا بندًا: السؤال، ثم الخيارات، ثم مزايا كل خيار وعيوبه.',
      'لكل شخص فرصة لرأيه، وتُكتب التحفظات في المحضر.',
      'التصويت هنا لقياس الاتجاه، والقرار يُسجَّل برقمه ومبرراته.',
      'ما لا نتفق عليه نؤجله ولا نفرضه.',
    ],
  });

  drafts.push({
    id: 'you',
    kind: 'normal',
    title: 'ما المطلوب منك؟',
    points: [
      'اطّلع على الخيارات واسأل بحرية.',
      'سجّل بياناتك والتزامك المبدئي عبر رابط التسجيل المشارَك معك؛ فهو تعبير عن الرغبة لأغراض التخطيط، وليس التزامًا نظاميًا ولا دفعًا للمال.',
      'ما تدخله يُحفظ مباشرة ويمكنك تعديله لاحقًا.',
    ],
    facts: joinLink ? [{ label: 'رابط التسجيل', value: joinLink }] : [],
    qr: joinLink ?? undefined,
  });

  drafts.push({
    id: 'notice',
    kind: 'normal',
    title: 'تنبيه مهم',
    points: [
      'هذه مسودة للنقاش، وليست وثيقة وقف رسمية ولا لائحة معتمدة.',
      'قبل التفعيل تحتاج مراجعة نظامية وشرعية ومالية، وتسجيلًا لدى الجهة المختصة.',
      'الأرقام تقديرية، والعوائد والعقارات غير مضمونة.',
    ],
  });

  return drafts.map((d) => {
    const extra = p.presentation.extra[d.id]?.trim();
    return {
      ...d,
      points: [...(d.points ?? []), ...(extra ? [R(extra)] : [])],
      facts: d.facts ?? [],
      hidden: p.presentation.hidden[d.id] === true,
    };
  });
};

export const visibleSlides = (input: SlideInput): Slide[] => allSlides(input).filter((s) => !s.hidden);
