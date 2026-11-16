"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, CheckSquare, Plus } from "lucide-react";
import { useStore } from "@/store/store";
import type { CalView, Settings } from "@/lib/types";
import {
  MGEN, MONTHS, WD, addD, addMonths, addYears, daysInMonth, dow, fmtHuman, fmtLong, fmtShort, isoWeek, monthStart, plural,
  relDay, startOfWeek, ymd,
} from "@/lib/time";
import { buildDayMap, type CalItem } from "@/lib/derive";
import { EventRow, HabitRow, TaskRow } from "./rows";
import { ItemChip, TimeGrid } from "./TimeGrid";
import { Empty, Segmented, Switch, cx } from "./ui";

const VIEWS: { v: CalView; label: string }[] = [
  { v: "day", label: "День" }, { v: "3days", label: "3 дня" }, { v: "week", label: "Неделя" },
  { v: "month", label: "Месяц" }, { v: "year", label: "Год" }, { v: "agenda", label: "Сводка" },
];

function stepDate(v: CalView, d: string, n: number) {
  switch (v) {
    case "day": return addD(d, n);
    case "3days": return addD(d, 3 * n);
    case "week": return addD(d, 7 * n);
    case "month": return addMonths(d, n);
    case "year": return addYears(d, n);
    case "agenda": return addD(d, 14 * n);
  }
}

function rangeFor(view: CalView, date: string, s: Settings, agendaDays: number) {
  const wd = (days: string[]) => (s.showWeekends ? days : days.filter((x) => dow(x) < 5));
  switch (view) {
    case "day": return { from: date, to: date, days: [date] };
    case "3days": { const days = [date, addD(date, 1), addD(date, 2)]; return { from: date, to: days[2], days }; }
    case "week": { const ws = startOfWeek(date, s.weekStart); const all = Array.from({ length: 7 }, (_, i) => addD(ws, i)); return { from: ws, to: addD(ws, 6), days: wd(all) }; }
    case "month": {
      const first = monthStart(date); const gs = startOfWeek(first, s.weekStart);
      const [y, m] = ymd(first); const rows = Math.ceil(((dow(first) - s.weekStart + 7) % 7 + daysInMonth(y, m)) / 7);
      return { from: gs, to: addD(gs, rows * 7 - 1), days: [] as string[] };
    }
    case "year": { const y = date.slice(0, 4); return { from: `${y}-01-01`, to: `${y}-12-31`, days: [] as string[] }; }
    case "agenda": return { from: date, to: addD(date, agendaDays - 1), days: [] as string[] };
  }
}

function titleFor(view: CalView, date: string, from: string, to: string, days: string[]) {
  const [y, m] = ymd(date);
  if (view === "month") return { main: MONTHS[m - 1], sub: String(y) };
  if (view === "year") return { main: String(y), sub: "" };
  if (view === "day") return { main: fmtLong(date), sub: String(y) };
  if (view === "agenda") return { main: "Сводка", sub: `${fmtHuman(from)} – ${fmtHuman(to)}` };
  const a = days[0] ?? from, b = days[days.length - 1] ?? to;
  const [, am, ad] = ymd(a); const [by, bm, bd] = ymd(b);
  return { main: am === bm ? `${ad} – ${bd} ${MGEN[bm - 1]}` : `${ad} ${MGEN[am - 1].slice(0, 3)} – ${bd} ${MGEN[bm - 1].slice(0, 3)}`, sub: String(by) };
}

/* ---------- панель дня ---------- */
function DayPanel({ date, map }: { date: string; map: Record<string, CalItem[]> }) {
  const { data, today, lingering, a } = useStore();
  const items = (map[date] ?? []).filter((i) => i.kind !== "task");
  const tasks = data.tasks.filter((t) => t.due === date).sort((x, y) => (x.time || "99").localeCompare(y.time || "99"));
  const habs = data.habits.filter((h) => !h.archived && h.days.includes(dow(date)));
  void lingering;
  return (
    <div className="day-panel">
      <div className="dp-head">
        <div>
          <b>{fmtLong(date)}</b>
          <small>{date === today ? "Сегодня" : relDay(date, today)}{map[date]?.length ? ` · ${map[date].length} ${plural(map[date].length, "дело", "дела", "дел")}` : ""}</small>
        </div>
        <div className="dp-btns">
          <button className="icon-btn" onClick={() => a.openSheet({ type: "event", preset: { date } })} aria-label="Событие"><CalendarPlus size={17} /></button>
          <button className="icon-btn" onClick={() => a.openSheet({ type: "task", preset: { due: date } })} aria-label="Задача"><CheckSquare size={17} /></button>
        </div>
      </div>
      {!items.length && !tasks.length && !habs.length && <Empty title="Ничего не запланировано" text="Нажмите «＋», чтобы добавить событие или задачу" />}
      {items.length > 0 && <div className="group">{items.map((i) => <EventRow key={i.kind + i.id} it={i} today={today} />)}</div>}
      {tasks.length > 0 && (
        <>
          <div className="ghead">Задачи</div>
          <div className="group"><AnimatePresence initial={false}>{tasks.map((t) => <TaskRow key={t.id} t={t} scope="cal" showSrc />)}</AnimatePresence></div>
        </>
      )}
      {habs.length > 0 && (
        <>
          <div className="ghead">Привычки</div>
          <div className="group">{habs.map((h) => <HabitRow key={h.id} h={h} date={date} scope="cal" />)}</div>
        </>
      )}
    </div>
  );
}

