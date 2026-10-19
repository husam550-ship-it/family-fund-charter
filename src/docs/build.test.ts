import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createDefaultProject } from '../data/defaults';
import { applyDemo } from '../data/demo';
import { fillAgenda, newMeeting } from '../lib/actions';
import { buildDoc } from './build';
import { DOC_DEFS } from '../data/defaults';
import { toMarkdown } from './markdown';
import type { Block } from './types';

const texts = (b: Block): string[] => {
  switch (b.t) {
    case 'h':
    case 'p':
    case 'note':
      return [b.text];
    case 'ul':
    case 'ol':
      return b.items;
    case 'table':
      return [...b.head, ...b.rows.flat()];
    case 'clause':
      return [b.title, b.text];
    case 'pagebreak':
      return [];
  }
};

describe('توليد الوثائق', () => {
  const withMeeting = produce(createDefaultProject(), (d) => {
    fillAgenda(d, newMeeting(d));
  });
  const demo = produce(withMeeting, (d) => void Object.assign(d, applyDemo(d)));

  for (const [name, project] of [['مشروع افتراضي باجتماع', withMeeting], ['بيانات توضيحية', demo]] as const) {
    it(`لا رمز متغير خام في أي من الوثائق الثلاث عشرة — ${name}`, () => {
      expect(DOC_DEFS).toHaveLength(13);
      for (const def of DOC_DEFS) {
        const doc = buildDoc(project, def.id, { meetingId: project.meetings[0].id });
        const all = doc.blocks.flatMap(texts).concat(doc.title, doc.subtitle, doc.footer);
        expect(all.filter((t) => t.includes('{{')), def.id).toEqual([]);
        expect(toMarkdown(doc).includes('{{'), def.id).toBe(false);
      }
    });
  }
});
