import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Calculator,
  CalendarDays,
  FileText,
  HandCoins,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  Library,
  Scale,
  SearchCheck,
  ShieldAlert,
  Users,
  Wallet,
  Home,
  Presentation,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SectionId } from '../data/checklist';

export interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  num: string;
}

export const SECTIONS: SectionDef[] = [
  { id: 'dashboard', label: 'لوحة المشروع', icon: LayoutDashboard, num: '01' },
  { id: 'identity', label: 'الهوية والرؤية والأهداف', icon: BadgeCheck, num: '02' },
  { id: 'membership', label: 'نطاق الذرية والعضوية', icon: Users, num: '03' },
  { id: 'subscriptions', label: 'الاشتراكات والالتزامات', icon: Wallet, num: '04' },
  { id: 'rights', label: 'الحقوق والعدالة والأولوية', icon: Scale, num: '05' },
  { id: 'loans', label: 'القروض الحسنة', icon: HandCoins, num: '06' },
  { id: 'aid', label: 'المساعدات والتكافل', icon: HeartHandshake, num: '07' },
  { id: 'board', label: 'مجلس الأمناء والحوكمة', icon: Landmark, num: '08' },
  { id: 'finance', label: 'الإدارة المالية والرقابة', icon: Building2, num: '09' },
  { id: 'endowments', label: 'الاستثمارات والأوقاف', icon: Home, num: '10' },
  { id: 'assets', label: 'سجل الأصول العقارية', icon: Building2, num: '11' },
  { id: 'simulation', label: 'الخطة المالية والمحاكاة', icon: Calculator, num: '12' },
  { id: 'risks', label: 'المخاطر واستمرارية الصندوق', icon: ShieldAlert, num: '13' },
  { id: 'meetings', label: 'الاجتماعات والتصويت والقرارات', icon: CalendarDays, num: '14' },
  { id: 'library', label: 'مكتبة البنود والبدائل', icon: Library, num: '15' },
  { id: 'review', label: 'مراجعة الميثاق واكتشاف النواقص', icon: SearchCheck, num: '16' },
  { id: 'reports', label: 'التقارير والتصدير', icon: FileText, num: '17' },
  { id: 'present', label: 'عرض الميثاق للأسرة', icon: Presentation, num: '18' },
  { id: 'registration', label: 'تسجيل المشاركين والتزاماتهم', icon: UserPlus, num: '19' },
];

export const sectionLabel = (id: SectionId): string => SECTIONS.find((s) => s.id === id)?.label ?? id;

const parse = (): SectionId => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return SECTIONS.some((s) => s.id === h) ? (h as SectionId) : 'dashboard';
};

export const go = (id: SectionId): void => {
  window.location.hash = `#/${id}`;
  window.scrollTo({ top: 0 });
};

export const useSection = (): SectionId => {
  const [s, setS] = useState<SectionId>(parse);
  useEffect(() => {
    const on = (): void => setS(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return s;
};
