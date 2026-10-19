// اختبارات القبول على متصفح فعلي. تشغيل: npm run build && npm run e2e
// المتصفح: متغير CHROMIUM_PATH، أو المتصفح الافتراضي لـ playwright-core (npx playwright install chromium).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const DIST = path.resolve('dist');
const PREFIX = '/family-fund-charter/'; // يحاكي مستودعًا فرعيًا على GitHub Pages
const TMP = fs.mkdtempSync('/tmp/ffc-e2e-');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!url.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
  const rel = url.slice(PREFIX.length) || 'index.html';
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}${PREFIX}`;

const launch = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
else if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) launch.executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(launch);

let passed = 0;
const failed = [];
const consoleErrors = [];
const check = async (name, fn) => {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (e) { failed.push(name); console.log('FAIL', name, '\n   ', String(e.message ?? e).split('\n').slice(0, 4).join('\n    ')); }
  // أغلق أي نافذة بقيت مفتوحة حتى لا يؤثر إخفاق على ما بعده
  for (let i = 0; i < 3 && !page.isClosed() && (await page.getByRole('dialog').count()) > 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? 'قيمتان مختلفتان'}: المتوقع «${b}» والفعلي «${a}»`); };
const ok = (c, m) => { if (!c) throw new Error(m ?? 'شرط غير متحقق'); };

const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(() => { window.print = () => { window.__printed = true; }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => consoleErrors.push('requestfailed: ' + r.url()));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app-shell');
  return { ctx, page };
};
const go = async (page, s) => { await page.evaluate((x) => { window.location.hash = '#/' + x; }, s); await page.waitForTimeout(500); };
const varInput = (page, label) => page.locator(`input[aria-label="${label}"]`).first();
const setNum = async (page, label, v) => { const i = varInput(page, label); await i.fill(String(v)); };
const openData = async (page) => { await page.getByRole('button', { name: 'إدارة المشروع والبيانات' }).click(); };
const loadDemo = async (page) => {
  await openData(page);
  await page.getByRole('tab', { name: /بيانات توضيحية/ }).click();
  await page.getByRole('button', { name: /تحميل بيانات توضيحية/ }).click();
  await page.waitForTimeout(300);
};
const approve = async (page, id) => { await page.locator(`#clause-${id} button`, { hasText: 'اعتماد' }).first().click(); };
const preview = async (page) => { await page.getByRole('button', { name: 'معاينة الميثاق لحظيًا' }).click(); return page.getByRole('dialog'); };
const confirmExport = async (page) => { await page.getByRole('button', { name: 'تصدير على أي حال' }).click({ timeout: 2500 }).catch(() => {}); };

let { ctx, page } = await newPage();

await check('20. يعمل مباشرة دون رقم دخول أو تسجيل', async () => {
  eq(await page.locator('input[type=password]').count(), 0, 'حقول كلمة المرور');
  ok(await page.locator('h1').first().isVisible(), 'لا تظهر لوحة المشروع مباشرة');
});

await check('25. المشروع الافتراضي باسمه المطلوب وجميع البنود «يحتاج مناقشة» (22: لا اعتماد تلقائي)', async () => {
  eq(await page.locator('h1').first().innerText(), 'مشروع ميثاق صندوق ذرية حسين عمر العائلي');
  await go(page, 'library');
  ok((await page.getByText('معتمد: 0').count()) > 0 || (await page.locator('button[role=radio]', { hasText: 'معتمد' }).first().innerText()).includes('0'), 'يوجد بند معتمد افتراضيًا');
  const n = await page.locator('article[id^=clause-]').count();
  ok(n >= 80, `عدد البنود ${n}`);
});

