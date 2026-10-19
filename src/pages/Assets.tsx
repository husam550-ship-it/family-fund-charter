import { useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Asset, AssetStatus, AssetType } from '../types';
import { useStore } from '../lib/store';
import { useDerived } from '../lib/derived';
import { assetNetAnnual } from '../engine/simulate';
import { compactMoney, money, uid } from '../lib/format';
import { Badge, Callout, Card, EmptyState, Modal, SectionHead, Stat } from '../components/ui';
import { Field, NumInput, SelectInput, TextArea, TextInput } from '../components/fields';
import { confirmAction } from '../lib/ui';

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'land', label: 'أرض' },
  { value: 'residential', label: 'عمارة سكنية' },
  { value: 'commercial', label: 'محلات تجارية' },
  { value: 'units', label: 'وحدات عقارية مؤجرة' },
  { value: 'warehouse', label: 'مستودعات' },
  { value: 'portfolio', label: 'محفظة استثمارية' },
  { value: 'other', label: 'أصل آخر' },
];
export const ASSET_STATUS: { value: AssetStatus; label: string; tone: 'plain' | 'info' | 'warn' | 'ok' | 'gold' }[] = [
  { value: 'idea', label: 'فكرة', tone: 'plain' },
  { value: 'targeted', label: 'مستهدف', tone: 'info' },
  { value: 'buying', label: 'قيد الشراء', tone: 'warn' },
  { value: 'owned', label: 'مملوك', tone: 'ok' },
  { value: 'waqf_documented', label: 'وقف موثق', tone: 'gold' },
];

export const newAsset = (): Asset => ({
  id: uid('asset'),
  name: 'أصل جديد',
  type: 'residential',
  status: 'idea',
  location: '',
  area: null,
  units: null,
  targetCost: null,
  estimatedValue: null,
  fundingAvailable: null,
  targetYear: null,
  fundingSource: '',
  annualGrossIncome: null,
  occupancy: null,
  annualMaintenance: null,
  annualOpex: null,
  growthRate: null,
  reservePct: null,
  ownership: 'none',
  deedNumber: '',
  waqfDoc: 'none',
  waqfConditions: '',
  nazir: '',
  distribution: '',
  holding: 'fund',
  notes: '',
});

