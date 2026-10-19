import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** رمز QR يُرسم محليًا (دون خدمة خارجية) كـ SVG */
export const QrCode = ({ value, size = 176, label }: { value: string; size?: number; label: string }) => {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);
  const margin = 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${count + margin * 2} ${count + margin * 2}`}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <path d={path} fill="#102a1e" />
    </svg>
  );
};
