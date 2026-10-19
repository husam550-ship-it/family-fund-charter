import type { Doc } from './types';
import { dateLabel } from '../lib/format';

const esc = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Markdown عربي: يُغلَّف بوسم dir="rtl" لتعرضه البرامج الداعمة من اليمين لليسار */
export const toMarkdown = (doc: Doc): string => {
  const out: string[] = ['<div dir="rtl">', '', `# ${doc.title}`, '', `**${doc.subtitle}**`, '', `الإصدار: ${doc.version} — تاريخ الإصدار: ${dateLabel(doc.issueDate)}${doc.reviewDate ? ` — تاريخ المراجعة: ${dateLabel(doc.reviewDate)}` : ''}`, ''];
  if (doc.toc.length) {
    out.push('## فهرس المحتويات', '', ...doc.toc.map((t, i) => `${i + 1}. ${t}`), '');
  }
  for (const b of doc.blocks) {
    switch (b.t) {
      case 'h':
        out.push(`${'#'.repeat(b.level + 1)} ${b.text}`, '');
        break;
      case 'p':
        out.push(b.text, '');
        break;
      case 'ul':
        out.push(...b.items.map((x) => `- ${x}`), '');
        break;
      case 'ol':
        out.push(...b.items.map((x, i) => `${i + 1}. ${x}`), '');
        break;
      case 'table':
        out.push(`| ${b.head.map(esc).join(' | ')} |`, `| ${b.head.map(() => '---').join(' | ')} |`, ...b.rows.map((r) => `| ${r.map(esc).join(' | ')} |`), '');
        break;
      case 'clause':
        out.push(`**بند ${b.n}: ${b.title}** — _${b.status === 'approved' ? 'معتمد' : 'مقترح'}_`, '', b.text, '');
        break;
      case 'note':
        out.push(`> ${b.text}`, '');
        break;
      case 'pagebreak':
        out.push('---', '');
        break;
    }
  }
  if (doc.signatures) {
    out.push('## صفحة الاعتماد والتوقيعات', '', ...doc.signatures.map((s) => `- ${s.role}: ${s.name || '..............................'}`), '');
  }
  out.push('</div>', '');
  return out.join('\n');
};
