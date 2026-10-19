import { useMemo, useState } from 'react';
import { Download, FileDown, FileText, Printer } from 'lucide-react';
import { useStore } from '../lib/store';
import { DOC_DEFS } from '../data/defaults';
import { buildDoc } from '../docs/build';
import { DocView } from '../docs/DocView';
import { toMarkdown } from '../docs/markdown';
import { downloadBlob, downloadText } from '../lib/download';
import { attempt, confirmAction, useUi } from '../lib/ui';
import { Badge, Callout, Card, cx, SectionHead } from '../components/ui';
import { Check, Field, SelectInput, TextInput } from '../components/fields';
import type { Doc } from '../docs/types';

type Fmt = 'docx' | 'md';

export default function Reports() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const exportProject = useStore((s) => s.exportProject);
  const meetingId = useUi((s) => s.reportMeetingId);
  const [sel, setSel] = useState('charter');
  const [busy, setBusy] = useState(false);
  const ds = project.docSettings;
  const meetingBased = sel === 'agenda' || sel === 'minutes';

  const doc: Doc = useMemo(() => buildDoc(project, sel, { meetingId }), [project, sel, meetingId]);

  const setDs = (fn: (d: typeof ds) => void, key?: string): void => update((d) => fn(d.docSettings), key);
  // أسماء ملفات لاتينية آمنة: بعض المتصفحات تُسقط الأسماء العربية وتُسقط الامتداد
  const fileBase = `family-fund-${sel}-${new Date().toISOString().slice(0, 10)}`;

  const guard = async (): Promise<boolean> => {
    if (doc.missing.length === 0) return true;
    return confirmAction({
      title: 'عناصر لم تُستكمل',
      message: `تحتوي الوثيقة على عناصر بصيغة [يُستكمل: …]:\n${doc.missing.map((m) => `• ${m}`).join('\n')}\n\nهل تريد المتابعة بالتصدير؟`,
      confirmLabel: 'تصدير على أي حال',
    });
  };

  const exportFmt = async (f: Fmt): Promise<void> => {
    if (!(await guard())) return;
    setBusy(true);
    await attempt(async () => {
      if (f === 'md') downloadText(toMarkdown(doc), `${fileBase}.md`, 'text/markdown;charset=utf-8');
      else {
        const { toDocxBlob } = await import('../docs/docx');
        downloadBlob(await toDocxBlob(doc), `${fileBase}.docx`);
      }
    }, 'تم تجهيز الملف.');
    setBusy(false);
  };

  const print = async (): Promise<void> => {
    if (!(await guard())) return;
    useUi.getState().setPrintDoc(sel);
  };

  return (
    <div className="space-y-6">
      <SectionHead
        num="17 / التقارير والتصدير"
        title="التقارير والتصدير"
        sub="ثلاث عشرة وثيقة تُولَّد تلقائيًا من البنود والقرارات والمتغيرات، بعربية RTL وفهرس وترقيم وجداول وتواريخ، وتمييز بين المعتمد والمقترح."
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg">الوثائق</h2>
            <ul className="space-y-1.5">
              {DOC_DEFS.map((d, i) => (
                <li key={d.id}>
                  <button
                    className={cx('flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm', sel === d.id ? 'border-brand-600 bg-brand-50 font-bold' : 'border-line hover:bg-brand-50/50')}
                    aria-current={sel === d.id}
                    onClick={() => setSel(d.id)}
                  >
                    <span className="ltr w-5 text-xs text-gold-deep">{i + 1}</span>
                    <FileText className="size-4 shrink-0 text-mute" aria-hidden />
                    <span className="flex-1">{project.docSettings.titles[d.id] ?? d.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg">إعدادات الوثائق</h2>
            <div className="space-y-3">
              <Field label="عنوان هذه الوثيقة (قابل للتعديل)">
                <TextInput value={ds.titles[sel] ?? DOC_DEFS.find((d) => d.id === sel)?.title ?? ''} onChange={(v) => setDs((d) => void (d.titles[sel] = v), `dt:${sel}`)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="تاريخ الإصدار">
                  <TextInput type="date" value={ds.issueDate} onChange={(v) => setDs((d) => void (d.issueDate = v))} />
                </Field>
                <Field label="تاريخ المراجعة">
                  <TextInput type="date" value={ds.reviewDate} onChange={(v) => setDs((d) => void (d.reviewDate = v))} />
                </Field>
              </div>
              <Field label="رقم الإصدار">
                <TextInput value={ds.version} onChange={(v) => setDs((d) => void (d.version = v), 'dv')} />
              </Field>
              <Field label="سطر التذييل">
                <TextInput value={ds.footerLine} onChange={(v) => setDs((d) => void (d.footerLine = v), 'df')} />
              </Field>
              <Check checked={ds.includeProposed} onChange={(v) => setDs((d) => void (d.includeProposed = v))} label="تضمين البنود المقترحة (مميزة عن المعتمدة)" />
              <Check checked={ds.signatures} onChange={(v) => setDs((d) => void (d.signatures = v))} label="إضافة صفحة اعتماد وتوقيعات (اختيارية)" />
              {ds.signatures && (
                <div className="space-y-2 rounded-lg border border-line p-2">
                  {ds.signatories.map((s, i) => (
                    <div key={s.id} className="grid grid-cols-2 gap-2">
                      <TextInput value={s.role} ariaLabel="الصفة" onChange={(v) => setDs((d) => void (d.signatories[i].role = v), `sr${s.id}`)} />
                      <TextInput value={s.name} ariaLabel="الاسم" placeholder="الاسم (اختياري)" onChange={(v) => setDs((d) => void (d.signatories[i].name = v), `sn${s.id}`)} />
                    </div>
                  ))}
                </div>
              )}
              {meetingBased && (
                <Field label="الاجتماع">
                  <SelectInput
                    value={meetingId ?? project.meetings[0]?.id ?? ''}
                    options={project.meetings.length ? project.meetings.map((m) => ({ value: m.id, label: m.title })) : [{ value: '', label: 'لا اجتماعات' }]}
                    onChange={(v) => useUi.setState({ reportMeetingId: v })}
                  />
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-lg">بيانات المشروع كاملة</h2>
            <p className="mb-3 text-sm text-mute">ملف JSON يحفظ كل بيانات المشروع ويمكن استيراده لاحقًا. لا ترفعه إلى مستودع عام.</p>
            <button className="btn btn-soft" onClick={() => exportProject()}>
              <FileDown className="size-4" /> تصدير JSON
            </button>
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <b className="flex-1 text-brand-900">{doc.title}</b>
              {doc.missing.length > 0 ? <Badge tone="warn">{doc.missing.length} عنصر يحتاج استكمالًا</Badge> : <Badge tone="ok">لا عناصر ناقصة</Badge>}
              <button className="btn btn-primary" onClick={() => void print()}>
                <Printer className="size-4" /> طباعة / حفظ PDF
              </button>
              <button className="btn btn-soft" disabled={busy} onClick={() => void exportFmt('docx')}>
                <Download className="size-4" /> DOCX
              </button>
              <button className="btn btn-soft" disabled={busy} onClick={() => void exportFmt('md')}>
                <Download className="size-4" /> Markdown
              </button>
            </div>
            <p className="hint mt-2">لحفظ PDF اختر «Save as PDF» (حفظ كـ PDF) في نافذة الطباعة، وبحجم A4. تُنشأ الوثيقة بخط عربي مضمّن.</p>
          </Card>
          {doc.missing.length > 0 && (
            <Callout tone="warn" title="عناصر تحتاج استكمالًا قبل الإصدار">
              {doc.missing.join('، ')}
            </Callout>
          )}
          <div className="overflow-x-auto rounded-2xl bg-brand-50/60 p-2 sm:p-4" aria-label="معاينة الوثيقة">
            <DocView doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}
