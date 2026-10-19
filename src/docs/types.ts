import type { Signatory } from '../types';

export type Block =
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'clause'; n: number; id: string; title: string; text: string; status: 'approved' | 'proposed' }
  | { t: 'note'; text: string; kind: 'info' | 'warn' }
  | { t: 'pagebreak' };

export interface Doc {
  id: string;
  title: string;
  subtitle: string;
  version: string;
  issueDate: string;
  reviewDate: string;
  footer: string;
  /** فهرس المحتويات: عناوين المستوى الثاني */
  toc: string[];
  blocks: Block[];
  signatures: Signatory[] | null;
  /** عناصر لم تُستكمل ويظهر لها تنبيه في الوثيقة */
  missing: string[];
}

export interface DocOptions {
  meetingId: string | null;
}
