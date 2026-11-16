export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const MGEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WDF = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export const pad = (n: number) => String(n).padStart(2, "0");
export const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const utc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addD = (s: string, n: number) => {
  const t = new Date(utc(s) + n * 864e5);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
export const diffDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);
/** 0 = понедельник */
export const dow = (s: string) => (new Date(utc(s)).getUTCDay() + 6) % 7;
export const daysInMonth = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
export const ymd = (s: string) => s.split("-").map(Number) as [number, number, number];
export const monthStart = (s: string) => s.slice(0, 8) + "01";
export const addMonths = (s: string, n: number) => {
  const [y, m, d] = ymd(s);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const yy = t.getUTCFullYear(), mm = t.getUTCMonth() + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d, daysInMonth(yy, mm)))}`;
};
export const addYears = (s: string, n: number) => addMonths(s, n * 12);
/** weekStart: 0 = понедельник, 6 = воскресенье */
export const startOfWeek = (s: string, weekStart: number) => addD(s, -((dow(s) - weekStart + 7) % 7));
export const isoWeek = (s: string) => {
  const t = new Date(utc(s));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - y0) / 864e5 + 1) / 7);
};
export const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addD(d, 1)) out.push(d);
  return out;
};

export const fmtHuman = (s: string) => {
  const [, m, d] = ymd(s);
  return `${d} ${MGEN[m - 1]}`;
};
export const fmtShort = (s: string) => `${WD[dow(s)]}, ${fmtHuman(s)}`;
export const fmtLong = (s: string) => `${WDF[dow(s)]}, ${fmtHuman(s)}`;
export const fmtTime = (hm: string, use12h = false) => {
  if (!hm) return "";
  if (!use12h) return hm;
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
export const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (n: number) => {
  const v = Math.max(0, Math.min(1439, Math.round(n)));
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
};
export const relDay = (s: string, today: string) => {
  const d = diffDays(today, s);
  if (d === 0) return "Сегодня";
  if (d === 1) return "Завтра";
  if (d === -1) return "Вчера";
  return fmtShort(s);
};

export function plural(n: number, one: string, few: string, many: string) {
  const m = Math.abs(n) % 100, d = m % 10;
  if (m > 10 && m < 20) return many;
  if (d > 1 && d < 5) return few;
  if (d === 1) return one;
  return many;
}
/** «15 минут», «1 час», «2 дня» (форма для «за … до» / «через …») */
export function fmtDuration(min: number) {
  if (min > 0 && min % 10080 === 0) { const n = min / 10080; return `${n} ${plural(n, "неделю", "недели", "недель")}`; }
  if (min > 0 && min % 1440 === 0) { const n = min / 1440; return `${n} ${plural(n, "день", "дня", "дней")}`; }
  if (min > 0 && min % 60 === 0) { const n = min / 60; return `${n} ${plural(n, "час", "часа", "часов")}`; }
  return `${min} ${plural(min, "минуту", "минуты", "минут")}`;
}
export function reminderLabel(min: number) {
  return min === 0 ? "В момент события" : `За ${fmtDuration(min)}`;
}
export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/* ---------- часовые пояса ---------- */
function tzOffsetMs(ms: number, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  dtf.formatToParts(ms).forEach((x) => { p[x.type] = x.value; });
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - Math.floor(ms / 1000) * 1000;
}
export function safeTz(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}
/** локальные дата+время в заданном поясе → epoch ms */
export function localToMs(date: string, hm: string, tz: string) {
  const [y, m, d] = ymd(date);
  const [h, mi] = (hm || "00:00").split(":").map(Number);
  const zone = safeTz(tz);
  const guess = Date.UTC(y, m - 1, d, h || 0, mi || 0);
  const off = tzOffsetMs(guess, zone);
  let ms = guess - off;
  const off2 = tzOffsetMs(ms, zone);
  if (off2 !== off) ms = guess - off2;
  return ms;
}
export function msToLocal(ms: number, tz: string) {
  const zone = safeTz(tz);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p: Record<string, string> = {};
  dtf.formatToParts(ms).forEach((x) => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
export function inQuiet(hm: string, from: string, to: string) {
  if (!from || !to || from === to) return false;
  return from < to ? hm >= from && hm < to : hm >= from || hm < to;
}