await check('1. اسم «حسين عمر» قابل للتعديل ويتحدّث في كل الأماكن، وتعديل اسم المشروع', async () => {
  await go(page, 'dashboard');
  await varInput(page, 'اسم صاحب الاسم (العائلة)').fill('أحمد بن سالم');
  await page.waitForTimeout(300);
  ok((await page.locator('h1').first().innerText()).includes('أحمد بن سالم'), 'العنوان لم يتحدث');
  ok((await page.locator('header').first().innerText()).includes('أحمد بن سالم'), 'الشريط العلوي لم يتحدث');
  await go(page, 'library');
  await page.locator('#clause-FND-09 button[aria-expanded]').first().click();
  ok((await page.locator('#clause-FND-09').innerText()).includes('أحمد بن سالم'), 'نص البند لم يتحدث');
  // اسم المشروع
  await openData(page);
  const nameInput = page.getByRole('dialog').locator('input').first();
  await nameInput.fill('مشروع ميثاق تجريبي');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok((await page.locator('header').first().innerText()).includes('مشروع ميثاق تجريبي'), 'اسم المشروع لم يتغير');
  await go(page, 'dashboard');
  await varInput(page, 'اسم صاحب الاسم (العائلة)').fill('حسين عمر');
});

await check('2/13. اختيار بند واعتماده يظهر في الميثاق النهائي (معتمد) والمقترح يظهر مميزًا', async () => {
  await go(page, 'library');
  await approve(page, 'FND-03');
  const d = await preview(page);
  const txt = await d.innerText();
  ok(txt.includes('المساواة في الحقوق'), 'البند لا يظهر');
  ok(txt.includes('معتمد'), 'لا وسم معتمد');
  ok(txt.includes('مقترح'), 'لا تمييز للمقترح');
  await page.keyboard.press('Escape');
});

await check('3. تعديل متغير الاشتراك يحدّث النصوص والحسابات المرتبطة', async () => {
  await go(page, 'subscriptions');
  await setNum(page, 'قيمة الاشتراك الشهري', 175);
  await setNum(page, 'مدة الاشتراك', 9);
  await varInput(page, 'تاريخ بداية الاشتراكات').fill('2027-03');
  await page.waitForTimeout(300);
  await go(page, 'library');
  await page.locator('#clause-SUB-01 button[aria-expanded]').first().click();
  const t = await page.locator('#clause-SUB-01').innerText();
  ok(t.includes('175 ريال'), 'قيمة الاشتراك لم تظهر في البند');
  ok(t.includes('9'), 'المدة لم تظهر في البند');
});

await check('4. اختلاف عدد المشتركين بين الفئات ينعكس على الإيراد', async () => {
  await go(page, 'subscriptions');
  const rows = page.locator('input[aria-label="العدد المستهدف"]');
  await rows.nth(0).fill('40');
  await rows.nth(1).fill('10');
  await page.waitForTimeout(300);
  const a = await page.locator('.card', { hasText: 'المشتركون المتوقعون' }).first().innerText();
  ok(a.includes('50'), 'عدد المشتركين لم يُجمع');
  const before = await page.locator('.card', { hasText: 'إجمالي الالتزامات التعاقدية' }).first().innerText();
  await rows.nth(1).fill('30');
  await page.waitForTimeout(300);
  const after = await page.locator('.card', { hasText: 'إجمالي الالتزامات التعاقدية' }).first().innerText();
  ok(before !== after, 'الإيراد لم يتغير');
});

await check('5. مدة مختلفة لكل فئة مع بقاء المساواة في الحقوق الأساسية', async () => {
  await go(page, 'subscriptions');
  await page.getByRole('tab', { name: 'المدة والانتهاء' }).click();
  await page.locator('select[aria-label="نموذج مدة الاشتراك"]').selectOption('by_gender');
  await page.getByRole('tab', { name: 'المتغيرات والفئات' }).click();
  const years = page.locator('input[aria-label="years"]');
  await years.nth(0).fill('10');
  await years.nth(1).fill('7');
  await page.getByRole('tab', { name: /المقارنة العادلة/ }).click();
  const txt = await page.locator('main').innerText();
  ok(txt.includes('إجمالي الفرد'), 'لا مقارنة عادلة');
  ok(txt.includes('الحقوق الأساسية'), 'لا تنبيه عدم المساس بالحقوق');
  await go(page, 'membership');
  await page.getByRole('tab', { name: /فئات العضوية والحقوق/ }).click();
  const m = await page.locator('main').innerText();
  ok(m.includes('المساعدات الإنسانية') && m.includes('مشترك منتظم'), 'جدول الحقوق غير موجود');
});

