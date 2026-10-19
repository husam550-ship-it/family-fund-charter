import type { Doc } from './types';
import { dateLabel } from '../lib/format';

// تصدير DOCX قابل للتحرير مع اتجاه عربي RTL كامل. تُحمَّل المكتبة عند الطلب فقط.

const FONT = 'Arial';
const GREEN = '1F4D3A';
const GOLD = 'B8923A';

export const toDocxBlob = async (doc: Doc): Promise<Blob> => {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, Header, PageNumber, BorderStyle, ShadingType, PageBreak } = d;

  const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
    new TextRun({
      text,
      font: FONT,
      rightToLeft: true,
      bold: o.bold,
      boldComplexScript: o.bold,
      italics: o.italics,
      size: o.size ?? 24,
      sizeComplexScript: o.size ?? 24,
      color: o.color,
    });

  const para = (text: string, o: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; keepNext?: boolean } = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: o.align ?? AlignmentType.LEFT, // في الفقرات RTL تعني «البداية» أي اليمين
      spacing: { before: o.before ?? 0, after: o.after ?? 120, line: 340 },
      keepNext: o.keepNext,
      children: [run(text, o)],
    });

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9C2AE' } as const;
  const cell = (text: string, header = false) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      shading: header ? { type: ShadingType.CLEAR, fill: 'EEF4F0', color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [para(text, { bold: header, size: 20, color: header ? GREEN : undefined, after: 0 })],
    });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  // الغلاف
  children.push(
    para(doc.title, { bold: true, size: 48, color: GREEN, align: AlignmentType.CENTER, before: 2800, after: 200 }),
    para(doc.subtitle, { size: 28, align: AlignmentType.CENTER, after: 400 }),
    para(`الإصدار: ${doc.version}`, { size: 24, align: AlignmentType.CENTER }),
    para(`تاريخ الإصدار: ${dateLabel(doc.issueDate)}`, { size: 24, align: AlignmentType.CENTER }),
    ...(doc.reviewDate ? [para(`تاريخ المراجعة: ${dateLabel(doc.reviewDate)}`, { size: 24, align: AlignmentType.CENTER })] : []),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // فهرس المحتويات (ثابت دون أرقام صفحات)
  if (doc.toc.length) {
    children.push(para('فهرس المحتويات', { bold: true, size: 32, color: GREEN, keepNext: true }));
    doc.toc.forEach((t, i) => children.push(para(`${i + 1}. ${t}`, { size: 24, after: 60 })));
  }

  for (const b of doc.blocks) {
    switch (b.t) {
      case 'h':
        children.push(
          para(b.text, {
            bold: true,
            size: b.level === 1 ? 36 : b.level === 2 ? 30 : 26,
            color: b.level === 3 ? '24523D' : GREEN,
            before: b.level === 2 ? 360 : 240,
            after: 120,
            keepNext: true,
          }),
        );
        break;
      case 'p':
        children.push(para(b.text, { align: AlignmentType.BOTH }));
        break;
      case 'ul':
        b.items.forEach((x) => children.push(para(`• ${x}`, { size: 24, after: 60 })));
        break;
      case 'ol':
        b.items.forEach((x, i) => children.push(para(`${i + 1}. ${x}`, { size: 24, after: 60 })));
        break;
      case 'table':
        children.push(
          new Table({
            visuallyRightToLeft: true,
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ tableHeader: true, children: b.head.map((h) => cell(h, true)) }),
              ...b.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c) => cell(c)) })),
            ],
          }),
          para('', { after: 120 }),
        );
        break;
      case 'clause':
        children.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.LEFT,
            keepNext: true,
            spacing: { before: 160, after: 40 },
            border: { right: { style: BorderStyle.SINGLE, size: 18, color: b.status === 'approved' ? GREEN : GOLD, space: 8 } },
            children: [run(`بند ${b.n}: ${b.title}`, { bold: true, color: GREEN }), run(`   (${b.status === 'approved' ? 'معتمد' : 'مقترح — غير معتمد'})`, { size: 20, color: b.status === 'approved' ? GREEN : GOLD })],
          }),
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.BOTH,
            spacing: { after: 120, line: 340 },
            border: { right: { style: BorderStyle.SINGLE, size: 18, color: b.status === 'approved' ? GREEN : GOLD, space: 8 } },
            children: [run(b.text)],
          }),
        );
        break;
      case 'note':
        children.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.LEFT,
            spacing: { before: 80, after: 160, line: 320 },
            shading: { type: ShadingType.CLEAR, fill: b.kind === 'warn' ? 'FBEEEA' : 'FBF7EA', color: 'auto' },
            border: { top: border, bottom: border, left: border, right: border },
            children: [run(b.text, { size: 21 })],
          }),
        );
        break;
      case 'pagebreak':
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  }

  if (doc.signatures) {
    children.push(new Paragraph({ children: [new PageBreak()] }), para('صفحة الاعتماد والتوقيعات', { bold: true, size: 32, color: GREEN }), para('اعتُمدت هذه الوثيقة بتاريخ: ____ / ____ / ________'));
    doc.signatures.forEach((s) => children.push(para(`${s.role}: ${s.name || '..............................'}      التوقيع: ..............................`, { before: 360 })));
    children.push(para('التوقيعات اختيارية، ولا تعني الاعتماد النظامي ما لم تقترن بالإجراءات المقررة.', { size: 20, before: 300 }));
  }

  const file = new Document({
    creator: 'منصة بناء ميثاق الصندوق العائلي',
    title: doc.title,
    description: doc.subtitle,
    styles: { default: { document: { run: { font: FONT, size: 24, rightToLeft: true } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1100, right: 1100 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.LEFT, children: [run(`${doc.title} — ${doc.subtitle}`, { size: 18, color: '666666' })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                children: [run(`${doc.footer}   |   `, { size: 18, color: '666666' }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '666666' })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(file);
};
