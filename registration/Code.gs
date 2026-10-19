/**
 * خدمة استقبال تسجيلات المشاركين — منصة بناء الميثاق
 * ====================================================
 * تُلصق هذه الشيفرة في Google Apps Script المرتبط بجدول Google Sheets تملكه أنت،
 * فتُحفظ كل التسجيلات في ذلك الجدول وحده (لا في المستودع ولا عند طرف ثالث).
 *
 * الإعداد (مرة واحدة):
 *  1. أنشئ جدول Google Sheets جديدًا، ثم من القائمة: الإضافات ← Apps Script.
 *  2. احذف الشيفرة الموجودة والصق هذا الملف كاملًا ثم احفظ.
 *  3. من «إعدادات المشروع» ← «خصائص النص البرمجي» أضف خاصية اسمها ADMIN_KEY
 *     وقيمتها كلمة سر طويلة (12 حرفًا فأكثر) تختارها أنت. هذه كلمة الإدارة؛ لا تشاركها.
 *  4. اضغط «نشر» ← «عملية نشر جديدة» ← النوع: تطبيق ويب.
 *     نفّذ باسم: أنا. من لديه حق الوصول: أي شخص. ثم انسخ «عنوان URL لتطبيق الويب».
 *  5. الصق العنوان وكلمة الإدارة في المنصة (قسم «تسجيل المشاركين والتزاماتهم»).
 *
 * تعديل هذه الشيفرة لاحقًا يتطلب «نشر ← إدارة عمليات النشر ← تعديل ← إصدار جديد» ليسري التعديل.
 *
 * الخصوصية: الاسم والجوال وغيرهما تُحفظ في جدولك فقط. القراءة الكاملة تتطلب ADMIN_KEY،
 * ولا يرى المشارك إلا تسجيله هو بواسطة رمز سري يُولَّد في متصفحه (يُحفظ هنا مشفّرًا بصمة SHA-256).
 */

var SHEET_NAME = 'التسجيلات';
var MAX_ROWS = 2000;

// [مفتاح الحقل، عنوان العمود في الجدول]
var COLS = [
  ['id', 'المعرّف'],
  ['tokenHash', 'بصمة الرمز السري'],
  ['createdAt', 'تاريخ الإنشاء'],
  ['updatedAt', 'آخر تحديث'],
  ['name', 'الاسم'],
  ['gender', 'الجنس'],
  ['branch', 'الفرع'],
  ['birthYear', 'سنة الميلاد'],
  ['city', 'المدينة'],
  ['phone', 'الجوال'],
  ['monthly', 'الاشتراك الشهري (ريال)'],
  ['years', 'مدة الالتزام (سنة)'],
  ['oneTime', 'مساهمة لمرة واحدة (ريال)'],
  ['volunteer', 'يرغب بالمشاركة في العمل'],
  ['notes', 'ملاحظات'],
  ['complete', 'مكتمل'],
];

// قواعد التحقق من حقول المشارك. أي مخالفة ترفض الطلب كله برمز invalid.
var FIELDS = {
  name: { kind: 'text', max: 80 },
  gender: { kind: 'enum', values: ['', 'male', 'female'] },
  branch: { kind: 'text', max: 60 },
  birthYear: { kind: 'num', min: 1900, max: 2100, integer: true },
  city: { kind: 'text', max: 60 },
  phone: { kind: 'text', max: 20, pattern: /^[0-9+\s-]*$/ },
  monthly: { kind: 'num', min: 0, max: 10000000 },
  years: { kind: 'num', min: 0, max: 100 },
  oneTime: { kind: 'num', min: 0, max: 1000000000 },
  volunteer: { kind: 'bool' },
  notes: { kind: 'text', max: 1000 },
  complete: { kind: 'bool' },
};

function invalid_() {
  return new Error('invalid');
}

function cleanField_(rule, v) {
  if (rule.kind === 'bool') {
    if (v === undefined || v === null) return false;
    if (typeof v !== 'boolean') throw invalid_();
    return v;
  }
  if (rule.kind === 'text') {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string') throw invalid_();
    var t = v.trim();
    if (t.length > rule.max) throw invalid_();
    if (rule.pattern && !rule.pattern.test(t)) throw invalid_();
    return t;
  }
  if (rule.kind === 'enum') {
    if (v === undefined || v === null) return '';
    if (rule.values.indexOf(v) < 0) throw invalid_();
    return v;
  }
  // num: القيمة الفارغة تعني «لم يُحدد»
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'number' || !isFinite(v) || v < rule.min || v > rule.max) throw invalid_();
  if (rule.integer && Math.floor(v) !== v) throw invalid_();
  return v;
}

function cleanData_(data) {
  if (!data || typeof data !== 'object') throw invalid_();
  var out = {};
  for (var key in FIELDS) out[key] = cleanField_(FIELDS[key], data[key]);
  return out;
}

function cleanConfig_(c) {
  if (!c || typeof c !== 'object') throw invalid_();
  var out = {
    title: cleanField_({ kind: 'text', max: 120 }, c.title),
    fundName: cleanField_({ kind: 'text', max: 120 }, c.fundName),
    intro: cleanField_({ kind: 'text', max: 1500 }, c.intro),
    allowOneTime: cleanField_({ kind: 'bool' }, c.allowOneTime),
    open: cleanField_({ kind: 'bool' }, c.open),
    amounts: [],
    years: [],
    branches: [],
  };
  if (!out.title) throw invalid_();
  var lists = [
    ['amounts', { kind: 'num', min: 1, max: 10000000 }, 12],
    ['years', { kind: 'num', min: 1, max: 100 }, 12],
    ['branches', { kind: 'text', max: 60 }, 40],
  ];
  for (var i = 0; i < lists.length; i++) {
    var name = lists[i][0];
    var rule = lists[i][1];
    var src = c[name];
    if (src === undefined || src === null) continue;
    if (!Array.isArray(src) || src.length > lists[i][2]) throw invalid_();
    for (var j = 0; j < src.length; j++) {
      var item = cleanField_(rule, src[j]);
      if (item === null || item === '') throw invalid_();
      out[name].push(item);
    }
  }
  return out;
}

