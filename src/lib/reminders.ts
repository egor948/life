import type { CalEvent, Habit, Task } from "./types";
import { addD, fmtDuration, fmtHuman, localToMs, msToLocal, diffDays, dow } from "./time";
import { eventOccurrences } from "./recur";

export interface Fire {
  key: string;
  kind: "task" | "event" | "habit";
  refId: string;
  title: string;
  body: string;
  at: number;
}

function when(date: string, time: string | null, today: string) {
  const d = diffDays(today, date);
  const day = d === 0 ? "сегодня" : d === 1 ? "завтра" : d === -1 ? "вчера" : fmtHuman(date);
  return time ? `${day} в ${time}` : `${day}, весь день`;
}
function lead(minutes: number) {
  return minutes === 0 ? "Сейчас" : `Через ${fmtDuration(minutes)}`;
}

export function computeFires(
  d: { tasks: Task[]; events: CalEvent[]; habits: Habit[] },
  s: { allDayTime: string; tz: string },
  from: number,
  to: number,
): Fire[] {
  const out: Fire[] = [];
  const local = (ms: number) => msToLocal(ms, s.tz).date;
  const today = local(to);

  for (const t of d.tasks) {
    if (t.done || !t.due || !t.reminders?.length) continue;
    const base = localToMs(t.due, t.time || s.allDayTime, s.tz);
    for (const r of t.reminders) {
      const at = base - r.minutes * 60000;
      if (at > from && at <= to) {
        out.push({
          key: `task:${t.id}:${r.id}:${r.minutes}:${t.due}${t.time}`,
          kind: "task", refId: t.id, title: t.title, at,
          body: `${lead(r.minutes)} · ${when(t.due, t.time || null, today)}`,
        });
      }
    }
  }

  for (const ev of d.events) {
    if (!ev.reminders?.length) continue;
    for (const r of ev.reminders) {
      const ld = r.minutes * 60000;
      const d1 = addD(local(from + ld), -1);
      const d2 = addD(local(to + ld), 1);
      for (const o of eventOccurrences(ev, d1, d2)) {
        const time = ev.allDay ? null : ev.start || null;
        const base = localToMs(o.date, time || s.allDayTime, s.tz);
        const at = base - ld;
        if (at > from && at <= to) {
          out.push({
            key: `event:${ev.id}:${r.id}:${r.minutes}:${o.date}${ev.start}`,
            kind: "event", refId: ev.id, title: ev.title, at,
            body: `${lead(r.minutes)} · ${when(o.date, time, today)}${ev.location ? " · " + ev.location : ""}`,
          });
        }
      }
    }
  }

  const dFrom = local(from), dTo = local(to);
  for (const h of d.habits) {
    if (h.archived || !h.times?.length) continue;
    for (let day = dFrom; day <= dTo; day = addD(day, 1)) {
      if (!h.days.includes(dow(day)) || h.checks.includes(day)) continue;
      for (const time of h.times) {
        const at = localToMs(day, time, s.tz);
        if (at > from && at <= to) {
          out.push({
            key: `habit:${h.id}:${time}:${day}`,
            kind: "habit", refId: h.id, title: h.title, at,
            body: "Время для привычки",
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