export default function Assets() {
  const { project: p, sims } = useDerived();
  const update = useStore((s) => s.update);
  const [editId, setEditId] = useState<string | null>(null);
  const base = sims.base;
  const sc = p.scenarios.base;
  const totals = p.assets.reduce(
    (t, a) => ({
      cost: t.cost + (a.targetCost ?? 0),
      value: t.value + (a.estimatedValue ?? a.targetCost ?? 0),
      funding: t.funding + (a.fundingAvailable ?? 0),
      net: t.net + assetNetAnnual(a, sc.portfolioReturn),
    }),
    { cost: 0, value: 0, funding: 0, net: 0 },
  );
  const purchase = (id: string, sid: 'conservative' | 'base' | 'optimistic'): string => {
    const a = p.assets.find((x) => x.id === id);
    if (a && (a.status === 'owned' || a.status === 'waqf_documented')) return 'مملوك';
    return sims[sid].purchases.find((x) => x.assetId === id)?.label ?? 'لا يتحقق';
  };

  return (
    <div className="space-y-6">
      <SectionHead
        num="11 / سجل الأصول العقارية"
        title="سجل الأصول العقارية"
        sub="لكل أصل سجل مستقل. تغيير أي رقم هنا يحدّث خطة التمويل وسنة الشراء المحتملة وتوقعات الاستدامة فورًا."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              const a = newAsset();
              update((d) => void d.assets.push(a));
              setEditId(a.id);
            }}
          >
            <Plus className="size-4" /> إضافة أصل
          </button>
        }
      />
      <Callout tone="warn">
        لا يعني إدخال عقار في هذه القائمة أنه أصبح وقفًا مسجلًا رسميًا. حالة «وقف موثق» تتطلب وثيقة وقف موثقة وتسجيلًا لدى الجهة المختصة، وتُراجع المنصة اتساق الحالة مع الوثائق. القيم تقديرية وشراء الأصول غير مضمون.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="عدد الأصول" value={p.assets.length} />
        <Stat label="إجمالي التكلفة المستهدفة" value={compactMoney(totals.cost)} sub={`القيمة التقديرية ${compactMoney(totals.value)}`} />
        <Stat label="التمويل المتوفر" value={compactMoney(totals.funding)} sub={`المتبقي ${compactMoney(Math.max(0, totals.cost - totals.funding))}`} />
        <Stat label="صافي الإيراد السنوي المتوقع" value={compactMoney(totals.net)} sub="بالأسعار الحالية، ليس مضمونًا" />
      </div>

      {p.assets.length === 0 ? (
        <EmptyState>لا توجد أصول مسجلة بعد. أضف أول أصل مستهدف لتظهر خطة التمويل.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="p-2 text-start">الأصل</th>
                <th className="p-2 text-start">الحالة</th>
                <th className="p-2 text-start">التكلفة المستهدفة</th>
                <th className="p-2 text-start">التمويل المتوفر</th>
                <th className="p-2 text-start">المتبقي</th>
                <th className="p-2 text-start">صافي الإيراد السنوي</th>
                <th className="p-2 text-start">سنة الشراء المستهدفة</th>
                <th className="p-2 text-start">الشراء المحتمل (متحفظ / أساسي / متفائل)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.assets.map((a) => {
                const st = ASSET_STATUS.find((x) => x.value === a.status)!;
                const net = assetNetAnnual(a, sc.portfolioReturn);
                return (
                  <tr key={a.id} className="border-t border-line align-top">
                    <td className="p-2">
                      <b>{a.name}</b>
                      <div className="text-xs text-mute">{ASSET_TYPES.find((t) => t.value === a.type)?.label}</div>
                    </td>
                    <td className="p-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="p-2">{a.targetCost != null ? money(a.targetCost) : '—'}</td>
                    <td className="p-2">{a.fundingAvailable != null ? money(a.fundingAvailable) : '—'}</td>
                    <td className="p-2">{a.targetCost != null ? money(Math.max(0, a.targetCost - (a.fundingAvailable ?? 0))) : '—'}</td>
                    <td className={net < 0 ? 'p-2 text-bad' : 'p-2'}>{money(net)}</td>
                    <td className="p-2">{a.targetYear ?? '—'}</td>
                    <td className="p-2 text-xs">
                      {purchase(a.id, 'conservative')} — <b>{purchase(a.id, 'base')}</b> — {purchase(a.id, 'optimistic')}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button className="btn btn-soft btn-sm" onClick={() => setEditId(a.id)} aria-label={`تحرير ${a.name}`}>
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          aria-label="تكرار"
                          onClick={() => update((d) => void d.assets.push({ ...(JSON.parse(JSON.stringify(a)) as Asset), id: uid('asset'), name: `${a.name} (نسخة)` }))}
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm text-bad"
                          aria-label="حذف"
                          onClick={async () => {
                            if (await confirmAction({ title: 'حذف الأصل', message: `سيُحذف سجل «${a.name}».`, confirmLabel: 'حذف', danger: true })) update((d) => void (d.assets = d.assets.filter((x) => x.id !== a.id)));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint mt-2 px-2">
            ترتيب الأصول في الجدول هو ترتيب الشراء في المحاكاة. السنة المحتملة تُحسب من التدفقات المتوقعة والاحتياطي الأدنى. الأصول التي لا تتحقق ضمن أفق {base.horizonYears} سنة تظهر «لا يتحقق».
          </p>
        </Card>
      )}

      {editId && <AssetEditor id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

const AssetEditor = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const a = useStore((s) => s.project.assets.find((x) => x.id === id));
  const update = useStore((s) => s.update);
  const { project: p } = useDerived();
  if (!a) return null;
  const set = (fn: (d: Asset) => void, k: string): void =>
    update((d) => {
      const t = d.assets.find((x) => x.id === id);
      if (t) fn(t);
    }, `as:${id}:${k}`);
  const net = assetNetAnnual(a, p.scenarios.base.portfolioReturn);
  const remaining = a.targetCost != null ? Math.max(0, a.targetCost - (a.fundingAvailable ?? 0)) : null;
  const isPortfolio = a.type === 'portfolio';

  return (
    <Modal title={a.name} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الاسم">
            <TextInput value={a.name} onChange={(v) => set((d) => void (d.name = v), 'n')} />
          </Field>
          <Field label="النوع">
            <SelectInput value={a.type} options={ASSET_TYPES} onChange={(v) => set((d) => void (d.type = v as AssetType), 't')} />
          </Field>
          <Field label="حالة الأصل" hint="فكرة ← مستهدف ← قيد الشراء ← مملوك ← وقف موثق">
            <SelectInput value={a.status} options={ASSET_STATUS} onChange={(v) => set((d) => void (d.status = v as AssetStatus), 's')} />
          </Field>
          <Field label="الموقع">
            <TextInput value={a.location} onChange={(v) => set((d) => void (d.location = v), 'l')} />
          </Field>
          <Field label="المساحة (م²)">
            <NumInput value={a.area} min={0} onChange={(v) => set((d) => void (d.area = v), 'a')} />
          </Field>
          <Field label="عدد الوحدات">
            <NumInput value={a.units} min={0} onChange={(v) => set((d) => void (d.units = v), 'u')} />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-base font-bold text-brand-900">التكلفة والتمويل</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="التكلفة المستهدفة (ريال، بالأسعار الحالية)">
              <NumInput value={a.targetCost} min={0} onChange={(v) => set((d) => void (d.targetCost = v), 'tc')} />
            </Field>
            <Field label="القيمة التقديرية">
              <NumInput value={a.estimatedValue} min={0} onChange={(v) => set((d) => void (d.estimatedValue = v), 'ev')} />
            </Field>
            <Field label="قيمة التمويل المتوفرة" hint="تمويل مخصص لهذا الأصل من خارج تدفقات الاشتراكات.">
              <NumInput value={a.fundingAvailable} min={0} onChange={(v) => set((d) => void (d.fundingAvailable = v), 'fa')} />
            </Field>
            <div>
              <span className="label">مبلغ التمويل المتبقي (محسوب)</span>
              <div className="input flex items-center bg-ivory">{remaining != null ? money(remaining) : '—'}</div>
            </div>
            <Field label="سنة الاستحواذ المستهدفة">
              <NumInput value={a.targetYear} min={2000} max={2200} onChange={(v) => set((d) => void (d.targetYear = v), 'ty')} />
            </Field>
            <Field label="مصدر التمويل">
              <TextInput value={a.fundingSource} onChange={(v) => set((d) => void (d.fundingSource = v), 'fs')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-base font-bold text-brand-900">الإيراد والتشغيل</legend>
          {isPortfolio && <Callout tone="info">المحفظة الاستثمارية: يُحتسب عائدها من معدل العائد المفترض في السيناريو على قيمتها، لا من الإيجار.</Callout>}
          <div className="grid gap-3 sm:grid-cols-3">
            {!isPortfolio && (
              <>
                <Field label="الإيراد السنوي الإجمالي (ريال)">
                  <NumInput value={a.annualGrossIncome} min={0} onChange={(v) => set((d) => void (d.annualGrossIncome = v), 'gi')} />
                </Field>
                <Field label="نسبة الإشغال %">
                  <NumInput value={a.occupancy} min={0} max={100} onChange={(v) => set((d) => void (d.occupancy = v), 'oc')} />
                </Field>
                <Field label="الصيانة السنوية">
                  <NumInput value={a.annualMaintenance} min={0} onChange={(v) => set((d) => void (d.annualMaintenance = v), 'am')} />
                </Field>
              </>
            )}
            <Field label="المصروفات التشغيلية السنوية">
              <NumInput value={a.annualOpex} min={0} onChange={(v) => set((d) => void (d.annualOpex = v), 'ox')} />
            </Field>
            <div>
              <span className="label">صافي الإيراد المتوقع (محسوب)</span>
              <div className="input flex items-center bg-ivory">{money(net)}</div>
            </div>
            <Field label="معدل النمو المفترض للإيجار %" hint="اتركه فارغًا لاستخدام افتراض السيناريو.">
              <NumInput value={a.growthRate} onChange={(v) => set((d) => void (d.growthRate = v), 'gr')} />
            </Field>
            <Field label="المخصصات الاحتياطية (% من صافي الإيراد)">
              <NumInput value={a.reservePct} min={0} max={100} onChange={(v) => set((d) => void (d.reservePct = v), 'rp')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-base font-bold text-brand-900">الملكية والتوثيق الوقفي</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="حالة الملكية">
              <SelectInput
                value={a.ownership}
                options={[
                  { value: 'none', label: 'لا ملكية بعد' },
                  { value: 'pending', label: 'قيد نقل الملكية' },
                  { value: 'deed', label: 'مثبتة بصك' },
                ]}
                onChange={(v) => set((d) => void (d.ownership = v as Asset['ownership']), 'ow')}
              />
            </Field>
            <Field label="رقم الصك (عند توفره)">
              <TextInput value={a.deedNumber} onChange={(v) => set((d) => void (d.deedNumber = v), 'dn')} />
            </Field>
            <Field label="حالة التوثيق الوقفي">
              <SelectInput
                value={a.waqfDoc}
                options={[
                  { value: 'none', label: 'لم يبدأ' },
                  { value: 'drafting', label: 'قيد الإعداد' },
                  { value: 'submitted', label: 'قُدّم للجهة المختصة' },
                  { value: 'documented', label: 'موثق ومسجل' },
                ]}
                onChange={(v) => set((d) => void (d.waqfDoc = v as Asset['waqfDoc']), 'wd')}
              />
            </Field>
            <Field label="المخطط بعد التملك">
              <SelectInput
                value={a.holding}
                options={[
                  { value: 'fund', label: 'ملك للصندوق' },
                  { value: 'waqf', label: 'يوقف بوثيقة مستقلة (مخطط)' },
                ]}
                onChange={(v) => set((d) => void (d.holding = v as Asset['holding']), 'ho')}
              />
            </Field>
            <Field label="جهة النظارة">
              <TextInput value={a.nazir} onChange={(v) => set((d) => void (d.nazir = v), 'nz')} />
            </Field>
            <Field label="شروط الواقف">
              <TextInput value={a.waqfConditions} onChange={(v) => set((d) => void (d.waqfConditions = v), 'wc')} />
            </Field>
            <Field label="أوجه صرف العوائد" className="sm:col-span-3">
              <TextArea rows={2} value={a.distribution} onChange={(v) => set((d) => void (d.distribution = v), 'ds')} />
            </Field>
            <Field label="ملاحظات" className="sm:col-span-3">
              <TextArea rows={2} value={a.notes} onChange={(v) => set((d) => void (d.notes = v), 'nt')} />
            </Field>
          </div>
          {a.status === 'waqf_documented' && (a.waqfDoc !== 'documented' || a.deedNumber.trim() === '') && (
            <Callout tone="bad">الحالة «وقف موثق» تتطلب توثيقًا مكتملًا ورقم صك. عدّل الحالة أو استكمل البيانات.</Callout>
          )}
        </fieldset>
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onClose}>
            تم
          </button>
        </div>
      </div>
    </Modal>
  );
};
