import type { AppData, CalEvent, Goal, Habit, List, Settings, Sub, Task } from "./types";
import { addD, dow, dstr, toMin } from "./time";
import { eventOccurrences, type Occ } from "./recur";

/* ---------- задачи ↔ списки ↔ цели ---------- */
export const GRAY = "#8E8E93";
export function taskList(t: Task, lists: List[]) { return lists.find((l) => l.id === t.listId) || null; }
export function taskGoal(t: Task, goals: Goal[]) { return goals.find((g) => g.id === t.goalId) || null; }
export function taskSub(t: Task, subs: Sub[]) { return subs.find((s) => s.id === t.subId) || null; }
export function taskColor(t: Task, d: Pick<AppData, "lists" | "goals">) {
  return taskList(t, d.lists)?.color || taskGoal(t, d.goals)?.color || GRAY;
}
export function taskSource(t: Task, d: Pick<AppData, "lists" | "goals" | "subs">) {
  const g = taskGoal(t, d.goals);
  if (g) { const s = taskSub(t, d.subs); return `${g.icon || "🎯"} ${g.title}${s ? " · " + s.title : ""}`; }
  const l = taskList(t, d.lists);
  return l ? `${l.icon ? l.icon + " " : ""}${l.name}` : "Входящие";
}
export function goalProgress(goalId: string, tasks: Task[]) {
  const ts = tasks.filter((t) => t.goalId === goalId);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, pct: ts.length ? done / ts.length : 0 };
}
export function subProgress(subId: string, tasks: Task[]) {
  const ts = tasks.filter((t) => t.subId === subId);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, pct: ts.length ? done / ts.length : 0 };
}
export function countdown(target: string | null, today: string) {
  if (!target) return "";
  const d = Math.round((Date.parse(target + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
  const p = (n: number, a: string, b: string, c: string) => { const m = n % 100, x = m % 10; return m > 10 && m < 20 ? c : x === 1 ? a : x > 1 && x < 5 ? b : c; };
  if (d < 0) return `просрочено на ${-d} ${p(-d, "день", "дня", "дней")}`;
  if (d === 0) return "срок сегодня";
  return `${p(d, "остался", "осталось", "осталось")} ${d} ${p(d, "день", "дня", "дней")}`;
}

/* ---------- привычки ---------- */
export function habitStart(h: Habit) {
  const c = dstr(new Date(h.createdAt));
  const first = h.checks.length ? h.checks.slice().sort()[0] : c;
  return first < c ? first : c;
}
export const isScheduled = (h: Habit, date: string) => h.days.includes(dow(date));
export function habitStreak(h: Habit, today: string) {
  let d = today;
  if (!h.checks.includes(d)) d = addD(d, -1);
  let n = 0;
  for (let i = 0; i < 2000; i++) {
    if (!isScheduled(h, d)) { d = addD(d, -1); continue; }
    if (h.checks.includes(d)) { n++; d = addD(d, -1); } else break;
  }
  return n;
}
export function habitBest(h: Habit, today: string) {
  let best = 0, cur = 0;
  for (let d = habitStart(h); d <= today; d = addD(d, 1)) {
    if (!isScheduled(h, d)) continue;
    if (h.checks.includes(d)) { cur++; best = Math.max(best, cur); } else if (d !== today) cur = 0;
  }
  return best;
}
/** доля выполненных запланированных дней за период */
export function habitRate(h: Habit, from: string, to: string) {
  let plan = 0, done = 0;
  const start = habitStart(h);
  for (let d = from < start ? start : from; d <= to; d = addD(d, 1)) {
    if (!isScheduled(h, d)) continue;
    plan++;
    if (h.checks.includes(d)) done++;
  }
  return { plan, done, pct: plan ? done / plan : 0 };
}

/* ---------- элементы календаря ---------- */
export interface CalItem {
  kind: "event" | "task" | "goal";
  id: string;
  title: string;
  color: string;
  date: string;
  allDay: boolean;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
  done?: boolean;
  location?: string;
  repeat?: boolean;
  occ?: Occ;
  firstDay?: boolean;
  lastDay?: boolean;
}

export function buildDayMap(
  data: Pick<AppData, "events" | "tasks" | "goals" | "lists">,
  s: Pick<Settings, "showTasksInCal" | "showGoalsInCal" | "eventMinutes">,
  from: string,
  to: string,
) {
  const map: Record<string, CalItem[]> = {};
  const push = (it: CalItem) => { (map[it.date] ||= []).push(it); };

  for (const ev of data.events) {
    for (const occ of eventOccurrences(ev, from, to)) {
      const multi = occ.date !== occ.endDate;
      const timed = !ev.allDay && !!ev.start && !multi;
      const sMin = timed ? toMin(ev.start) : 0;
      let eMin = timed ? (ev.end ? toMin(ev.end) : sMin + s.eventMinutes) : 1440;
      if (timed && eMin <= sMin) eMin = Math.min(1440, sMin + 30);
      for (let d = occ.date < from ? from : occ.date; d <= occ.endDate && d <= to; d = addD(d, 1)) {
        push({
          kind: "event", id: ev.id, title: ev.title || "Без названия", color: ev.color, date: d,
          allDay: !timed, startMin: sMin, endMin: eMin, start: ev.allDay ? "" : ev.start,
          end: ev.allDay ? "" : ev.end, location: ev.location, repeat: ev.repeat !== "none",
          occ, firstDay: d === occ.date, lastDay: d === occ.endDate,
        });
      }
    }
  }
  if (s.showTasksInCal) {
    for (const t of data.tasks) {
      if (!t.due || t.due < from || t.due > to) continue;
      const timed = !!t.time;
      const sMin = timed ? toMin(t.time) : 0;
      push({
        kind: "task", id: t.id, title: t.title, color: taskColor(t, data), date: t.due, allDay: !timed,
        startMin: sMin, endMin: timed ? Math.min(1440, sMin + 30) : 1440, start: t.time, end: "", done: t.done,
        repeat: t.repeat !== "none",
      });
    }
  }
  if (s.showGoalsInCal) {
    for (const g of data.goals) {
      if (!g.target || g.archived || g.target < from || g.target > to) continue;
      push({ kind: "goal", id: g.id, title: `${g.icon || "🎯"} ${g.title}`, color: g.color, date: g.target, allDay: true, startMin: 0, endMin: 1440, start: "", end: "" });
    }
  }
  const rank = { event: 0, goal: 1, task: 2 } as const;
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) =>
      a.allDay !== b.allDay ? (a.allDay ? -1 : 1)
      : a.allDay ? rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title)
      : a.startMin - b.startMin || a.endMin - b.endMin);
  }
  return map;
}

export type { CalEvent };