function sha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) hex += ('0' + (bytes[i] < 0 ? bytes[i] + 256 : bytes[i]).toString(16)).slice(-2);
  return hex;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, COLS.length)
    .setValues([COLS.map(function (c) { return c[1]; })])
    .setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setRightToLeft(true);
  // نص عادي لكل الأعمدة: يمنع تفسير أي قيمة تبدأ بـ = أو + أو - على أنها معادلة
  sh.getRange('A:' + String.fromCharCode(64 + COLS.length)).setNumberFormat('@');
  return sh;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function rowToRecord_(row) {
  var rec = {};
  for (var i = 0; i < COLS.length; i++) rec[COLS[i][0]] = row[i];
  var out = { id: String(rec.id), createdAt: String(rec.createdAt), updatedAt: String(rec.updatedAt) };
  for (var key in FIELDS) {
    var rule = FIELDS[key];
    var raw = rec[key];
    if (rule.kind === 'bool') out[key] = String(raw) === 'true';
    else if (rule.kind === 'num') out[key] = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    else out[key] = String(raw === null || raw === undefined ? '' : raw);
  }
  return out;
}

function recordToRow_(rec, tokenHash) {
  var all = { id: rec.id, tokenHash: tokenHash, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
  for (var key in FIELDS) all[key] = rec[key];
  return COLS.map(function (c) {
    var v = all[c[0]];
    return v === null || v === undefined ? '' : String(v);
  });
}

function readConfig_() {
  var raw = PropertiesService.getScriptProperties().getProperty('CONFIG');
  return raw ? JSON.parse(raw) : null;
}

function requireAdmin_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected || expected.length < 12) throw new Error('admin_key_not_set');
  if (typeof key !== 'string' || key !== expected) throw new Error('unauthorized');
}

function requireIdentity_(id, token) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw invalid_();
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw invalid_();
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function ownRecord_(id, token) {
  requireIdentity_(id, token);
  var sh = sheet_();
  var row = findRow_(sh, id);
  if (!row) throw new Error('not_found');
  var values = sh.getRange(row, 1, 1, COLS.length).getValues()[0];
  if (String(values[1]) !== sha256_(token)) throw new Error('forbidden');
  return rowToRecord_(values);
}

function save_(b) {
  requireIdentity_(b.id, b.token);
  if (b.consent !== true) throw invalid_();
  var config = readConfig_();
  if (!config || config.open !== true) throw new Error('closed');
  var data = cleanData_(b.data);
  var now = new Date().toISOString();
  var sh = sheet_();
  var row = findRow_(sh, b.id);
  var hash = sha256_(b.token);
  if (row) {
    var current = sh.getRange(row, 1, 1, COLS.length).getValues()[0];
    if (String(current[1]) !== hash) throw new Error('forbidden');
    var rec = { id: b.id, createdAt: String(current[2]), updatedAt: now };
    for (var key in data) rec[key] = data[key];
    sh.getRange(row, 1, 1, COLS.length).setValues([recordToRow_(rec, hash)]);
  } else {
    if (sh.getLastRow() - 1 >= MAX_ROWS) throw new Error('full');
    var fresh = { id: b.id, createdAt: now, updatedAt: now };
    for (var k in data) fresh[k] = data[k];
    sh.appendRow(recordToRow_(fresh, hash));
  }
  return { ok: true, updatedAt: now };
}

function removeRow_(id) {
  var sh = sheet_();
  var row = findRow_(sh, id);
  if (!row) throw new Error('not_found');
  sh.deleteRow(row);
  return { ok: true };
}

function allRecords_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh
    .getRange(2, 1, last - 1, COLS.length)
    .getValues()
    .map(rowToRecord_);
}

// القراءة العامة الوحيدة هي الإعدادات. كل ما يحمل سرًا (رمز المشارك أو كلمة الإدارة) يُرسل بـ POST
// حتى لا يظهر في عنوان الطلب.
function handleGet_(p) {
  if (p.action === 'config') return { ok: true, config: readConfig_() };
  throw new Error('unknown_action');
}

function handlePost_(b) {
  switch (b.action) {
    case 'get':
      return { ok: true, record: ownRecord_(b.id, b.token) };
    case 'list':
      requireAdmin_(b.key);
      return { ok: true, config: readConfig_(), records: allRecords_() };
    case 'save':
      return withLock_(function () {
        return save_(b);
      });
    case 'removeOwn':
      return withLock_(function () {
        ownRecord_(b.id, b.token);
        return removeRow_(b.id);
      });
    case 'setConfig':
      requireAdmin_(b.key);
      return withLock_(function () {
        PropertiesService.getScriptProperties().setProperty('CONFIG', JSON.stringify(cleanConfig_(b.config)));
        return { ok: true };
      });
    case 'remove':
      requireAdmin_(b.key);
      return withLock_(function () {
        if (typeof b.id !== 'string' || !b.id) throw invalid_();
        return removeRow_(b.id);
      });
    default:
      throw new Error('unknown_action');
  }
}

function respond_(fn) {
  var out;
  try {
    out = fn();
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return respond_(function () {
    return handleGet_((e && e.parameter) || {});
  });
}

function doPost(e) {
  return respond_(function () {
    var body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (err) {
      throw invalid_();
    }
    if (!body || typeof body !== 'object') throw invalid_();
    return handlePost_(body);
  });
}
