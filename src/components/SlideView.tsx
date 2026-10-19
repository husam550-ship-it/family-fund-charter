import { useLayoutEffect, useRef } from 'react';
import type { Slide } from '../present/slides';
import { cx } from './ui';
import { QrCode } from './QrCode';

/** خلفية الشريحة ولون نصها؛ يستعملها العرض والتصدير كصور */
export const surfaceOf = (s: Slide): string => (s.kind === 'cover' ? 'bg-brand-900 text-ivory' : 'bg-paper text-ink');

/** كل أحجام الشريحة بوحدة em، فيكفي تصغير حجم الخط ليتسع المحتوى لأي شاشة أو صورة */
const fit = (outer: HTMLElement, inner: HTMLElement): void => {
  let scale = 1;
  inner.style.fontSize = '1em';
  while (outer.scrollHeight > outer.clientHeight + 1 && scale > 0.5) {
    scale = Math.round((scale - 0.04) * 100) / 100;
    inner.style.fontSize = `${scale}em`;
  }
};

/** جسم الشريحة وحده. حجم الخط الأساسي يحدده الحاوي: العرض بحسب الشاشة، والتصدير 34px على 1920×1080 */
export const SlideView = ({ slide }: { slide: Slide }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const run = (): void => {
      if (outer.current && inner.current) fit(outer.current, inner.current);
    };
    run();
    let live = true;
    void document.fonts.ready.then(() => live && run());
    return () => {
      live = false;
    };
  }, [slide]);

  const cover = slide.kind === 'cover';
  const facts = slide.facts.filter((f) => f.value !== slide.qr);
  return (
    <div ref={outer} data-slide-scroll className={cx('h-full overflow-y-auto px-[2.5em]', surfaceOf(slide))}>
      <div ref={inner} className={cx('mx-auto flex min-h-full max-w-[56em] flex-col justify-center gap-[0.8em] py-[1em]', cover && 'items-center text-center')}>
        {cover ? (
          <>
            <h1 className="text-[2.8em] leading-tight text-ivory">{slide.title}</h1>
            {slide.lead && <p className="text-[1.15em] text-gold-soft">{slide.lead}</p>}
          </>
        ) : (
          <>
            <h2 className="text-[1.9em] leading-tight text-brand-900">{slide.title}</h2>
            {slide.lead && <p className="text-[1.1em] font-semibold text-brand-700">{slide.lead}</p>}
          </>
        )}

        {slide.points.length > 0 && (
          <ul className={cx('space-y-[0.55em] leading-relaxed', cover ? 'max-w-[40em]' : 'list-disc ps-[1.4em] marker:text-gold')}>
            {slide.points.map((t, k) => (
              <li key={k} className={cover ? 'list-none' : undefined}>
                {t}
              </li>
            ))}
          </ul>
        )}

        {facts.length > 0 && (
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(14em,1fr))] gap-[0.7em]">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-line bg-brand-50 p-[0.8em]">
                <dt className="text-[0.62em] font-semibold text-mute">{f.label}</dt>
                <dd className="mt-[0.2em] break-words text-[0.95em] font-bold text-brand-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {slide.qr && (
          <div className="flex items-center gap-[1.2em]">
            <QrCode value={slide.qr} size={176} label="رمز QR لرابط التسجيل" />
            <div className="min-w-0 space-y-[0.4em]">
              <p className="font-semibold text-brand-900">امسح الرمز بكاميرا الهاتف لفتح صفحة التسجيل</p>
              <p className="ltr break-all text-end text-[0.6em] text-mute">{slide.qr}</p>
            </div>
          </div>
        )}

        {slide.ask && <div className="rounded-xl border-s-4 border-gold bg-gold-soft p-[0.8em] text-[0.95em] font-bold text-gold-deep">السؤال الذي سنقرره: {slide.ask}</div>}
      </div>
    </div>
  );
};
