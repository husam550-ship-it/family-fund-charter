import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { Slide } from '../present/slides';
import { cx } from './ui';
import { QrCode } from './QrCode';

/** عرض الشرائح بملء الشاشة. في الاتجاه العربي: السهم الأيسر للأمام والأيمن للخلف */
export const Deck = ({ slides, onClose }: { slides: Slide[]; onClose: () => void }) => {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;
  const slide = slides[Math.min(i, last)];
  const go = (k: number): void => setI(Math.min(last, Math.max(0, k)));

  useEffect(() => {
    root.current?.focus();
    const on = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') go(i + 1);
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(last);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  });

  const cover = slide.kind === 'cover';
  return (
    <div
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="عرض الميثاق للأسرة"
      className={cx('fixed inset-0 z-[60] flex flex-col outline-none', cover ? 'bg-brand-900 text-ivory' : 'bg-paper text-ink')}
    >
      <div className={cx('flex items-center gap-3 px-4 py-2 text-sm', cover ? 'text-gold-soft' : 'text-mute')}>
        <span className="flex-1">
          الشريحة {i + 1} من {slides.length}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          aria-label="ملء الشاشة"
          onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())}
        >
          <Maximize2 className="size-4" />
        </button>
        <button className="btn btn-ghost btn-sm" aria-label="إغلاق العرض" onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 sm:px-12">
        <div className={cx('mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-5 py-4', cover && 'items-center text-center')}>
          {cover ? (
            <>
              <h1 className="text-[clamp(2rem,6vw,4.5rem)] leading-tight text-ivory">{slide.title}</h1>
              {slide.lead && <p className="text-[clamp(1.2rem,2.6vw,2rem)] text-gold-soft">{slide.lead}</p>}
            </>
          ) : (
            <>
              <h2 className="text-[clamp(1.8rem,4.2vw,3.2rem)] leading-tight text-brand-900">{slide.title}</h2>
              {slide.lead && <p className="text-[clamp(1.1rem,2.4vw,1.9rem)] font-semibold text-brand-700">{slide.lead}</p>}
            </>
          )}

          {slide.points.length > 0 && (
            <ul className={cx('space-y-3 text-[clamp(1.05rem,2.2vw,1.8rem)] leading-relaxed', cover ? 'max-w-3xl' : 'list-disc ps-7 marker:text-gold')}>
              {slide.points.map((t, k) => (
                <li key={k} className={cover ? 'list-none' : undefined}>
                  {t}
                </li>
              ))}
            </ul>
          )}

          {slide.facts.some((f) => f.value !== slide.qr) && (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slide.facts
                .filter((f) => f.value !== slide.qr)
                .map((f) => (
                <div key={f.label} className="rounded-xl border border-line bg-brand-50 p-4">
                  <dt className="text-sm font-semibold text-mute">{f.label}</dt>
                  <dd className="mt-1 break-words text-[clamp(1.05rem,2vw,1.6rem)] font-bold text-brand-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {slide.qr && (
            <div className="flex items-center gap-5">
              <QrCode value={slide.qr} size={176} label="رمز QR لرابط التسجيل" />
              <div className="min-w-0 space-y-2">
                <p className="text-lg font-semibold text-brand-900">امسح الرمز بكاميرا الهاتف لفتح صفحة التسجيل</p>
                <p className="ltr break-all text-end text-sm text-mute">{slide.qr}</p>
              </div>
            </div>
          )}

          {slide.ask && (
            <div className="rounded-xl border-s-4 border-gold bg-gold-soft p-4 text-[clamp(1.05rem,2.1vw,1.7rem)] font-bold text-gold-deep">
              السؤال الذي سنقرره: {slide.ask}
            </div>
          )}
        </div>
      </div>

      <div className={cx('flex items-center gap-3 px-4 py-3', cover && 'text-ivory')}>
        <button className="btn btn-soft" onClick={() => go(i - 1)} disabled={i === 0} aria-label="الشريحة السابقة">
          <ChevronRight className="size-5" /> السابقة
        </button>
        <div className="flex flex-1 flex-wrap justify-center gap-1.5" aria-hidden>
          {slides.map((s, k) => (
            <button
              key={s.id}
              tabIndex={-1}
              onClick={() => go(k)}
              className={cx('h-2.5 rounded-full transition-all', k === i ? 'w-7 bg-gold' : 'w-2.5 bg-brand-300 hover:bg-brand-500')}
            />
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => go(i + 1)} disabled={i === last} aria-label="الشريحة التالية">
          التالية <ChevronLeft className="size-5" />
        </button>
      </div>
    </div>
  );
};
