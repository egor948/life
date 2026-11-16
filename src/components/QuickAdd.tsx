"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/store/store";
import { newTask, uid } from "@/lib/factory";
import { parseQuick } from "@/lib/quick";
import type { Task } from "@/lib/types";

export function QuickAdd({ preset, placeholder = "Новая задача…  например: «Позвонить маме завтра 18:30 !!»" }: { preset?: Partial<Task>; placeholder?: string }) {
  const { data, today, a } = useStore();
  const [v, setV] = useState("");
  const submit = () => {
    if (!v.trim()) return;
    const p = parseQuick(v, today);
    if (!p.title) return;
    const due = p.due ?? preset?.due ?? null;
    a.saveTask(newTask({
      ...preset, title: p.title, due, time: p.time, prio: p.prio || preset?.prio || 0,
      reminders: due ? data.settings.taskReminders.map((m) => ({ id: uid(), minutes: m })) : [],
    }));
    setV("");
  };
  return (
    <form className="quick" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Plus size={18} />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
      {v.trim() && <button className="btn primary sm" type="submit">Добавить</button>}
    </form>
  );
}
