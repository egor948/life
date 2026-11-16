"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { useStore } from "@/store/store";
import { WD, addD, dow, dstr, fmtMinutes, plural, startOfWeek, fromMin } from "@/lib/time";
import { buildDayMap, goalProgress } from "@/lib/derive";
import { EventRow, HabitRow, SectionHead, TaskRow } from "./rows";
import { QuickAdd } from "./QuickAdd";
import { Empty, Ring, cx } from "./ui";

export function TodayView() {
  const { data, today, now, lingering, a } = useStore();
  const s = data.settings;
  const nd = new Date(now);
  const nowMin = nd.getHours() * 60 + nd.getMinutes();

  const d = useMemo(() => {
    const week = startOfWeek(today, s.weekStart);
    const map = buildDayMap(data, s, week, addD(week, 6));
    return { week, map };
  }, [data, s, today]);

  const items = d.map[today] ?? [];
  const evs = items.filter((i) => i.kind !== "task");
  const active = (t: { id: string; done: boolean }) => !t.done || !!lingering[t.id];
  const overdue = data.tasks.filter((t) => t.due && t.due < today && active(t)).sort((x, y) => (x.due! < y.due! ? -1 : 1));
  const dueToday = data.tasks.filter((t) => t.due === today && active(t)).sort((x, y) => (x.time || "99") < (y.time || "99") ? -1 : 1);
  const doneToday = data.tasks.filter((t) => t.done && !lingering[t.id] && (t.due === today || dstr(new Date(t.doneAt)) === today)).sort((x, y) => y.doneAt - x.doneAt);
  const habs = data.habits.filter((h) => !h.archived && h.days.includes(dow(today)));
  const habsDone = habs.filter((h) => h.checks.includes(today)).length;
  const tasksToday = data.tasks.filter((t) => t.due === today);
  const total = tasksToday.length + habs.length;
  const done = tasksToday.filter((t) => t.done).length + habsDone;
  const pct = total ? done / total : 0;
  const goals = data.goals.filter((g) => !g.archived).slice(0, 4);

  const upcoming = items.filter((i) => !i.allDay && i.kind !== "goal" && !(i.kind === "task" && i.done) && i.startMin >= nowMin)[0];
  const evLeft = evs.filter((e) => e.kind === "event" && (e.allDay || e.endMin > nowMin)).length;

  const tomorrow = addD(today, 1);
  const tmr = (d.map[tomorrow] ?? []).filter((i) => i.kind !== "goal");

  return (
    <LayoutGroup id="today">
      <div className="hero">
        <div className="hero-top">
          <div>
            <span className="hero-label">План дня</span>
            <div className="hero-sub">
              {upcoming
                ? <>Дальше · <b>{fromMin(upcoming.startMin)}</b> {upcoming.title} · через {fmtMinutes(Math.max(1, upcoming.startMin - nowMin))}</>
                : total ? (pct === 1 ? "Всё сделано — отличный день! 🎉" : "Осталось немного — вы справитесь") : "Сегодня свободный день"}
            </div>
          </div>
          <Ring pct={pct} color="#fff" size={68} stroke={8}><span className="hero-pct">{Math.round(pct * 100)}%</span></Ring>
        </div>
        <div className="hero-grid">
          <div className="hero-cell"><b>{tasksToday.filter((t) => t.done).length}/{tasksToday.length}</b><span>задач</span></div>
          <div className="hero-cell"><b>{evLeft}</b><span>{plural(evLeft, "событие", "события", "событий")} впереди</span></div>
          <div className="hero-cell"><b>{habsDone}/{habs.length}</b><span>привычек</span></div>
        </div>
      </div>

      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => addD(d.week, i)).map((day) => {
          const its = d.map[day] ?? [];
          return (
            <button key={day} className={cx("ws-day", day === today && "today")} onClick={() => a.gotoDay(day, "day")}>
              <span>{WD[dow(day)]}</span>
              <b>{+day.slice(8)}</b>
              <div className="dots">{its.slice(0, 3).map((it, k) => <i key={k} style={{ background: it.color }} />)}</div>
            </button>
          );
        })}
      </div>

      <QuickAdd preset={{ due: today }} />

      <div className="today-grid">
        <div>
          <SectionHead title="События" count={evs.length || undefined} right={<button className="glink" onClick={() => a.gotoDay(today, "day")}>Календарь <ArrowRight size={13} /></button>} />
          {evs.length ? (
            <div className="group">{evs.map((e) => <EventRow key={e.kind + e.id + e.date} it={e} today={today} />)}</div>
          ) : <Empty icon={<CalendarCheck size={26} />} title="Событий нет" text="День свободен" action={<button className="btn ghost sm" onClick={() => a.openSheet({ type: "event", preset: { date: today } })}>Добавить событие</button>} />}

          <SectionHead title="Задачи" count={overdue.length + dueToday.length || undefined} />
          <AnimatePresence initial={false}>
            {overdue.length > 0 && (
              <motion.div key="over" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="ghead over"><span>Просрочено · {overdue.length}</span><button className="glink" onClick={a.moveOverdueToToday}>На сегодня</button></div>
                <div className="group"><AnimatePresence initial={false}>{overdue.map((t) => <TaskRow key={t.id} t={t} scope="today" showDate />)}</AnimatePresence></div>
              </motion.div>
            )}
          </AnimatePresence>
          {dueToday.length > 0 || overdue.length === 0 ? (
            <div className="group">
              <AnimatePresence initial={false}>{dueToday.map((t) => <TaskRow key={t.id} t={t} scope="today" />)}</AnimatePresence>
              {!dueToday.length && <div className="empty-in"><Sparkles size={16} /> На сегодня задач нет</div>}
            </div>
          ) : null}
          {doneToday.length > 0 && (
            <>
              <div className="ghead">Выполнено · {doneToday.length}</div>
              <div className="group"><AnimatePresence initial={false}>{doneToday.map((t) => <TaskRow key={t.id} t={t} scope="today" />)}</AnimatePresence></div>
            </>
          )}
        </div>

        <div>
          <SectionHead title="Привычки" count={habs.length ? `${habsDone}/${habs.length}` : undefined} right={<button className="glink" onClick={() => a.setUi({ tab: "habits" })}>Все <ArrowRight size={13} /></button>} />
          {habs.length ? <div className="group">{habs.map((h) => <HabitRow key={h.id} h={h} date={today} scope="today" />)}</div> : <Empty title="Нет привычек на сегодня" />}

          {goals.length > 0 && (
            <>
              <SectionHead title="Цели" right={<button className="glink" onClick={() => a.setUi({ tab: "goals" })}>Все <ArrowRight size={13} /></button>} />
              <div className="mini-goals">
                {goals.map((g) => {
                  const p = goalProgress(g.id, data.tasks);
                  return (
                    <button key={g.id} className="card mini-goal" onClick={() => a.openRef("goal", g.id)}>
                      <Ring pct={p.pct} color={g.color} size={46} stroke={5}><span className="ring-e">{g.icon}</span></Ring>
                      <div><b>{g.title}</b><small>{p.done}/{p.total} задач</small></div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <SectionHead title="Завтра" count={tmr.length || undefined} right={<button className="glink" onClick={() => a.gotoDay(tomorrow, "day")}>Открыть <ArrowRight size={13} /></button>} />
          {tmr.length ? (
            <div className="card tmr">
              {tmr.slice(0, 5).map((i) => (
                <div key={i.kind + i.id} className="tmr-row"><i style={{ background: i.color }} /><span className="tmr-t">{i.allDay ? "весь день" : fromMin(i.startMin)}</span><span className="tmr-n">{i.title}</span></div>
              ))}
              {tmr.length > 5 && <small className="muted">и ещё {tmr.length - 5}</small>}
            </div>
          ) : <Empty title="Завтра пока пусто" />}
        </div>
      </div>
    </LayoutGroup>
  );
}
