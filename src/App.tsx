import { Suspense, lazy, useEffect, useState } from 'react';
import { Eye, Menu, Redo2, Settings2, Undo2, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { installFlushOnExit, useStore } from './lib/store';
import { DerivedProvider, useDerived } from './lib/derived';
import { go, SECTIONS, useSection } from './lib/nav';
import type { SectionId } from './data/checklist';
import { useUi } from './lib/ui';
import { resolveText } from './engine/context';
import { cx, Hosts, Ring } from './components/ui';
import { ProjectDialog } from './components/ProjectDialog';
import { PrintPortal } from './pages/PrintPortal';
import Dashboard from './pages/Dashboard';

const L = (f: () => Promise<{ default: ComponentType }>) => lazy(f);
const LivePreview = lazy(() => import('./components/LivePreview'));

const PAGES: Record<SectionId, ComponentType> = {
  dashboard: Dashboard,
  identity: L(() => import('./pages/Identity')),
  membership: L(() => import('./pages/Membership')),
  subscriptions: L(() => import('./pages/Subscriptions')),
  rights: L(() => import('./pages/Rights')),
  loans: L(() => import('./pages/Loans')),
  aid: L(() => import('./pages/Aid')),
  board: L(() => import('./pages/Board')),
  finance: L(() => import('./pages/Finance')),
  endowments: L(() => import('./pages/Endowments')),
  assets: L(() => import('./pages/Assets')),
  simulation: L(() => import('./pages/Simulation')),
  risks: L(() => import('./pages/Risks')),
  meetings: L(() => import('./pages/Meetings')),
  library: L(() => import('./pages/Library')),
  review: L(() => import('./pages/Review')),
  reports: L(() => import('./pages/Reports')),
};

const Loading = () => (
  <div className="grid min-h-[40vh] place-items-center text-mute" role="status">
    جارٍ التحميل…
  </div>
);

const SaveChip = ({ onClick }: { onClick: () => void }) => {
  const status = useStore((s) => s.saveStatus);
  const err = useStore((s) => s.saveError);
  const map = {
    saved: ['تم الحفظ محليًا', 'bg-ok-soft text-ok'],
    saving: ['جارٍ الحفظ…', 'bg-info-soft text-info'],
    dirty: ['تعديلات غير محفوظة بعد…', 'bg-warn-soft text-warn'],
    error: ['تعذر الحفظ', 'bg-bad-soft text-bad'],
  } as const;
  const [label, cls] = map[status];
  return (
    <button className={cx('badge', cls)} onClick={onClick} title={err ?? 'البيانات محفوظة في هذا المتصفح فقط'} aria-live="polite">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </button>
  );
};

const Shell = () => {
  const section = useSection();
  const { project, ctx, percent } = useDerived();
  const navOpen = useUi((s) => s.navOpen);
  const setNavOpen = useUi((s) => s.setNavOpen);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [dlg, setDlg] = useState(false);
  const [preview, setPreview] = useState(false);
  const name = resolveText(project.name, ctx);
  const Page = PAGES[section];

  useEffect(() => {
    document.title = `${name} | منصة بناء الميثاق`;
  }, [name]);

  useEffect(() => {
    setNavOpen(false);
  }, [section, setNavOpen]);

  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [undo]);

  return (
    <div id="app-shell" className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-paper focus:p-2">
        تخطّ إلى المحتوى
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
          <button className="btn btn-ghost lg:hidden" aria-label="القائمة" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>
            {navOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <button className="min-w-0 flex-1 text-start" onClick={() => setDlg(true)} title="إدارة المشروع">
            <div className="text-[0.7rem] font-semibold text-gold-deep">مشروع الميثاق</div>
            <div className="truncate text-base font-bold text-brand-900 sm:text-lg">{name}</div>
          </button>
          <div className="hidden sm:block">
            <SaveChip onClick={() => setDlg(true)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview(true)} aria-label="معاينة الميثاق لحظيًا" title="معاينة الميثاق النهائي لحظيًا">
            <Eye className="size-4" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!canUndo} aria-label="تراجع" title="تراجع عن آخر تعديل">
            <Undo2 className="size-4" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={redo} disabled={!canRedo} aria-label="إعادة" title="إعادة">
            <Redo2 className="size-4" />
          </button>
          <button className="flex items-center gap-2 rounded-xl px-1 hover:bg-brand-50" onClick={() => go('review')} title="نسبة اكتمال الميثاق (بحسب متطلبات قابلة للفحص)">
            <Ring value={percent} size={44} label={`اكتمال الميثاق ${percent}%`} />
            <span className="hidden text-xs font-semibold leading-tight text-mute md:block">
              اكتمال
              <br />
              الميثاق
            </span>
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => setDlg(true)} aria-label="إدارة المشروع والبيانات">
            <Settings2 className="size-4" />
            <span className="hidden md:inline">البيانات</span>
          </button>
        </div>
        <div className="px-3 pb-2 sm:hidden">
          <SaveChip onClick={() => setDlg(true)} />
        </div>
      </header>

      <div className="lg:flex">
        <nav
          aria-label="أقسام المنصة"
          className={cx(
            'z-30 border-e border-line bg-paper lg:sticky lg:top-[3.7rem] lg:block lg:h-[calc(100vh-3.7rem)] lg:w-72 lg:shrink-0 lg:overflow-y-auto',
            navOpen ? 'fixed inset-x-0 bottom-0 top-[5.9rem] block overflow-y-auto sm:top-[3.8rem]' : 'hidden',
          )}
        >
          <ul className="space-y-0.5 p-2">
            {SECTIONS.map((s) => {
              const active = s.id === section;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-semibold transition-colors',
                      active ? 'bg-brand-800 text-white' : 'text-ink hover:bg-brand-50',
                    )}
                  >
                    <span className={cx('ltr w-6 shrink-0 text-xs', active ? 'text-gold-soft' : 'text-gold-deep')}>{s.num}</span>
                    <s.icon className="size-4 shrink-0" aria-hidden />
                    <span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="m-3 rounded-lg bg-gold-soft p-3 text-xs leading-relaxed text-gold-deep">
            أداة لإعداد مشروع الميثاق واتخاذ القرارات، وليست بديلًا عن الترخيص والمراجعة القانونية والشرعية والمالية.
          </p>
        </nav>

        <main id="main" className="min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<Loading />}>
              <Page />
            </Suspense>
          </div>
        </main>
      </div>

      {dlg && <ProjectDialog onClose={() => setDlg(false)} />}
      {preview && (
        <Suspense fallback={null}>
          <LivePreview onClose={() => setPreview(false)} />
        </Suspense>
      )}
    </div>
  );
};

const Fatal = ({ msg }: { msg: string }) => {
  const newProject = useStore((s) => s.newProject);
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-lg space-y-3 p-6">
        <h1 className="text-xl">تعذر فتح بيانات المشروع المحفوظة</h1>
        <p className="text-sm">{msg}</p>
        <p className="text-sm text-mute">لن نمسح بياناتك القديمة. يمكنك بدء مشروع جديد ثم محاولة الاسترجاع من نسخة JSON سبق تصديرها.</p>
        <button className="btn btn-primary" onClick={() => void newProject().then(() => void useStore.getState().init())}>
          ابدأ مشروعًا جديدًا
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const ready = useStore((s) => s.ready);
  const initError = useStore((s) => s.initError);

  useEffect(() => {
    void useStore.getState().init();
    installFlushOnExit();
  }, []);

  if (initError) return <Fatal msg={initError} />;
  if (!ready) return <Loading />;
  return (
    <DerivedProvider>
      <Shell />
      <Hosts />
      <PrintPortal />
    </DerivedProvider>
  );
}
