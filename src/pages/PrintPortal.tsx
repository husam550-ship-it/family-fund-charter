import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../lib/store';
import { useUi } from '../lib/ui';
import { buildDoc } from '../docs/build';
import { DocView } from '../docs/DocView';

/** يطبع الوثيقة المختارة: تُعرض داخل #print-root ثم تُستدعى نافذة الطباعة (Save as PDF) */
export const PrintPortal = () => {
  const printDoc = useUi((s) => s.printDoc);
  const meetingId = useUi((s) => s.reportMeetingId);
  const project = useStore((s) => s.project);
  const root = typeof document !== 'undefined' ? document.getElementById('print-root') : null;
  const doc = useMemo(() => (printDoc ? buildDoc(project, printDoc, { meetingId }) : null), [printDoc, project, meetingId]);

  useEffect(() => {
    if (!doc) return;
    const done = (): void => useUi.getState().setPrintDoc(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 250);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [doc]);

  if (!doc || !root) return null;
  // ترويسة وتذييل وترقيم صفحات عبر صناديق هوامش @page (يدعمها Chrome وEdge)
  const q = (t: string): string => JSON.stringify(t.replace(/\s+/g, ' '));
  const box = 'font-family: Cairo, sans-serif; font-size: 8.5pt; color: #666;';
  const css = `@media print { @page {
    @top-right { content: ${q(doc.title)}; ${box} }
    @top-left { content: ${q(doc.subtitle)}; ${box} }
    @bottom-right { content: ${q(doc.footer)}; ${box} }
    @bottom-left { content: "صفحة " counter(page) " من " counter(pages); ${box} }
  } }`;
  return createPortal(
    <>
      <style>{css}</style>
      <DocView doc={doc} />
    </>,
    root,
  );
};
