"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Pencil, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store/store";
import { fmtHuman, plural } from "@/lib/time";
import { countdown, goalProgress, subProgress } from "@/lib/derive";
import type { Goal } from "@/lib/types";
import { HabitRow, TaskRow } from "./rows";
import { Empty, Ring, cx } from "./ui";

function GoalCard({ g, i }: { g: Goal; i: number }) {
  const { data, today, a } = useStore();
  const p = goalProgress(g.id, data.tasks);
  const subs = data.subs.filter((s) => s.goalId === g.id).length;
  const habs = data.habits.filter((h) => h.goalId === g.id && !h.archived).length;
  const cd = countdown(g.target, today);
  const late = !!g.target && g.target < today;
  return (
    <motion.button layout className="card gcard" onClick={() => a.setUi({ openGoal: g.id })}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04, type: "spring", stiffness: 380, damping: 32 }} whileTap={{ scale: 0.98 }}>
      <Ring pct={p.pct} color={g.color} size={64} stroke={7}><span className="ring-e">{g.icon}</span></Ring>
      <div className="g-main">
        <div className="g-title">{g.title}</div>
        <div className="g-bar"><motion.i style={{ background: g.color }} initial={{ width: 0 }} animate={{ width: `${p.pct * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} /></div>
        <div className="g-meta">
          {p.done}/{p.total} {plural(p.total, "задача", "задачи", "задач")}
          {subs > 0 && ` · ${subs} ${plural(subs, "подцель", "подцели", "подцелей")}`}
          {habs > 0 && ` · ${habs} ${plural(habs, "привычка", "привычки", "привычек")}`}
          {cd && <span className={cx("g-cd", late && "late")}> · {cd}</span>}
        </div>
      </div>
      <b className="g-pct" style={{ color: g.color }}>{Math.round(p.pct * 100)}%</b>
    </motion.button>
  );
}

function GoalDetail({ g }: { g: Goal }) {
  const { data, today, a } = useStore();
  const p = goalProgress(g.id, data.tasks);
  const subs = data.subs.filter((s) => s.goalId === g.id);
  const {lingering} = useStore();
  const tasks = data.tasks.filter((t) => t.goalId === g.id);
  const sortT = (list: typeof tasks) => list.slice().sort((x, y) => Number(x.done && !lingering[x.id]) - Number(y.done && !lingering[y.id]) || (x.due ?? "9").localeCompare(y.due ?? "9"));
  const loose = tasks.filter((t) => !t.subId || !subs.some((s) => s.id === t.subId));
  const habs = data.habits.filter((h) => h.goalId === g.id && !h.archived);
  const cd = countdown(g.target, today);
  return (
    <LayoutGroup id={"goal" + g.id}>
      <button className="back" onClick={() => a.setUi({ openGoal: null })}><ArrowLeft size={16} />Все цели</button>
      <div className="card goal-hero" style={{ ["--c" as string]: g.color }}>
        <Ring pct={p.pct} color={g.color} size={92} stroke={9}><span className="ring-big">{Math.round(p.pct * 100)}%</span></Ring>
        <div className="gh-main">
          <h2>{g.icon} {g.title}</h2>
          {g.notes && <p>{g.notes}</p>}
          <div className="gh-tags">
            <span>{p.done}/{p.total} задач</span>
            {g.target && <span className={cx(g.target < today && "late")}><CalendarDays size={13} />{fmtHuman(g.target)} · {cd}</span>}
            {g.archived && <span>в архиве</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={() => a.openSheet({ type: "goal", id: g.id })} aria-label="Изменить"><Pencil size={17} /></button>
      </div>

      <div className="sec"><span>Подцели</span><span className="sec-r"><button className="glink" onClick={() => a.openSheet({ type: "sub", goalId: g.id })}><Plus size={13} />Подцель</button></span></div>
      {subs.map((s) => {
        const sp = subProgress(s.id, data.tasks);
        return (
          <div key={s.id} className="sub-block">
            <div className="sub-head">
              <div className="sub-t" onClick={() => a.openSheet({ type: "sub", goalId: g.id, id: s.id })}>
                <b>{s.title}</b><small>{sp.done}/{sp.total}</small>
              </div>
              <div className="g-bar thin"><motion.i style={{ background: g.color }} animate={{ width: `${sp.pct * 100}%` }} transition={{ duration: 0.6 }} /></div>
              <button className="glink" onClick={() => a.openSheet({ type: "task", preset: { goalId: g.id, subId: s.id } })}><Plus size={13} />Задача</button>
            </div>
            <div className="group">
              <AnimatePresence initial={false}>{sortT(tasks.filter((t) => t.subId === s.id)).map((t) => <TaskRow key={t.id} t={t} scope={"g" + g.id} showDate />)}</AnimatePresence>
              {!tasks.some((t) => t.subId === s.id) && <div className="empty-in">Нет задач</div>}
            </div>
          </div>
        );
      })}
      {(loose.length > 0 || !subs.length) && (
        <div className="sub-block">
          <div className="sub-head"><div className="sub-t"><b>{subs.length ? "Без подцели" : "Задачи цели"}</b><small>{loose.filter((t) => t.done).length}/{loose.length}</small></div>
            <button className="glink" onClick={() => a.openSheet({ type: "task", preset: { goalId: g.id } })}><Plus size={13} />Задача</button></div>
          <div className="group">
            <AnimatePresence initial={false}>{sortT(loose).map((t) => <TaskRow key={t.id} t={t} scope={"g" + g.id} showDate />)}</AnimatePresence>
            {!loose.length && <div className="empty-in">Добавьте первую задачу к цели</div>}
          </div>
        </div>
      )}

      <div className="sec"><span>Привычки цели</span><span className="sec-r"><button className="glink" onClick={() => a.openSheet({ type: "habit" })}><Plus size={13} />Новая</button></span></div>
      {habs.length ? <div className="group">{habs.map((h) => <HabitRow key={h.id} h={h} date={today} scope={"g" + g.id} />)}</div> : <div className="muted-note">Привяжите привычки к цели в их настройках — они будут отображаться здесь.</div>}
    </LayoutGroup>
  );
}

export function GoalsView() {
  const { data, ui, a } = useStore();
  const [arch, setArch] = useState(false);
  const open = ui.openGoal ? data.goals.find((g) => g.id === ui.openGoal) : null;
  const active = data.goals.filter((g) => !g.archived);
  const archived = data.goals.filter((g) => g.archived);
  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <motion.div key={"d" + open.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.22 }}>
          <GoalDetail g={open} />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}>
          {!active.length && <Empty icon={<Target size={30} />} title="Поставьте первую цель" text="Разбейте её на подцели и привяжите задачи и привычки — прогресс считается сам." action={<button className="btn primary" onClick={() => a.openSheet({ type: "goal" })}>Создать цель</button>} />}
          <div className="goals-grid">{active.map((g, i) => <GoalCard key={g.id} g={g} i={i} />)}</div>
          {archived.length > 0 && (
            <>
              <button className="ghead clickable plain-btn" onClick={() => setArch(!arch)}>{arch ? "▾" : "▸"} Архив · {archived.length}</button>
              {arch && <div className="goals-grid">{archived.map((g, i) => <GoalCard key={g.id} g={g} i={i} />)}</div>}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