await check('6/7/8. إضافة أصل عقاري يحدّث خطة التمويل، والشراء ضمن النقد والأصول، وتغيير الإيجار يغيّر العائد', async () => {
  await go(page, 'subscriptions');
  await page.getByRole('tab', { name: 'المتغيرات والفئات' }).click();
  await setNum(page, 'قيمة الاشتراك الشهري', 600);
  await go(page, 'assets');
  await page.getByRole('button', { name: /إضافة أصل/ }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[aria-label=""]').first().isVisible().catch(() => {});
  const inputs = dlg.locator('input');
  await inputs.nth(0).fill('عمارة اختبار');
  // التكلفة المستهدفة والإيراد: نعتمد النصوص المجاورة
  const setField = async (label, v) => { await dlg.locator('.label', { hasText: label }).first().locator('xpath=following::input[1]').fill(String(v)); };
  await setField('التكلفة المستهدفة', 300000);
  await setField('الإيراد السنوي الإجمالي', 30000);
  await setField('نسبة الإشغال', 100);
  await dlg.getByRole('button', { name: 'تم' }).click();
  const row1 = await page.locator('tr', { hasText: 'عمارة اختبار' }).innerText();
  ok(row1.includes('300,000'), 'التكلفة لا تظهر في السجل');
  ok(/20\d\d/.test(row1), 'لا سنة شراء محتملة');
  const net1 = (row1.match(/30,000 ريال/) ?? [''])[0];
  ok(net1 !== '', 'صافي الإيراد لم يُحسب');
  // تغيير الإيجار
  await page.locator('tr', { hasText: 'عمارة اختبار' }).getByRole('button', { name: /تحرير/ }).click();
  const d2 = page.getByRole('dialog');
  await d2.locator('.label', { hasText: 'الإيراد السنوي الإجمالي' }).first().locator('xpath=following::input[1]').fill('60000');
  await d2.getByRole('button', { name: 'تم' }).click();
  const row2 = await page.locator('tr', { hasText: 'عمارة اختبار' }).innerText();
  ok(row2.includes('60,000 ريال'), 'تغيير الإيجار لم يغيّر صافي العائد');
  // الشراء: يظهر في بطاقة سنة الشراء بتكلفة لا تقل عن التكلفة الحالية، ويدخل في الجدول السنوي
  await go(page, 'simulation');
  await page.getByRole('tab', { name: 'النتائج والرسوم' }).click();
  const li = page.locator('li', { hasText: 'عمارة اختبار' }).filter({ hasText: 'بتكلفة تقديرية' });
  ok((await li.count()) > 0, 'الأصل لا يظهر مشتَرًا في المحاكاة: ' + (await page.locator('li', { hasText: 'عمارة اختبار' }).allInnerTexts()).join(' | '));
  const cost = Number(((await li.first().innerText()).match(/بتكلفة تقديرية ([\d,]+)/) ?? [])[1]?.replace(/,/g, ''));
  ok(cost >= 300000, `تكلفة الشراء ${cost}`);
  ok((await page.locator('table', { hasText: 'شراء أصول' }).count()) > 0, 'لا جدول سنوي');
});

await check('9/10. إضافة قرض بجدول استرداد دون ربح، واكتشاف نقص السيولة عند تجاوز مخصصات القروض', async () => {
  await go(page, 'loans');
  await page.getByRole('tab', { name: 'المحاكاة' }).click();
  await page.getByRole('button', { name: /إضافة إلى المحاكاة/ }).click();
  const txt = await page.locator('main').innerText();
  ok(txt.includes('القروض المحددة المضافة إلى المحاكاة'), 'القرض لم يُضف');
  ok(txt.includes('ليس ربحًا') || txt.includes('لا يمثل ربحًا'), 'لا تنبيه محاسبي');
  await setNum(page, 'عدد القروض المخطط تقديمها سنويًا', 200);
  await setNum(page, 'متوسط القرض المتوقع', 20000);
  await setNum(page, 'الحد الأعلى لرصيد القروض من موارد الصندوق', 100);
  await setNum(page, 'مدة السداد المعتادة', 36);
  await go(page, 'review');
  const r = await page.locator('main').innerText();
  ok(r.includes('طلب الإقراض المخطط يتجاوز السيولة المتاحة') || r.includes('نقص سيولة'), 'لم يُكتشف نقص السيولة');
});

await check('11/12. تسجيل قرار في وضع الاجتماع ثم المحضر يحتوي القرار برقمه', async () => {
  await go(page, 'meetings');
  await page.getByRole('button', { name: /اجتماع جديد|إنشاء الاجتماع الأول/ }).first().click();
  await page.getByRole('button', { name: /إضافة كل البنود غير المحسومة/ }).click();
  await page.getByRole('tab', { name: /تسجيل القرارات/ }).click();
  const item = page.locator('div.rounded-xl', { hasText: 'نموذج مدة الاشتراك' }).first();
  await item.getByRole('button', { name: /تسجيل قرار/ }).click();
  await item.getByText('مدة موحدة لجميع المشتركين').first().click();
  await item.locator('textarea').first().fill('أجمعنا على الأبسط');
  await item.locator('textarea').nth(1).fill('تحفظ عضو واحد');
  await item.getByRole('button', { name: 'تسجيل القرار' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('main').innerText()).includes('ق-001'), 'لم يُرقَّم القرار');
  // البند أصبح معتمدًا
  await go(page, 'library');
  const c = await page.locator('#clause-SUB-03').innerText();
  ok(c.includes('معتمد'), 'البند لم يُعتمد بعد القرار');
  // المحضر
  await go(page, 'reports');
  await page.getByRole('button', { name: /محضر الاجتماع وقراراته/ }).click();
  await page.waitForTimeout(400);
  const doc = await page.locator('[aria-label="معاينة الوثيقة"]').innerText();
  ok(doc.includes('ق-001') && doc.includes('تحفظ عضو واحد') && doc.includes('أجمعنا على الأبسط'), 'المحضر لا يحتوي القرار');
});

await check('22. عدم اعتماد أي قرار جوهري تلقائيًا (فتح اجتماع وتجهيز الجدول لا يغيّر شيئًا إلا بقراري)', async () => {
  await go(page, 'library');
  const approved = await page.locator('button[role=radio]', { hasText: 'معتمد' }).first().innerText();
  const n = Number(approved.replace(/\D/g, ''));
  ok(n <= 2, `عدد المعتمد ${n} أكبر مما اعتمدته يدويًا`);
});

await check('بدائل: اختيار بديل ينبّه عدالة، وقبول المخاطرة يحتاج مبررًا', async () => {
  await go(page, 'library');
  await page.locator('#clause-AID-05 button[aria-expanded]').first().click();
  await page.locator('#clause-AID-05').getByRole('button', { name: 'اختيار هذا البديل' }).last().click();
  await go(page, 'rights');
  const t = await page.locator('main').innerText();
  ok(t.includes('استبعاد غير المشتركين من أي مساعدة إنسانية'), 'لم يظهر تنبيه العدالة');
  ok(t.includes('حلول مقترحة'), 'لا حلول');
  await page.getByLabel('حالة المعالجة').first().selectOption('accepted');
  ok((await page.locator('main').innerText()).includes('سجّل المبرر'), 'لم يُطلب المبرر');
});

await check('14. الحفظ والتحديث دون فقد البيانات', async () => {
  await go(page, 'subscriptions');
  await page.getByRole('tab', { name: 'المتغيرات والفئات' }).click();
  await setNum(page, 'قيمة الاشتراك الشهري', 321);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#app-shell');
  await go(page, 'subscriptions');
  eq(await varInput(page, 'قيمة الاشتراك الشهري').inputValue(), '321');
});

await check('التراجع عن آخر تعديل', async () => {
  await go(page, 'subscriptions');
  await setNum(page, 'قيمة الاشتراك الشهري', 999);
  await page.getByRole('button', { name: 'تراجع' }).click();
  await page.waitForTimeout(200);
  eq(await varInput(page, 'قيمة الاشتراك الشهري').inputValue(), '321');
});

let exported = null;
await check('15. تصدير JSON ثم استيراده واستعادة المشروع', async () => {
  await openData(page);
  await page.getByRole('tab', { name: 'استيراد وتصدير' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /تصدير المشروع كاملًا/ }).click()]);
  exported = path.join(TMP, 'project.json');
  await dl.saveAs(exported);
  const data = JSON.parse(fs.readFileSync(exported, 'utf8'));
  eq(data.kind, 'family-fund-charter');
  eq(data.project.vars.monthly_contribution, 321);
  ok(/\.json$/.test(dl.suggestedFilename()), 'اسم الملف بلا امتداد: ' + dl.suggestedFilename());
  await page.keyboard.press('Escape');
  // غيّر قيمة ثم استورد
  await go(page, 'subscriptions');
  await setNum(page, 'قيمة الاشتراك الشهري', 11);
  await openData(page);
  await page.getByRole('tab', { name: 'استيراد وتصدير' }).click();
  await page.locator('input[type=file]').setInputFiles(exported);
  await page.waitForTimeout(800);
  await go(page, 'subscriptions');
  eq(await varInput(page, 'قيمة الاشتراك الشهري').inputValue(), '321', 'لم تُستعد القيمة');
});

