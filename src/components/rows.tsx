"use client";

import { motion } from "motion/react";
import { Bell, Clock, Flame, ListChecks, MapPin, Repeat, Undo2 } from "lucide-react";
import type { Habit, Task } from "@/lib/types";
import { fmtHuman, fmtTime } from "@/lib/time";
import { habitStreak, isScheduled, taskColor, taskSource, type CalItem } from "@/lib/derive";
import { useStore } from "@/store/store";
import { Check26, cx, vars } from "./ui";

const spring = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;

export function TaskRow({ t, scope, showDate, showSrc }: { t: Task; scope: string; showDate?: boolean; showSrc?: boolean }) {
  const { data, today, lingering, a } = useStore();
  const color = taskColor(t, data);
  const ling = !!lingering[t.id];
  const s = data.settings;
  const overdue = !!t.due && t.due < today && !t.done;
  const cl = t.checklist.length ? `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : "";
  return (
    <motion.div
      layout layoutId={`${scope}:${t.id}`}
      className={cx("trow", t.done && "is-done", ling && "lingering")}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: t.done ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
      transition={spring}
    >
      <Check26 on={t.done} color={color} onClick={() => a.toggleTask(t.id)} />
      <div className="t-main" onClick={() => a.openSheet({ type: "task", id: t.id })}>
        <div className="t-title"><span className="strike">{t.title || "Без названия"}</span></div>
        <div className="t-meta">
          {overdue && <span className="overdue">Просрочено</span>}
          {showDate && t.due && <span>{t.due === today ? "Сегодня" : fmtHuman(t.due)}</span>}
          {t.time && <span className="mi"><Clock size={12} />{fmtTime(t.time, s.use12h)}</span>}
          {t.reminders.length > 0 && t.due && <span className="mi"><Bell size={12} />{t.reminders.length > 1 ? t.reminders.length : ""}</span>}
          {t.repeat !== "none" && <span className="mi"><Repeat size={12} /></span>}
          {cl && <span className="mi"><ListChecks size={12} />{cl}</span>}
          {(showSrc || !t.goalId) && (
            <span className="mi src"><i className="mdot" style={{ background: color }} />{taskSource(t, data)}</span>
          )}
        </div>
      </div>
      {ling ? (
        <button className="undo-pill" onClick={(e) => { e.stopPropagation(); a.toggleTask(t.id); }}><Undo2 size={13} />Отменить</button>
      ) : (
        t.prio > 0 && <span className={`flag p${t.prio}`} />
      )}
      {ling && <span className="linger-bar" style={{ animationDuration: `${s.undoSeconds}s` }} />}
    </motion.div>
  );
}

export function EventRow({ it, today, showDate }: { it: CalItem; today: string; showDate?: boolean }) {
  const { data, now, a } = useStore();
  const s = data.settings;
  const nowD = new Date(now);
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const past = it.date < today || (it.date === today && !it.allDay && it.endMin <= nowMin);
  const live = it.date === today && !it.allDay && it.startMin <= nowMin && nowMin < it.endMin;
  const click = () => (it.kind === "event" ? a.openSheet({ type: "event", id: it.id }) : it.kind === "goal" ? a.openRef("goal", it.id) : a.openSheet({ type: "task", id: it.id }));
  return (
    <motion.div layout className={cx("trow ev", past && "past", live && "live")} onClick={click} initial={{ opacity: 0 }} animate={{ opacity: past ? 0.55 : 1 }} exit={{ opacity: 0 }}>
      <span className="ev-bar" style={{ background: it.color }} />
      <div className="ev-time">
        {it.allDay ? <span>весь<br />день</span> : <><b>{fmtTime(it.start, s.use12h)}</b>{it.end && <span>{fmtTime(it.end, s.use12h)}</span>}</>}
      </div>
      <div className="t-main">
        <div className="t-title">{it.title}{live && <span className="live-dot">сейчас</span>}</div>
        <div className="t-meta">
          {showDate && <span>{fmtHuman(it.date)}</span>}
          {it.location && <span className="mi"><MapPin size={12} />{it.location}</span>}
          {it.repeat && <span className="mi"><Repeat size={12} /></span>}
        </div>
      </div>
    </motion.div>
  );
}

export function HabitRow({ h, date, scope }: { h: Habit; date: string; scope: string }) {
  const { today, a } = useStore();
  const on = h.checks.includes(date);
  const st = habitStreak(h, today);
  return (
    <motion.div layout layoutId={`${scope}:${h.id}`} className={cx("trow", on && "is-done")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Check26 on={on} color={h.color} onClick={() => a.toggleHabit(h.id, date)} label="Отметить привычку" />
      <div className="t-main" onClick={() => a.openSheet({ type: "habit", id: h.id })}>
        <div className="t-title"><span className="strike">{h.icon} {h.title}</span></div>
        <div className="t-meta">
          {st > 0 && <span className="mi flame"><Flame size={12} />{st}</span>}
          {h.times.length > 0 && <span className="mi"><Clock size={12} />{h.times.join(", ")}</span>}
          {!isScheduled(h, date) && <span>не по расписанию</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function SectionHead({ title, count, right, danger }: { title: string; count?: number | string; right?: React.ReactNode; danger?: boolean }) {
  return (
    <div className={cx("sec", danger && "danger")}>
      <span>{title}</span>
      {count !== undefined && <span className="cnt">{count}</span>}
      <span className="sec-r">{right}</span>
    </div>
  );
}

export { vars };
