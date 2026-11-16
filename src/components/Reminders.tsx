"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Bell, Plus, X } from "lucide-react";
import type { Reminder } from "@/lib/types";
import { uid } from "@/lib/factory";
import { reminderLabel } from "@/lib/time";
import { cx } from "./ui";

const UNITS = [
  { v: 1, label: "мин." },
  { v: 60, label: "ч." },
  { v: 1440, label: "дн." },
  { v: 10080, label: "нед." },
];
const PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const presetLabel = (m: number) =>
  m === 0 ? "В момент" : m < 60 ? `${m} мин` : m < 1440 ? `${m / 60} ч` : m < 10080 ? `${m / 1440} дн` : `${m / 10080} нед`;

function unitOf(min: number) {
  if (min > 0 && min % 10080 === 0) return 10080;
  if (min > 0 && min % 1440 === 0) return 1440;
  if (min > 0 && min % 60 === 0) return 60;
  return 1;
}

function Row({ r, onChange, onRemove }: { r: Reminder; onChange: (m: number) => void; onRemove: () => void }) {
  const [custom] = useState(r.minutes !== 0 && !PRESETS.includes(r.minutes) ? true : false);
  const [unit, setUnit] = useState(unitOf(r.minutes));
  const [amt, setAmt] = useState(String(r.minutes / unitOf(r.minutes)));
  const editable = custom || r.minutes !== 0;
  const push = (a: string, u: number) => {
    const n = Math.max(0, Math.round(Number(a) || 0));
    onChange(n * u);
  };
  return (
    <motion.div layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="rem-wrap">
      <div className="rem-row">
        <Bell size={16} className="rem-ic" />
        {editable ? (
          <>
            <span>За</span>
            <input
              className="inpt rem-num" type="number" min={0} inputMode="numeric" value={amt}
              onChange={(e) => { setAmt(e.target.value); push(e.target.value, unit); }}
            />
            <select
              className="inpt rem-unit" value={unit}
              onChange={(e) => { const u = Number(e.target.value); setUnit(u); push(amt, u); }}
            >
              {UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
            </select>
            <span className="rem-to">до</span>
          </>
        ) : (
          <span className="rem-static">{reminderLabel(0)}</span>
        )}
        <button type="button" className="icon-btn plain sm" onClick={onRemove} aria-label="Убрать"><X size={15} /></button>
      </div>
    </motion.div>
  );
}

export function RemindersEditor({
  value, onChange, disabled, hint,
}: { value: Reminder[]; onChange: (v: Reminder[]) => void; disabled?: boolean; hint?: string }) {
  const used = new Set(value.map((r) => r.minutes));
  const add = (m: number) => onChange([...value, { id: uid(), minutes: m }]);
  return (
    <div className={cx("rems", disabled && "disabled")}>
      <AnimatePresence initial={false}>
        {value.map((r) => (
          <Row
            key={r.id} r={r}
            onChange={(m) => onChange(value.map((x) => (x.id === r.id ? { ...x, minutes: m } : x)))}
            onRemove={() => onChange(value.filter((x) => x.id !== r.id))}
          />
        ))}
      </AnimatePresence>
      {!value.length && <div className="rem-none">Напоминаний нет</div>}
      <div className="rem-chips">
        {PRESETS.filter((p) => !used.has(p)).map((p) => (
          <button type="button" key={p} className="chip sm" onClick={() => add(p)} disabled={disabled}><Plus size={12} />{presetLabel(p)}</button>
        ))}
        <button type="button" className="chip sm accent" onClick={() => add(45)} disabled={disabled}><Plus size={12} />Своё…</button>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
