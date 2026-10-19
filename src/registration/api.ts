import { endpointOf } from './link';

// عميل خدمة التسجيل (Google Apps Script). لا يُرسل شيء إلا إلى script.google.com،
// والطلبات من نوع text/plain فلا تحتاج طلب تمهيد (preflight).

export type Gender = '' | 'male' | 'female';

export interface RegConfig {
  title: string;
  fundName: string;
  intro: string;
  amounts: number[];
  years: number[];
  branches: string[];
  allowOneTime: boolean;
  open: boolean;
}

export interface RegData {
  name: string;
  gender: Gender;
  branch: string;
  birthYear: number | null;
  city: string;
  phone: string;
  monthly: number | null;
  years: number | null;
  oneTime: number | null;
  volunteer: boolean;
  notes: string;
  complete: boolean;
}

export interface RegRecord extends RegData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const ERRORS: Record<string, string> = {
  invalid: 'بيانات غير صالحة. راجع الحقول وحاول مرة أخرى.',
  forbidden: 'هذا التسجيل يخص متصفحًا آخر. افتح رابطك الشخصي الذي نسخته سابقًا.',
  not_found: 'التسجيل غير موجود.',
  closed: 'التسجيل مغلق حاليًا.',
  full: 'اكتمل العدد الأقصى للتسجيلات.',
  unauthorized: 'كلمة الإدارة غير صحيحة.',
  admin_key_not_set: 'لم تُضبط الخاصية ADMIN_KEY في إعدادات Apps Script (بطول 12 حرفًا فأكثر).',
  unknown_action: 'الشيفرة المنشورة في Apps Script قديمة أو غير مطابقة. الصق الإصدار الحالي وانشر إصدارًا جديدًا.',
};

/** خطأ من الخدمة برمز قابل للفحص (مثل not_found) ورسالة عربية للعرض */
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface Reply {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

const call = async (deploymentId: string, req: { query?: Record<string, string>; body?: Record<string, unknown> }): Promise<Reply> => {
  const url = new URL(endpointOf(deploymentId));
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, req.body ? { method: 'POST', body: JSON.stringify(req.body) } : {});
  } catch {
    throw new Error('تعذر الوصول إلى خدمة التسجيل. تحقق من اتصال الإنترنت ومن صحة الرابط.');
  }
  if (!res.ok) throw new Error(`ردّت خدمة التسجيل بخطأ (${res.status}).`);
  let reply: Reply;
  try {
    reply = (await res.json()) as Reply;
  } catch {
    throw new Error('ردّت الخدمة بما لا يُفهم. تأكد أن النشر بصلاحية «أي شخص» وأن الرابط ينتهي بـ /exec.');
  }
  if (!reply.ok) {
    const code = reply.error ?? 'unknown';
    throw new ApiError(code, ERRORS[code] ?? `خطأ من الخدمة: ${code}`);
  }
  return reply;
};

export const fetchConfig = async (id: string): Promise<RegConfig | null> => ((await call(id, { query: { action: 'config' } })).config as RegConfig | null) ?? null;

export const fetchOwn = async (id: string, own: { id: string; token: string }): Promise<RegRecord> =>
  (await call(id, { body: { action: 'get', id: own.id, token: own.token } })).record as RegRecord;

export const saveOwn = async (id: string, own: { id: string; token: string }, data: RegData): Promise<string> =>
  (await call(id, { body: { action: 'save', id: own.id, token: own.token, consent: true, data } })).updatedAt as string;

export const removeOwn = async (id: string, own: { id: string; token: string }): Promise<void> => {
  await call(id, { body: { action: 'removeOwn', id: own.id, token: own.token } });
};

export const publishConfig = async (id: string, key: string, config: RegConfig): Promise<void> => {
  await call(id, { body: { action: 'setConfig', key, config } });
};

export const listAll = async (id: string, key: string): Promise<{ config: RegConfig | null; records: RegRecord[] }> => {
  const r = await call(id, { body: { action: 'list', key } });
  return { config: (r.config as RegConfig | null) ?? null, records: r.records as RegRecord[] };
};

export const removeRecord = async (id: string, key: string, recordId: string): Promise<void> => {
  await call(id, { body: { action: 'remove', key, id: recordId } });
};
