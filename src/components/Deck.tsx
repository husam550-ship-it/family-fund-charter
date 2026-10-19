import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { Slide } from '../present/slides';
import { cx } from './ui';
import { SlideView, surfaceOf } from './SlideView';

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
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="عرض الميثاق للأسرة" className={cx('fixed inset-0 z-[60] flex flex-col outline-none', surfaceOf(slide))}>
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

      <div className="min-h-0 flex-1" style={{ fontSize: 'clamp(16px, 2.1vw, 34px)' }}>
        <SlideView slide={slide} />
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
