import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { zipSync } from 'fflate';
import type { Slide } from '../present/slides';
import { SlideView } from './SlideView';

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

const nextPaint = async (): Promise<void> => {
  await document.fonts.ready;
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
};

const bytesOf = (dataUrl: string): Uint8Array => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));

/**
 * يرسم الشرائح واحدة واحدة خارج الشاشة بقياس 1920×1080 ويلتقط كل شريحة صورة PNG،
 * ثم يسلّم ملف ZIP. الشريحة المرسومة هي نفسها المعروضة في العرض (SlideView).
 */
export const SlideExporter = ({ slides, onProgress, onDone, onFail }: { slides: Slide[]; onProgress: (n: number) => void; onDone: (zip: Uint8Array) => void; onFail: (e: unknown) => void }) => {
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const files: Record<string, Uint8Array> = {};
        for (let k = 0; k < slides.length; k++) {
          setIndex(k);
          onProgress(k + 1);
          await nextPaint();
          if (cancelled || !stage.current) return;
          const png = await toPng(stage.current, { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, pixelRatio: 1 });
          files[`slide-${String(k + 1).padStart(2, '0')}.png`] = bytesOf(png);
        }
        if (!cancelled) onDone(zipSync(files, { level: 0 }));
      } catch (e) {
        if (!cancelled) onFail(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // يعمل مرة واحدة لكل تصدير (الشرائح ثابتة طوال التصدير)
  }, []); // eslint-disable-line

  return (
    <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
      <div ref={stage} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, fontSize: 34 }}>
        <SlideView slide={slides[index]} />
      </div>
    </div>
  );
};