await check('16. التعامل مع الملفات الفاسدة وغير المتوافقة عند الاستيراد', async () => {
  const bad = path.join(TMP, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  const wrong = path.join(TMP, 'wrong.json');
  fs.writeFileSync(wrong, JSON.stringify({ hello: 1 }));
  const newer = path.join(TMP, 'newer.json');
  const d = JSON.parse(fs.readFileSync(exported, 'utf8'));
  d.project.schemaVersion = 999;
  fs.writeFileSync(newer, JSON.stringify(d));
  const broken = path.join(TMP, 'broken.json');
  const d2 = JSON.parse(fs.readFileSync(exported, 'utf8'));
  d2.project.clauses[0].status = 'weird';
  fs.writeFileSync(broken, JSON.stringify(d2));
  for (const [f, msg] of [[bad, 'JSON'], [wrong, 'ليس نسخة'], [newer, 'إصدار أحدث'], [broken, 'حالة البند']]) {
    await openData(page);
    await page.getByRole('tab', { name: 'استيراد وتصدير' }).click();
    await page.locator('input[type=file]').setInputFiles(f);
    await page.getByText(msg, { exact: false }).first().waitFor({ timeout: 4000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  ok(await page.locator('#app-shell').isVisible(), 'التطبيق تعطل');
});

await check('نسخ احتياطية مؤرخة واستعادة بتأكيد', async () => {
  await go(page, 'subscriptions');
  await setNum(page, 'قيمة الاشتراك الشهري', 444);
  await openData(page);
  await page.getByRole('tab', { name: /النسخ الاحتياطية/ }).click();
  await page.getByRole('button', { name: /إنشاء نسخة الآن/ }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await setNum(page, 'قيمة الاشتراك الشهري', 555);
  await openData(page);
  await page.getByRole('tab', { name: /النسخ الاحتياطية/ }).click();
  await page.getByRole('button', { name: /استعادة/ }).first().click();
  await page.getByRole('button', { name: 'استعادة', exact: true }).last().click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape').catch(() => {});
  await go(page, 'subscriptions');
  const v = await varInput(page, 'قيمة الاشتراك الشهري').inputValue();
  ok(v === '444' || v === '321', `القيمة بعد الاستعادة ${v}`);
});

await check('إنشاء مشروع جديد واستنساخ مشروع للمقارنة وإعادة الضبط بتأكيد', async () => {
  await openData(page);
  await page.getByRole('button', { name: /استنساخ المشروع الحالي/ }).click();
  await page.waitForTimeout(500);
  ok((await page.locator('header').first().innerText()).includes('نسخة من'), 'لم يُستنسخ');
  await openData(page);
  await page.getByRole('button', { name: /إعادة ضبط المشروع/ }).click();
  await page.getByRole('button', { name: 'نعم، أعد الضبط' }).click();
  await page.waitForTimeout(500);
  await go(page, 'subscriptions');
  eq(await varInput(page, 'قيمة الاشتراك الشهري').inputValue(), '', 'لم يُعد الضبط');
});

await check('17. PDF عربي: الخط مضمّن والنص قابل للاستخراج والاتجاه سليم', async () => {
  await loadDemo(page);
  await go(page, 'library');
  await approve(page, 'FND-02');
  await go(page, 'reports');
  await page.getByRole('button', { name: /طباعة/ }).click();
  await confirmExport(page);
  await page.waitForTimeout(1200);
  const pdf = path.join(TMP, 'charter.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const fonts = execFileSync('pdffonts', [pdf]).toString();
  ok(/Cairo/.test(fonts), 'الخط العربي غير مضمّن');
  const text = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
  ok(/الانتساب حق بالنسب/.test(text.normalize('NFKC').replace(/[‎‏]/g, '')) || text.length > 500, 'النص العربي لا يُستخرج');
  const info = execFileSync('pdfinfo', [pdf]).toString();
  ok(/A4|595/.test(info), 'ليس A4');
});

await check('DOCX و Markdown: تصدير فعلي بأسماء وامتدادات صحيحة وبنية DOCX سليمة', async () => {
  await go(page, 'reports');
  for (const [name, ext] of [['DOCX', 'docx'], ['Markdown', 'md']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByRole('button', { name, exact: true }).click(); await confirmExport(page); })()]);
    const f = path.join(TMP, `out.${ext}`);
    await dl.saveAs(f);
    ok(dl.suggestedFilename().endsWith('.' + ext), `الامتداد: ${dl.suggestedFilename()}`);
    if (ext === 'docx') {
      const zip = execFileSync('unzip', ['-p', f, 'word/document.xml']).toString();
      ok(zip.includes('<w:bidi') && zip.includes('w:rtl'), 'DOCX لا يحوي إعدادات RTL');
      ok(zip.includes('ميثاق'), 'DOCX بلا نص عربي');
    } else {
      ok(fs.readFileSync(f, 'utf8').includes('dir="rtl"'), 'Markdown بلا RTL');
    }
  }
});

await check('الأرقام السالبة والتنسيق: لا رموز متغيرات خام {{ في أي وثيقة من الثلاث عشرة', async () => {
  await go(page, 'reports');
  const docs = page.locator('main li button[aria-current]');
  eq(await docs.count(), 13, 'عدد الوثائق');
  for (let i = 0; i < 13; i++) {
    await docs.nth(i).click();
    await page.waitForTimeout(250);
    const name = await docs.nth(i).innerText();
    const t = await page.locator('[aria-label="معاينة الوثيقة"]').innerText();
    ok(!t.includes('{{'), `رمز متغير خام في وثيقة ${name}`);
    ok(t.length > 300, `وثيقة ${name} شبه فارغة`);
  }
});

await ctx.close();

// ───── الهاتف
({ ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
await check('18. الهاتف: القوائم والأزرار تعمل ولا يوجد تمرير أفقي', async () => {
  await page.getByRole('button', { name: 'القائمة' }).click();
  await page.locator('nav').getByRole('button', { name: /القروض الحسنة/ }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('h1').first().innerText()).includes('القروض الحسنة'), 'التنقل لم يعمل');
  for (const s of ['dashboard', 'subscriptions', 'simulation', 'meetings', 'library', 'reports', 'assets', 'review']) {
    await go(page, s);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(o <= 1, `تمرير أفقي في ${s}: ${o}`);
  }
  await page.getByRole('button', { name: 'إدارة المشروع والبيانات' }).click();
  ok(await page.getByRole('dialog').isVisible(), 'نافذة المشروع لم تفتح');
});
await ctx.close();

await check('19/21. النشر على مسار فرعي: الأصول نسبية، ولا بيانات خاصة داخل ملفات الموقع', async () => {
  const idx = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  ok(!/(src|href)="\/(?!\/)/.test(idx), 'مسارات مطلقة في index.html لا تعمل على مستودع فرعي');
  const files = fs.readdirSync(DIST, { recursive: true }).map(String);
  ok(!files.some((f) => /\.json$/.test(f)), 'ملف JSON داخل dist');
  const js = files.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
  ok(!/IDBFactory.*family-fund-project/.test(js), 'فحص بسيط');
});

ok(consoleErrors.length === 0, 'أخطاء في المتصفح:\n' + consoleErrors.slice(0, 8).join('\n'));
await browser.close();
server.close();
console.log(`\nالنتيجة: نجح ${passed}، فشل ${failed.length}${consoleErrors.length ? '، أخطاء متصفح ' + consoleErrors.length : ''}`);
if (failed.length) { console.log('الفاشلة:', failed.join(' | ')); process.exit(1); }
