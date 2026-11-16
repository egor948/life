import type { CalEvent, Repeat } from "./types";
import { addD, addMonths, daysInMonth, diffDays, dow, ymd } from "./time";

export function occursOn(repeat: Repeat, base: string, d: string, until?: string | null) {
  if (d < base) return false;
  if (until && d > until) return false;
  switch (repeat) {
    case "none": return d === base;
    case "daily": return true;
    case "weekdays": return dow(d) < 5;
    case "weekly": return diffDays(base, d) % 7 === 0;
    case "biweekly": return diffDays(base, d) % 14 === 0;
    case "monthly": {
      const [, , bd] = ymd(base); const [y, m, dd] = ymd(d);
      return dd === Math.min(bd, daysInMonth(y, m));
    }
    case "yearly": {
      const [, bm, bd] = ymd(base); const [y, m, dd] = ymd(d);
      return m === bm && dd === Math.min(bd, daysInMonth(y, m));
    }
  }
}

export interface Occ {
  ev: CalEvent;
  date: string;
  endDate: string;
}

export function eventOccurrences(ev: CalEvent, from: string, to: string): Occ[] {
  const end = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
  const span = diffDays(ev.date, end);
  if (ev.repeat === "none") return ev.date <= to && end >= from ? [{ ev, date: ev.date, endDate: end }] : [];
  const out: Occ[] = [];
  let d = addD(from, -span);
  if (d < ev.date) d = ev.date;
  for (; d <= to; d = addD(d, 1)) {
    if (occursOn(ev.repeat, ev.date, d, ev.repeatUntil)) out.push({ ev, date: d, endDate: addD(d, span) });
  }
  return out;
}

function step(repeat: Repeat, d: string): string {
  switch (repeat) {
    case "daily": return addD(d, 1);
    case "weekdays": { let n = addD(d, 1); while (dow(n) > 4) n = addD(n, 1); return n; }
    case "weekly": return addD(d, 7);
    case "biweekly": return addD(d, 14);
    case "monthly": return addMonths(d, 1);
    case "yearly": return addMonths(d, 12);
    default: return d;
  }
}
/** следующая дата повторяющейся задачи */
export function nextDue(repeat: Repeat, due: string, today: string) {
  let n = step(repeat, due);
  if (due <= today) {
    let guard = 0;
    while (n <= today && guard++ < 800) n = step(repeat, n);
  }
  return n;
}
