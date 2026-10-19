import { useMemo, useState } from 'react';
import { fairnessFindings } from '../engine/fairness';
import { useDerived } from '../lib/derived';
import { Callout, Card, EmptyState, SectionHead, Tabs } from '../components/ui';
import { ClauseList } from '../components/ClauseList';
import { FindingCard } from '../components/FindingCard';

export default function Rights() {
  const { project: p } = useDerived();
  const [tab, setTab] = useState<'clauses' | 'fairness'>('fairness');
  const findings = useMemo(() => fairnessFindings(p), [p]);
  const open = findings.filter((f) => (p.findings[f.id]?.status ?? 'open') === 'open').length;

  return (
    <div className="space-y-6">
      <SectionHead
        num="05 / الحقوق والعدالة والأولوية"
        title="الحقوق والعدالة والأولوية"
        sub="يراجع «اختبار عدالة الميثاق» القرارات والبدائل المختارة وينبه إلى حالات عدم الإنصاف. التنبيهات تفسيرية وليست أحكامًا قانونية أو شرعية قطعية."
      />

      <Card>
        <h2 className="mb-2 text-lg">قاعدة الأولوية</h2>
        <p className="text-sm leading-relaxed">
          الملتزم بالاشتراكات يحصل على <b>أولوية عند تساوي الشروط والحاجة</b>، لكنه لا يحتكر القروض. وغير المنتظم لا يُحرم آليًا، بل يُدرس طلبه وفق ضوابط معلنة. والمساندة الإنسانية مستقلة عن مكافأة انتظام الاشتراك. وتُضبط أوزان المفاضلة في قسم القروض.
        </p>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'fairness', label: 'اختبار عدالة الميثاق', badge: open },
          { id: 'clauses', label: 'بنود الحقوق والمبادئ' },
        ]}
      />

      {tab === 'fairness' && (
        <div className="space-y-4">
          <Callout tone="info">
            يُفحص: الامتيازات القائمة على الجنس، واستبعاد غير المشتركين من العون الإنساني، والتمييز بين المعسر والمماطل، واعتماد صاحب المصلحة لطلبه، والاشتراكات بلا نهاية، والامتيازات غير المحددة، وسقوف القروض المرتفعة، والأثر الرجعي، واحتكار الفروع، وغياب التظلم وتعارض المصالح، وتحميل الأجيال القادمة، وتفاوت المدد دون إظهار أثره. لكل تنبيه حل أو أكثر، أو قبول المخاطرة مع تسجيل المبرر.
          </Callout>
          {findings.length === 0 ? (
            <EmptyState>لا تنبيهات عدالة بالإعدادات الحالية. يتجدد الفحص تلقائيًا مع كل اختيار أو تعديل.</EmptyState>
          ) : (
            findings.map((f) => <FindingCard key={f.id} f={f} />)
          )}
        </div>
      )}

      {tab === 'clauses' && (
        <ClauseList
          ids={['FND-02', 'FND-03', 'FND-04', 'FND-05', 'FND-06', 'FND-07', 'FND-08', 'FND-10', 'FND-12', 'FND-13', 'FND-14', 'FND-11']}
          categories={['foundation']}
          title="بنود الحقوق والعدالة"
        />
      )}
    </div>
  );
}
