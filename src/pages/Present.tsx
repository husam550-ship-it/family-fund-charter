import { useMemo, useState } from 'react';
import { FileText, Images, Play } from 'lucide-react';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { toast, useUi } from '../lib/ui';
import { downloadBlob } from '../lib/download';
import { todayIso } from '../lib/format';
import { go } from '../lib/nav';
import { allSlides } from '../present/slides';
import { projectJoinLink } from '../registration/link';
import { Deck } from '../components/Deck';
import { SlideExporter } from '../components/SlideExporter';
import { Badge, Callout, Card, SectionHead } from '../components/ui';
import { Check, TextArea } from '../components/fields';

export default function Present() {
  const { project, ctx, sims } = useDerived();
  const update = useStore((s) => s.update);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const joinLink = projectJoinLink(project);
  const slides = useMemo(() => allSlides({ p: project, ctx, base: sims.base, joinLink }), [project, ctx, sims, joinLink]);
  const shown = slides.filter((s) => !s.hidden);

  const openAsDocument = (): void => {
    useUi.setState({ reportDoc: 'explainer' });
    go('reports');
  };

  return (
    <div className="space-y-6">
      <SectionHead
        num="18 / عرض الميثاق للأسرة"
        title="عرض الميثاق للأسرة"
        sub="شرح مبسط يُعرض على أفراد العائلة قبل بدء النقاش. تُبنى الشرائح من بيانات المشروع الحالية، وتظهر الأرقام فيها متى أُدخلت فقط، ولا يُقال إن شيئًا معتمد ما لم يُعتمد."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setPlaying(true)} disabled={shown.length === 0}>
              <Play className="size-4" /> بدء العرض
            </button>
            <button className="btn btn-soft" onClick={() => setExporting(0)} disabled={shown.length === 0 || exporting !== null}>
              <Images className="size-4" /> {exporting === null ? 'تصدير الشرائح كصور' : `جارٍ تجهيز الشريحة ${exporting} من ${shown.length}…`}
            </button>
            <button className="btn btn-soft" onClick={openAsDocument}>
              <FileText className="size-4" /> نسخة مطبوعة للتوزيع
            </button>
          </>
        }
      />

      <Callout tone="info" title="كيف تستعملها في الاجتماع؟">
        اضغط «بدء العرض» ثم «ملء الشاشة». السهم الأيسر أو مفتاح المسافة للشريحة التالية، والأيمن للسابقة، وEsc للخروج.
        {joinLink ? ' تظهر قبل نهاية العرض شريحة برمز QR لرابط التسجيل.' : ' بعد ضبط رابط التسجيل في القسم 19 تظهر شريحة برمز QR للتسجيل.'}
      </Callout>

      <Card>
        <h2 className="mb-1 text-lg">الشرائح ({shown.length} من {slides.length})</h2>
        <p className="mb-4 text-sm text-mute">أخفِ ما لا يناسب جمهورك، وأضف نقطة خاصة بك إلى أي شريحة؛ فتظهر في العرض وفي النسخة المطبوعة.</p>
        <ol className="space-y-3">
          {slides.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="ltr w-6 text-xs text-gold-deep">{i + 1}</span>
                <b className="flex-1 text-brand-900">{s.title}</b>
                {s.kind === 'open' && <Badge tone="warn">يتغير بحسب المشروع</Badge>}
                <Check checked={!s.hidden} onChange={(v) => update((d) => void (d.presentation.hidden[s.id] = !v))} label="يظهر في العرض" />
              </div>
              {s.lead && <p className="mb-1 text-sm text-mute">{s.lead}</p>}
              <TextArea
                rows={2}
                ariaLabel={`نقطة إضافية — ${s.title}`}
                placeholder="نقطة إضافية تظهر في هذه الشريحة (اختياري)"
                value={project.presentation.extra[s.id] ?? ''}
                onChange={(v) => update((d) => void (d.presentation.extra[s.id] = v), `pe:${s.id}`)}
              />
            </li>
          ))}
        </ol>
      </Card>

      {playing && <Deck slides={shown} onClose={() => setPlaying(false)} />}
      {exporting !== null && (
        <SlideExporter
          slides={shown}
          onProgress={setExporting}
          onDone={(zip) => {
            setExporting(null);
            downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `slides-${todayIso()}.zip`);
            toast(`صُدّرت ${shown.length} صورة (1920×1080) في ملف ZIP.`);
          }}
          onFail={(e) => {
            setExporting(null);
            toast(`تعذر تصدير الصور: ${e instanceof Error ? e.message : String(e)}`, 'error');
          }}
        />
      )}
    </div>
  );
}