/* ---------- месяц ---------- */
function MonthView({ date, from, to, map }: { date: string; from: string; to: string; map: Record<string, CalItem[]> }) {
  const { data, today } = useStore();
  const s = data.settings;
  const [, m] = ymd(date);
  const order = Array.from({ length: 7 }, (_, i) => (s.weekStart + i) % 7).filter((i) => s.showWeekends || i < 5);
  const weeks: string[][] = [];
  for (let d = from; d <= to; d = addD(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addD(d, i)).filter((x) => s.showWeekends || dow(x) < 5));
  const cols = order.length;
  const grid = { gridTemplateColumns: `${s.weekNumbers ? "28px " : ""}repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${weeks.length}, minmax(0, 1fr))` };
  return (
    <div className="month-layout">
      <div className="month" style={grid}>
        {s.weekNumbers && <div className="m-wd wk">№</div>}
        {order.map((i) => <div key={i} className={cx("m-wd", i > 4 && "wknd")}>{WD[i]}</div>)}
        {weeks.map((w) => (
          <MonthWeek key={w[0]} w={w} m={m} map={map} today={today} sel={date} wn={s.weekNumbers} />
        ))}
      </div>
      <div className="month-side"><DayPanel date={date} map={map} /></div>
    </div>
  );
}
function MonthWeek({ w, m, map, today, sel, wn }: { w: string[]; m: number; map: Record<string, CalItem[]>; today: string; sel: string; wn: boolean }) {
  const { a } = useStore();
  return (
    <>
      {wn && <div className="m-wn">{isoWeek(w[0])}</div>}
      {w.map((d) => {
        const its = map[d] ?? [];
        const [, dm, dd] = ymd(d);
        const MAX = 3;
        return (
          <div
            key={d} role="button" tabIndex={0}
            className={cx("m-cell", dm !== m && "off", d === today && "today", d === sel && "sel", dow(d) > 4 && "wknd")}
            onClick={() => (d === sel ? a.setUi({ calView: "day", calDate: d }) : a.setUi({ calDate: d }))}
            onDoubleClick={() => a.openSheet({ type: "event", preset: { date: d } })}
            onKeyDown={(e) => e.key === "Enter" && a.setUi({ calDate: d })}
          >
            <div className="m-num"><span>{dd === 1 ? `${dd} ${MGEN[dm - 1].slice(0, 3)}` : dd}</span></div>
            <div className="m-chips">
              {its.slice(0, MAX).map((it) => <ItemChip key={it.kind + it.id} it={it} compact />)}
              {its.length > MAX && <span className="m-more">ещё {its.length - MAX}</span>}
            </div>
            <div className="m-dots">{its.slice(0, 4).map((it, i) => <i key={i} style={{ background: it.color }} />)}</div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- год ---------- */
function YearView({ date, map }: { date: string; map: Record<string, CalItem[]> }) {
  const { data, today, a } = useStore();
  const s = data.settings;
  const y = ymd(date)[0];
  const order = Array.from({ length: 7 }, (_, i) => (s.weekStart + i) % 7);
  return (
    <div className="year">
      {Array.from({ length: 12 }, (_, mi) => {
        const first = `${y}-${String(mi + 1).padStart(2, "0")}-01`;
        const off = (dow(first) - s.weekStart + 7) % 7;
        const dim = daysInMonth(y, mi + 1);
        const cur = today.startsWith(first.slice(0, 7));
        return (
          <motion.div key={mi} className="y-month" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mi * 0.025 }}>
            <button className={cx("y-title", cur && "cur")} onClick={() => a.setUi({ calView: "month", calDate: first })}>{MONTHS[mi]}</button>
            <div className="y-grid">
              {order.map((i) => <em key={i}>{WD[i][0]}</em>)}
              {Array.from({ length: off }, (_, i) => <span key={"o" + i} />)}
              {Array.from({ length: dim }, (_, i) => {
                const d = `${y}-${String(mi + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const n = (map[d] ?? []).length;
                return <button key={d} className={cx("y-day", d === today && "today", n > 0 && "has", n > 2 && "many")} onClick={() => a.gotoDay(d, "day")}>{i + 1}</button>;
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------- сводка ---------- */
function AgendaView({ from, to, map, onMore }: { from: string; to: string; map: Record<string, CalItem[]>; onMore: () => void }) {
  const { data, today } = useStore();
  const days = Object.keys(map).filter((d) => map[d].length).sort();
  const all = days.flatMap((d) => map[d]);
  const evN = all.filter((i) => i.kind === "event").length;
  const tN = all.filter((i) => i.kind === "task" && !i.done).length;
  const gN = all.filter((i) => i.kind === "goal").length;
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const free = span - days.length;
  return (
    <div className="agenda">
      <div className="ag-sum">
        <div><b>{evN}</b><span>{plural(evN, "событие", "события", "событий")}</span></div>
        <div><b>{tN}</b><span>{plural(tN, "задача", "задачи", "задач")}</span></div>
        <div><b>{gN}</b><span>{plural(gN, "дедлайн", "дедлайна", "дедлайнов")}</span></div>
        <div><b>{free}</b><span>{plural(free, "свободный день", "свободных дня", "свободных дней")}</span></div>
      </div>
      {!days.length && <Empty icon="🗓️" title="В этом периоде ничего нет" text="Добавьте события или задачи, либо загляните вперёд" />}
      {days.map((d, k) => {
        const evs = map[d].filter((i) => i.kind !== "task");
        const tasks = map[d].filter((i) => i.kind === "task").map((i) => data.tasks.find((t) => t.id === i.id)).filter((t) => !!t);
        return (
          <motion.div key={d} className="ag-day" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(k, 8) * 0.03 }}>
            <div className={cx("ag-head", d === today && "today")}><b>{relDay(d, today)}</b><span>{d === today || relDay(d, today) === fmtShort(d) ? fmtHuman(d) : fmtShort(d)}</span></div>
            <div className="group">
              {evs.map((i) => <EventRow key={i.kind + i.id + d} it={i} today={today} />)}
              <AnimatePresence initial={false}>{tasks.map((t) => <TaskRow key={t!.id} t={t!} scope="agenda" showSrc />)}</AnimatePresence>
            </div>
          </motion.div>
        );
      })}
      <button className="btn ghost wide" onClick={onMore}><Plus size={16} />Показать ещё 30 дней</button>
    </div>
  );
}

/* ---------- оболочка ---------- */
export function CalendarView() {
  const { data, ui, today, a } = useStore();
  const s = data.settings;
  const view = ui.calView;
  const date = ui.calDate;
  const [dir, setDir] = useState(1);
  const [agendaDays, setAgendaDays] = useState(30);

  const r = useMemo(() => rangeFor(view, date, s, agendaDays), [view, date, s, agendaDays]);
  const map = useMemo(() => buildDayMap(data, s, r.from, r.to), [data, s, r.from, r.to]);
  const title = titleFor(view, date, r.from, r.to, r.days);

  const go = (n: number) => { setDir(n); a.setUi({ calDate: stepDate(view, date, n) }); };
  const goToday = () => { setDir(date < today ? 1 : -1); a.setUi({ calDate: today }); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || ui.sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, CalView> = { d: "day", "3": "3days", w: "week", m: "month", y: "year", a: "agenda" };
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key.toLowerCase() === "t") goToday();
      else if (e.key.toLowerCase() === "n") a.openSheet({ type: "event", preset: { date } });
      else if (map[e.key.toLowerCase()]) a.setUi({ calView: map[e.key.toLowerCase()] });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, date, ui.sheet, today]);

  const onPanEnd = (_: unknown, i: PanInfo) => {
    if (Math.abs(i.offset.x) > 70 && Math.abs(i.offset.x) > Math.abs(i.offset.y) * 1.6) go(i.offset.x < 0 ? 1 : -1);
  };

  const anchor = view === "month" ? monthStart(date) : view === "year" ? date.slice(0, 4) : view === "agenda" ? "agenda" : view === "week" ? r.from : date;
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -36 }),
  };

  return (
    <div className="cal">
      <div className="cal-bar">
        <div className="cal-title">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.h2 key={title.main + title.sub} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <b>{title.main}</b> {title.sub && <span>{title.sub}</span>}
            </motion.h2>
          </AnimatePresence>
        </div>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Назад"><ChevronLeft size={19} /></button>
          <button className="btn ghost sm today-btn" onClick={goToday}>Сегодня</button>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Вперёд"><ChevronRight size={19} /></button>
        </div>
      </div>

      <div className="cal-tools">
        <Segmented small value={view} onChange={(v) => a.setUi({ calView: v })} options={VIEWS} />
        <div className="layers">
          <label><Switch on={s.showTasksInCal} onChange={(v) => a.updateSettings({ showTasksInCal: v })} label="Задачи" />Задачи</label>
          <label><Switch on={s.showGoalsInCal} onChange={(v) => a.updateSettings({ showGoalsInCal: v })} label="Цели" />Цели</label>
        </div>
      </div>

      <motion.div className="cal-body" onPanEnd={onPanEnd} style={{ touchAction: "pan-y" }}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={view + anchor} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18, ease: "easeOut" }} className="cal-pane">
            {view === "month" && <MonthView date={date} from={r.from} to={r.to} map={map} />}
            {(view === "day" || view === "3days" || view === "week") && <TimeGrid days={r.days} map={map} today={today} />}
            {view === "year" && <YearView date={date} map={map} />}
            {view === "agenda" && <AgendaView from={r.from} to={r.to} map={map} onMore={() => setAgendaDays((n) => n + 30)} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
