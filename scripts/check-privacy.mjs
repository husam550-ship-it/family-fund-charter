// يفشل إذا وُجد في المستودع أو في ناتج البناء ما قد يكون بيانات خاصة بالعائلة:
// ملفات JSON غير ملفات الإعداد المعروفة (نسخ احتياطية، تصديرات مشروع) أو ملفات تصدير الوثائق أو ملفات البيئة.
// التشغيل: npm run check:privacy
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git']);
const ALLOWED_JSON = new Set(['package.json', 'package-lock.json', 'tsconfig.json']);
const EXPORTED_DOC = /^family-fund-.*\.(docx|md|pdf|json)$/;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP_DIRS.has(e.name)) return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

const problems = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const base = path.basename(file);
  const inDist = rel.startsWith(`dist${path.sep}`);
  if (base.endsWith('.json') && !(ALLOWED_JSON.has(base) && !inDist)) problems.push(`ملف JSON غير متوقع: ${rel}`);
  if (EXPORTED_DOC.test(base)) problems.push(`ملف تصدير من المنصة: ${rel}`);
  if (/^\.env(\.|$)/.test(base)) problems.push(`ملف بيئة: ${rel}`);
}

if (problems.length) {
  console.error('فحص الخصوصية فشل:\n' + problems.map((p) => `  • ${p}`).join('\n'));
  process.exit(1);
}
console.log('فحص الخصوصية: لا ملفات بيانات خاصة في المستودع أو في ناتج البناء.');
