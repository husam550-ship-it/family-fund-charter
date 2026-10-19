import { useRef, useState } from 'react';
import { Copy, Download, FilePlus2, FlaskConical, History, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import { attempt, confirmAction } from '../lib/ui';
import { buildContext, resolveText } from '../engine/context';
import { dateLabel } from '../lib/format';
import { Callout, Modal, Tabs } from './ui';
import { Field, TextInput, VarField } from './fields';
import { MAX_BACKUPS } from '../lib/storage';

type Tab = 'project' | 'backups' | 'io' | 'demo';

export const ProjectDialog = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<Tab>('project');
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const resolvedName = resolveText(s.project.name, buildContext(s.project));

  const onFile = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    const text = await f.text();
    const ok = await attempt(() => s.importProject(text), 'تم استيراد المشروع كمشروع جديد.');
    if (ok) onClose();
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal title="إدارة المشروع والبيانات" onClose={onClose} wide>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'project', label: 'المشروع' },
          { id: 'backups', label: 'النسخ الاحتياطية', badge: s.backups.length },
          { id: 'io', label: 'استيراد وتصدير' },
          { id: 'demo', label: 'بيانات توضيحية' },
        ]}
      />

      {tab === 'project' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم المشروع" hint="يمكن أن يحتوي {{family_name}} و{{fund_name}} فيتغير مع تغيير الاسم.">
              <TextInput value={s.project.name} onChange={(v) => s.update((d) => void (d.name = v), 'pname')} />
            </Field>
            <div className="rounded-lg bg-brand-50 p-3 text-sm">
              <span className="text-xs font-bold text-mute">الاسم كما يظهر:</span>
              <div className="font-bold text-brand-900">{resolvedName}</div>
            </div>
            <VarField k="family_name" />
            <VarField k="fund_name" />
          </div>

          <div>
            <h3 className="mb-2 text-base">المشاريع المحفوظة في هذا المتصفح</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {s.projects.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="font-semibold">{m.id === s.project.id ? resolvedName : m.name}</div>
                    <div className="text-xs text-mute">آخر تعديل: {dateLabel(m.updatedAt)}</div>
                  </div>
                  <div className="flex gap-2">
                    {m.id === s.project.id ? (
                      <span className="badge bg-ok-soft text-ok">المشروع الحالي</span>
                    ) : (
                      <button className="btn btn-soft btn-sm" onClick={() => void attempt(() => s.switchProject(m.id), 'تم التبديل.').then(onClose)}>
                        فتح
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm text-bad"
                      disabled={s.projects.length <= 1}
                      onClick={async () => {
                        if (await confirmAction({ title: 'حذف المشروع', message: 'سيُحذف المشروع ونسخه الاحتياطية من هذا المتصفح نهائيًا. صدّر نسخة JSON أولًا إن أردت الاحتفاظ به.', confirmLabel: 'حذف المشروع', danger: true })) {
                          await attempt(() => s.deleteProject(m.id), 'تم الحذف.');
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={async () => {
                await attempt(() => s.newProject(), 'أُنشئ مشروع جديد.');
                onClose();
              }}
            >
              <FilePlus2 className="size-4" /> مشروع جديد
            </button>
            <button
              className="btn btn-soft"
              onClick={async () => {
                await attempt(() => s.cloneProject(), 'أُنشئت نسخة للمقارنة.');
                onClose();
              }}
            >
              <Copy className="size-4" /> استنساخ المشروع الحالي للمقارنة
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const ok = await confirmAction({
                  title: 'إعادة ضبط المشروع',
                  message: 'ستُمسح كل مدخلاتك وقراراتك في هذا المشروع وتعود إلى الحالة الأولى. تُحفظ نسخة احتياطية تلقائيًا قبل الضبط ويمكنك التراجع.',
                  confirmLabel: 'نعم، أعد الضبط',
                  danger: true,
                });
                if (ok) {
                  await attempt(() => s.resetProject(), 'أُعيد ضبط المشروع.');
                  onClose();
                }
              }}
            >
              <RotateCcw className="size-4" /> إعادة ضبط المشروع
            </button>
          </div>
        </div>
      )}

      {tab === 'backups' && (
        <div className="space-y-4">
          <Callout tone="info">
            النسخ الاحتياطية محلية في هذا المتصفح فقط (حتى {MAX_BACKUPS} نسخة). تُنشأ نسخة تلقائية كل ساعة عند التعديل، وقبل إعادة الضبط والاستعادة. للنقل إلى جهاز آخر صدّر ملف JSON.
          </Callout>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="تسمية النسخة (اختياري)" className="min-w-52 flex-1">
              <TextInput value={label} onChange={setLabel} placeholder="مثال: بعد اجتماع الأحد" />
            </Field>
            <button
              className="btn btn-primary"
              onClick={() => {
                void attempt(() => s.createBackup(label), 'تم إنشاء نسخة احتياطية.');
                setLabel('');
              }}
            >
              <Save className="size-4" /> إنشاء نسخة الآن
            </button>
          </div>
          {s.backups.length === 0 && <p className="text-sm text-mute">لا توجد نسخ بعد.</p>}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {s.backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-semibold">{b.label}</div>
                  <div className="text-xs text-mute">{new Date(b.at).toLocaleString('ar-SA-u-nu-latn')}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={async () => {
                      const ok = await confirmAction({ title: 'استعادة نسخة', message: 'سيُستبدل المشروع الحالي بمحتوى هذه النسخة. تُحفظ نسخة من وضعك الحالي أولًا ويمكنك التراجع.', confirmLabel: 'استعادة' });
                      if (ok) await attempt(() => s.restoreBackup(b.id), 'تمت الاستعادة.');
                    }}
                  >
                    <History className="size-4" /> استعادة
                  </button>
                  <button className="btn btn-ghost btn-sm text-bad" aria-label="حذف النسخة" onClick={() => void s.removeBackup(b.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'io' && (
        <div className="space-y-4">
          <Callout tone="warn" title="خصوصية البيانات">
            هذا الموقع ثابت وعام، لكن بيانات عملك (الأسماء والأرقام والقرارات) تُحفظ على جهازك فقط ولا تُرفع إلى أي مكان. للعمل من جهاز آخر: صدّر ملف JSON من هنا ثم استورده هناك، واحرص على عدم رفع الملف إلى مستودع عام.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => s.exportProject()}>
              <Download className="size-4" /> تصدير المشروع كاملًا (JSON)
            </button>
            <button className="btn btn-soft" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> استيراد ملف JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <p className="hint">يُستورد الملف دائمًا كمشروع جديد فلا يُكتب فوق مشروع قائم. تُرفض الملفات التالفة أو من إصدار أحدث برسالة توضح السبب.</p>
        </div>
      )}

      {tab === 'demo' && (
        <div className="space-y-4">
          <Callout tone="gold" title="بيانات توضيحية غير حقيقية">
            تملأ المتغيرات المالية وفئتين من المشتركين وأصلين عقاريين بقيم توضيحية لتجربة المحاكاة والرسوم. ليست أعدادًا ولا أموالًا ولا عقارات فعلية، ولا تغيّر حالة أي بند. يمكنك مسحها بضغطة واحدة.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-gold"
              onClick={() => {
                s.loadDemo();
                onClose();
              }}
            >
              <FlaskConical className="size-4" /> تحميل بيانات توضيحية
            </button>
            <button
              className="btn btn-soft"
              disabled={!s.project.demo}
              onClick={() => {
                s.removeDemo();
                onClose();
              }}
            >
              <Trash2 className="size-4" /> مسح البيانات التوضيحية
            </button>
          </div>
          {s.project.demo && <p className="text-sm font-semibold text-warn">المشروع الحالي يحوي بيانات توضيحية.</p>}
        </div>
      )}
    </Modal>
  );
};
