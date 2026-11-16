"use client";

import { motion } from "motion/react";
import { CalendarPlus, CheckSquare, Flame, ListPlus, Target } from "lucide-react";
import { useStore } from "@/store/store";
import { fmtShort } from "@/lib/time";
import { Sheet } from "./ui";

export function AddSheet() {
  const { ui, today, a } = useStore();
  const date = ui.tab === "calendar" ? ui.calDate : today;
  const items = [
    { ic: <CheckSquare size={26} />, t: "Задача", s: "Дело со сроком", c: "#0A84FF", f: () => a.openSheet({ type: "task", preset: { due: ui.tab === "calendar" ? date : ui.tab === "today" ? today : null, listId: ui.filter && !ui.filter.includes(":") && !["all", "today", "overdue", "soon"].includes(ui.filter) ? ui.filter : null } }) },
    { ic: <CalendarPlus size={26} />, t: "Событие", s: fmtShort(date), c: "#FF9F0A", f: () => a.openSheet({ type: "event", preset: { date } }) },
    { ic: <Flame size={26} />, t: "Привычка", s: "Регулярное действие", c: "#FF375F", f: () => a.openSheet({ type: "habit" }) },
    { ic: <Target size={26} />, t: "Цель", s: "С подцелями и дедлайном", c: "#BF5AF2", f: () => a.openSheet({ type: "goal" }) },
    { ic: <ListPlus size={26} />, t: "Список", s: "Группа задач", c: "#30D158", f: () => a.openSheet({ type: "list" }) },
  ];
  return (
    <Sheet title="Создать" onClose={a.closeSheet}>
      <div className="add-grid">
        {items.map((it, i) => (
          <motion.button key={it.t} className="add-card" style={{ ["--c" as string]: it.c }} onClick={it.f}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04, type: "spring", stiffness: 420, damping: 30 }} whileTap={{ scale: 0.95 }}>
            <span className="add-ic">{it.ic}</span>
            <b>{it.t}</b>
            <small>{it.s}</small>
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}
