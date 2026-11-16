"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/store/store";
import { fmtHuman } from "@/lib/time";
import { taskColor, taskSource } from "@/lib/derive";
import { Empty, Sheet } from "./ui";

export function SearchSheet() {
  const { data, a } = useStore();
  const [q, setQ] = useState("");
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    const has = (...v: (string | null | undefined)[]) => v.join(" ").toLowerCase().includes(s);
    return {
      tasks: data.tasks.filter((t) => has(t.title, t.notes, ...t.checklist.map((c) => c.title))).sort((x, y) => Number(x.done) - Number(y.done)).slice(0, 12),
      events: data.events.filter((e) => has(e.title, e.notes, e.location)).sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 10),
      goals: data.goals.filter((g) => has(g.title, g.notes)),
      habits: data.habits.filter((h) => has(h.title)),
      lists: data.lists.filter((l) => has(l.name)),
    };
  }, [q, data]);
  const total = res ? res.tasks.length + res.events.length + res.goals.length + res.habits.length + res.lists.length : 0;
  const Item = ({ title, meta, color, onClick }: { title: string; meta: string; color: string; onClick: () => void }) => (
    <button className="s-item" onClick={onClick}>
      <i style={{ background: color }} />
      <div><b>{title}</b><small>{meta}</small></div>
    </button>
  );
  return (
    <Sheet title="Поиск" onClose={a.closeSheet} size="lg">
      <div className="search-box"><Search size={18} /><input autoFocus className="inpt" placeholder="Задачи, события, цели, привычки…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!res && <Empty icon={<Search size={28} />} title="Начните вводить" text="Ищет по названиям, заметкам, местам и подзадачам" />}
      {res && !total && <Empty icon={<Search size={28} />} title="Ничего не найдено" />}
      {res && res.tasks.length > 0 && <div className="s-sec">Задачи</div>}
      {res?.tasks.map((t) => <Item key={t.id} title={t.title} color={taskColor(t, data)} meta={`${t.done ? "✓ " : ""}${t.due ? fmtHuman(t.due) + " · " : ""}${taskSource(t, data)}`} onClick={() => a.openSheet({ type: "task", id: t.id })} />)}
      {res && res.events.length > 0 && <div className="s-sec">События</div>}
      {res?.events.map((e) => <Item key={e.id} title={e.title} color={e.color} meta={`${fmtHuman(e.date)}${e.start ? " · " + e.start : ""}${e.location ? " · " + e.location : ""}`} onClick={() => a.openSheet({ type: "event", id: e.id })} />)}
      {res && res.goals.length > 0 && <div className="s-sec">Цели</div>}
      {res?.goals.map((g) => <Item key={g.id} title={`${g.icon} ${g.title}`} color={g.color} meta={g.target ? "до " + fmtHuman(g.target) : "без дедлайна"} onClick={() => a.openRef("goal", g.id)} />)}
      {res && res.habits.length > 0 && <div className="s-sec">Привычки</div>}
      {res?.habits.map((h) => <Item key={h.id} title={`${h.icon} ${h.title}`} color={h.color} meta={`${h.checks.length} отметок`} onClick={() => a.openRef("habit", h.id)} />)}
      {res && res.lists.length > 0 && <div className="s-sec">Списки</div>}
      {res?.lists.map((l) => <Item key={l.id} title={`${l.icon} ${l.name}`} color={l.color} meta={`${data.tasks.filter((t) => t.listId === l.id && !t.done).length} активных задач`} onClick={() => { a.setUi({ tab: "tasks", filter: l.id }); a.closeSheet(); }} />)}
    </Sheet>
  );
}
