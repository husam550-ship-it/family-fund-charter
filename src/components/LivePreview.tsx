import { useMemo, useState } from 'react';
import { buildDoc } from '../docs/build';
import { DocView } from '../docs/DocView';
import { useStore } from '../lib/store';
import { Modal } from './ui';
import { Check } from './fields';

/** معاينة الميثاق النهائي لحظيًا؛ تتحدث مع كل تعديل في البنود والمتغيرات */
export default function LivePreview({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const [proposed, setProposed] = useState(project.docSettings.includeProposed);
  const doc = useMemo(() => buildDoc({ ...project, docSettings: { ...project.docSettings, includeProposed: proposed } }, 'charter'), [project, proposed]);
  return (
    <Modal title="معاينة الميثاق النهائي (لحظية)" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Check checked={proposed} onChange={setProposed} label="عرض البنود المقترحة (مميزة عن المعتمدة)" />
        <span className="text-xs text-mute">{doc.missing.length > 0 ? `عناصر تحتاج استكمالًا: ${doc.missing.length}` : 'لا عناصر ناقصة'}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-brand-50/60 p-2 sm:p-4">
        <DocView doc={doc} />
      </div>
    </Modal>
  );
}
