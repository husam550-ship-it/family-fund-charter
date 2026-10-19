import type { Project } from '../types';

// رابط خدمة التسجيل (Google Apps Script) ورابط المشارك المبني منه.
// يُشارَك معرّف النشر وحده في الرابط؛ فلا تظهر فيه أي بيانات ولا أي مفتاح إدارة.

const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]{20,})\/exec$/;
const ID_RE = /^[A-Za-z0-9_-]{20,}$/;

export const endpointOf = (deploymentId: string): string => {
  if (!ID_RE.test(deploymentId)) throw new Error('معرّف خدمة التسجيل غير صالح.');
  return `https://script.google.com/macros/s/${deploymentId}/exec`;
};

export const isEndpoint = (url: string): boolean => ENDPOINT_RE.test(url.trim());

export const deploymentIdOf = (url: string): string => {
  const m = ENDPOINT_RE.exec(url.trim());
  if (!m) throw new Error('رابط الخدمة غير صحيح. يجب أن يكون رابط «تطبيق الويب» من Apps Script وينتهي بـ /exec.');
  return m[1];
};

export const joinLinkOf = (deploymentId: string): string => `${window.location.href.split('#')[0]}#/join/${deploymentId}`;

/** رابط التسجيل للمشروع الحالي، أو null إن لم يُضبط رابط الخدمة */
export const projectJoinLink = (p: Project): string | null =>
  isEndpoint(p.registration.endpoint) ? joinLinkOf(deploymentIdOf(p.registration.endpoint)) : null;
