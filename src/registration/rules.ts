import type { RegData } from './api';

// متى تُعد بيانات المشارك والتزامه مكتملة. القاعدة نفسها تُحسب في المتصفح وتُرسل علامةً مع التسجيل.

export const isBasicComplete = (d: RegData): boolean => d.name.trim().split(/\s+/).filter(Boolean).length >= 2 && d.gender !== '';

export const isCommitmentComplete = (d: RegData): boolean =>
  isBasicComplete(d) && d.monthly !== null && (d.monthly === 0 || (d.years != null && d.years > 0));
