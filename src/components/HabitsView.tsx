"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store/store";
import { WD, addD, dow, fmtHuman, startOfWeek } from "@/lib/time";
import { habitBest, habitRate, habitStreak, isScheduled } from "@/lib/derive";
import type { Habit } from "@/lib/types";
import { Empty, Ring, cx, vars } from "./ui";

function HabitCard({ h, week, i }: { h: Habit; week: string[]; i: number }) {
  const { data, today, a } = useStore();
  const st = habitStreak(h, today);
  const best = habitBest(h, today);
  const r = habitRate(h, addD(today, -29), today);
  const goal = data.goals.find((g) => g.id === h.goalId);
  return (
    <motion.div layout className="card hcard" style={vars({ "--c": h.color })} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04, type: "spring", stiffness: 380, damping: 32 }}>
      <div className="h-top">
        <div className="h-ic">{h.icon}</div>
        <div className="h-name" onClick={() => a.openSheet({ type: "habit", id: h.id })}>
          <b>{h.title}</b>
          <small>
            {st > 0 ? <span className="flame"><Flame size={12} />{st}</span> : null}
            {st > 0 ? " · " : ""}рекорд {best} · {Math.round(r.pct * 100)}% за 30 дн.
            {goal ? ` · ${goal.icon} ${goal.title}` : ""}
          </small>
        </div>
        <button className="icon-btn plain sm" onClick={() => a.openSheet({ type: "habit", id: h.id })} aria-label="Изменить"><Pencil size={15} /></button>
      </div>
      <div className="hweek">
        {week.map((d) => {
          const on = h.checks.includes(d), sch = isScheduled(h, d), future = d > today;
          return (
            <div key={d} className={cx("hday", d === today && "today")}>
              <span>{WD[dow(d)]}</span>
              <button className={cx("hdot", on && "on", sch && "sch")} disabled={future} onClick={() => a.toggleHabit(h.id, d)} aria-label={fmtHuman(d)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 12.5l4.2 4.2L18.5 7.8" /></svg>
              </button>
              <em>{+d.slice(8)}</em>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function HabitsView() {
  const { data, today, a } = useStore();
  const [off, setOff] = useState(0);
  const [arch, setArch] = useState(false);
  const wk = startOfWeek(addD(today, off * 7), data.settings.weekStart);
  const week = Array.from({ length: 7 }, (_, i) => addD(wk, i));
  const active = data.habits.filter((h) => !h.archived);
  const archived = data.habits.filter((h) => h.archived);
  const todayList = active.filter((h) => isScheduled(h, today));
  const doneN = todayList.filter((h) => h.checks.includes(today)).length;
  const pct = todayList.length ? doneN / todayList.length : 0;
  const best = Math.max(0, ...active.map((h) => habitStreak(h, today)));
  const wkDone = active.reduce((n, h) => n + week.filter((d) => h.checks.includes(d)).length, 0);
  const wkPlan = active.reduce((n, h) => n + week.filter((d) => d <= today && isScheduled(h, d)).length, 0);
  return (
    <>
      <div className="card habit-sum">
        <Ring pct={pct} color="var(--accent)" size={70} stroke={8}><span className="ring-n">{doneN}/{todayList.length}</span></Ring>
        <div>
          <b>{pct === 1 && todayList.length ? "Все привычки на сегодня выполнены 🎉" : "Сегодня"}</b>
          <small>Лучшая серия: 🔥 {best} · за неделю {wkDone} из {wkPlan}</small>
        </div>
      </div>

      <div className="week-nav">
        <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Назад"><ChevronLeft size={18} /></button>
        <button className="week-t" onClick={() => setOff(0)}>{fmtHuman(week[0])} – {fmtHuman(week[6])}{off !== 0 ? " · к текущей" : ""}</button>
        <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Вперёд"><ChevronRight size={18} /></button>
      </div>

      <AnimatePresence initial={false}>
        {active.map((h, i) => <HabitCard key={h.id} h={h} week={week} i={i} />)}
      </AnimatePresence>
      {!active.length && <Empty icon={<Flame size={30} />} title="Привычек пока нет" text="Начните с одной маленькой — отмечайте каждый день и растите серию." action={<button className="btn primary" onClick={() => a.openSheet({ type: "habit" })}><Plus size={16} />Новая привычка</button>} />}
      {archived.length > 0 && (
        <>
          <button className="ghead clickable plain-btn" onClick={() => setArch(!arch)}>{arch ? "▾" : "▸"} Архив · {archived.length}</button>
          {arch && archived.map((h, i) => <HabitCard key={h.id} h={h} week={week} i={i} />)}
        </>
      )}
    </>
  );
}
