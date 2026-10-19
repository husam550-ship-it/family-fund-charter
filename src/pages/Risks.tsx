import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { Risk, RiskStatus } from '../types';
import { useStore } from '../lib/store';
import { uid } from '../lib/format';
import { Badge, Callout, Card, cx, SectionHead } from '../components/ui';
import { Field, SelectInput, TextArea, TextInput } from '../components/fields';
import { ClauseList } from '../components/ClauseList';

const STATUS: { value: RiskStatus; label: string }[] = [
  { value: 'open', label: 'مفتوح' },
  { value: 'mitigating', label: 'قيد المعالجة' },
  { value: 'accepted', label: 'مقبول' },
  { value: 'closed', label: 'مغلق' },
];
const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export const riskScore = (r: Risk): number => r.probability * r.impact;
export const riskLevel = (s: number): { label: string; tone: 'ok' | 'info' | 'warn' | 'bad'; bg: string } =>
  s >= 15
    ? { label: 'حرج', tone: 'bad', bg: 'bg-bad text-white' }
    : s >= 10
      ? { label: 'مرتفع', tone: 'warn', bg: 'bg-[#e8b04a] text-ink' }
      : s >= 5
        ? { label: 'متوسط', tone: 'info', bg: 'bg-gold-soft text-gold-deep' }
        : { label: 'منخفض', tone: 'ok', bg: 'bg-ok-soft text-ok' };

export default function Risks() {
  const p = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const [cell, setCell] = useState<[number, number] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = cell ? p.risks.filter((r) => r.probability === cell[0] && r.impact === cell[1]) : p.risks;
  const levels = { 'حرج': 0, 'مرتفع': 0, 'متوسط': 0, 'منخفض': 0 } as Record<string, number>;
  p.risks.filter((r) => r.status !== 'closed').forEach((r) => (levels[riskLevel(riskScore(r)).label] += 1));

  return (
    <div className="space-y-6">
      <SectionHead
        num="13 / المخاطر واستمرارية الصندوق"
        title="المخاطر واستمرارية الصندوق"
        sub="سجل مخاطر احترافي بمصفوفة تفاعلية: الاحتمال والأثر والمستوى والإجراءات الوقائية وخطة الاستجابة والمسؤول ومؤشر الإنذار المبكر."
      />

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <Card>
          <h2 className="mb-2 text-lg">مصفوفة المخاطر</h2>
          <p className="mb-3 text-xs text-mute">اضغط على خلية لتصفية القائمة. المحور الأفقي: الأثر، والرأسي: الاحتمال.</p>
          <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1 text-center text-xs" role="grid" aria-label="مصفوفة المخاطر">
            {[5, 4, 3, 2, 1].map((pr) => (
              <div key={pr} className="contents">
                <div className="grid place-items-center pe-1 font-bold text-mute">{pr}</div>
                {[1, 2, 3, 4, 5].map((im) => {
                  const n = p.risks.filter((r) => r.probability === pr && r.impact === im && r.status !== 'closed').length;
                  const lv = riskLevel(pr * im);
                  const active = cell?.[0] === pr && cell?.[1] === im;
                  return (
                    <button
                      key={im}
                      role="gridcell"
                      aria-label={`احتمال ${pr} أثر ${im}: ${n} مخاطر`}
                      onClick={() => setCell(active ? null : [pr, im])}
                      className={cx('grid aspect-square place-items-center rounded-md text-sm font-bold', lv.bg, active && 'outline outline-2 outline-offset-1 outline-brand-900')}
                    >
                      {n > 0 ? n : ''}
                    </button>
                  );
                })}
              </div>
            ))}
            <div />
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="font-bold text-mute">{n}</div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(levels).map(([k, v]) => (
              <Badge key={k} tone={k === 'حرج' ? 'bad' : k === 'مرتفع' ? 'warn' : k === 'متوسط' ? 'info' : 'ok'}>
                {k}: {v}
              </Badge>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">سجل المخاطر {cell && <span className="text-sm text-mute">(مصفّى: احتمال {cell[0]} × أثر {cell[1]})</span>}</h2>
            <div className="flex gap-2">
              {cell && (
                <button className="btn btn-ghost btn-sm" onClick={() => setCell(null)}>
                  إلغاء التصفية
                </button>
              )}
              <button
                className="btn btn-soft btn-sm"
                onClick={() => {
                  const id = uid('rk');
                  update((d) => void d.risks.push({ id, title: 'خطر جديد', probability: 3, impact: 3, prevention: '', response: '', owner: '', indicator: '', status: 'open' }));
                  setOpenId(id);
                }}
              >
                <Plus className="size-4" /> إضافة خطر
              </button>
            </div>
          </div>
          {list.length === 0 && <Callout tone="info">لا مخاطر في هذه الخلية.</Callout>}
          {list.map((r) => {
            const i = p.risks.findIndex((x) => x.id === r.id);
            const lv = riskLevel(riskScore(r));
            const open = openId === r.id;
            const set = (fn: (d: Risk) => void, k: string): void => update((d) => fn(d.risks[i]), `rk:${r.id}:${k}`);
            return (
              <div key={r.id} className="rounded-xl border border-line bg-paper">
                <button className="flex w-full flex-wrap items-center gap-2 p-3 text-start" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
                  <ChevronDown className={cx('size-4 text-mute transition-transform', open && 'rotate-180')} aria-hidden />
                  <span className="min-w-0 flex-1 font-bold text-brand-900">{r.title}</span>
                  <Badge tone={lv.tone}>
                    {lv.label} ({riskScore(r)})
                  </Badge>
                  <Badge tone="plain">{STATUS.find((s) => s.value === r.status)?.label}</Badge>
                </button>
                {open && (
                  <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                    <Field label="عنوان الخطر" className="sm:col-span-2">
                      <TextInput value={r.title} onChange={(v) => set((d) => void (d.title = v), 't')} />
                    </Field>
                    <Field label="الاحتمال (1–5)">
                      <SelectInput value={String(r.probability)} options={SCALE} onChange={(v) => set((d) => void (d.probability = Number(v)), 'p')} />
                    </Field>
                    <Field label="الأثر (1–5)">
                      <SelectInput value={String(r.impact)} options={SCALE} onChange={(v) => set((d) => void (d.impact = Number(v)), 'i')} />
                    </Field>
                    <Field label="الإجراءات الوقائية">
                      <TextArea rows={2} value={r.prevention} onChange={(v) => set((d) => void (d.prevention = v), 'pv')} />
                    </Field>
                    <Field label="خطة الاستجابة">
                      <TextArea rows={2} value={r.response} onChange={(v) => set((d) => void (d.response = v), 'rs')} />
                    </Field>
                    <Field label="الجهة المسؤولة">
                      <TextInput value={r.owner} onChange={(v) => set((d) => void (d.owner = v), 'o')} />
                    </Field>
                    <Field label="مؤشر الإنذار المبكر">
                      <TextInput value={r.indicator} onChange={(v) => set((d) => void (d.indicator = v), 'in')} />
                    </Field>
                    <Field label="حالة المعالجة">
                      <SelectInput value={r.status} options={STATUS} onChange={(v) => set((d) => void (d.status = v as RiskStatus), 's')} />
                    </Field>
                    <div className="flex items-end justify-end">
                      <button className="btn btn-danger btn-sm" onClick={() => update((d) => void (d.risks = d.risks.filter((x) => x.id !== r.id)))}>
                        <Trash2 className="size-4" /> حذف الخطر
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ClauseList ids={['CON-01', 'CON-11', 'CON-06', 'CON-04']} title="بنود الاستمرارية" allowAdd={false} />
    </div>
  );
}
