// يشغّل registration/Code.gs الحقيقية داخل Node بمحاكاة بسيطة لخدمات Google (الجدول والأقفال والخصائص)،
// لاختبار منطق الخدمة نفسه في اختبارات الوحدات وفي اختبارات القبول. لا يحاكي حدود Google ولا شبكتها.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CODE = fs.readFileSync(fileURLToPath(new URL('./Code.gs', import.meta.url)), 'utf8');

const colNumber = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

export const createBackend = ({ adminKey = 'test-admin-key-123' } = {}) => {
  const props = new Map();
  if (adminKey) props.set('ADMIN_KEY', adminKey);
  const sheets = new Map();
  const stats = { locks: 0, unlocks: 0, formulaCells: 0 };

  const makeSheet = () => {
    const sh = { rows: [], textColumns: new Set(), frozen: 0, rtl: false };
    const checkFormulas = (row) =>
      row.forEach((v, i) => {
        if (typeof v === 'string' && v.startsWith('=') && !sh.textColumns.has(i + 1)) stats.formulaCells += 1;
      });
    const range = (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.rows[r - 1 + i]?.[c - 1 + j] ?? '')),
      setValues(vals) {
        vals.forEach((row, i) => {
          const target = (sh.rows[r - 1 + i] ??= []);
          row.forEach((v, j) => (target[c - 1 + j] = v));
          checkFormulas(target);
        });
        return this;
      },
      setFontWeight() {
        return this;
      },
      setNumberFormat(fmt) {
        if (fmt === '@') for (let k = c; k < c + nc; k++) sh.textColumns.add(k);
        return this;
      },
    });
    return Object.assign(sh, {
      getRange(a, b, c, d) {
        if (typeof a === 'string') {
          const m = /^([A-Z]+):([A-Z]+)$/.exec(a);
          if (!m) throw new Error(`نطاق غير مدعوم في المحاكاة: ${a}`);
          const from = colNumber(m[1]);
          return range(1, from, 1, colNumber(m[2]) - from + 1);
        }
        if (a < 1 || b < 1) throw new Error('إحداثيات نطاق غير صالحة');
        return range(a, b, c, d);
      },
      getLastRow: () => sh.rows.length,
      appendRow(row) {
        sh.rows.push([...row]);
        checkFormulas(row);
      },
      deleteRow: (r) => void sh.rows.splice(r - 1, 1),
      setFrozenRows: (n) => void (sh.frozen = n),
      setRightToLeft: (v) => void (sh.rtl = v),
    });
  };

  const sandbox = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets.get(name) ?? null,
        insertSheet: (name) => {
          const sh = makeSheet();
          sheets.set(name, sh);
          return sh;
        },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; }, getContent() { return this.text; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => void (stats.locks += 1), releaseLock: () => void (stats.unlocks += 1) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => void props.set(k, v) }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      // كما في Google: مصفوفة بايتات موقّعة
      computeDigest: (_alg, text) => [...crypto.createHash('sha256').update(text, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);

  const parse = (out) => JSON.parse(out.getContent());
  return {
    get: (params) => parse(sandbox.doGet({ parameter: params })),
    post: (body) => parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } })),
    rawPost: (text) => parse(sandbox.doPost({ postData: { contents: text } })),
    stats,
    rows: () => (sheets.get('التسجيلات')?.rows ?? []).map((r) => [...r]),
    sheet: () => sheets.get('التسجيلات') ?? null,
    props,
  };
};
