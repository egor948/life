import { addD } from "./time";

/** Быстрый ввод: «Позвонить маме завтра 18:30 !!» */
export function parseQuick(text: string, today: string) {
  let title = ` ${text.trim()} `;
  let due: string | null = null;
  let time = "";
  let prio = 0;
  const words: [RegExp, number][] = [
    [/(\s)(послезавтра)(?=\s)/i, 2],
    [/(\s)(завтра)(?=\s)/i, 1],
    [/(\s)(сегодня)(?=\s)/i, 0],
  ];
  for (const [re, n] of words) {
    if (re.test(title)) { due = addD(today, n); title = title.replace(re, " "); break; }
  }
  const tm = title.match(/(\s)(?:в\s+)?(\d{1,2}):(\d{2})(?=\s)/i);
  if (tm) {
    const h = Math.min(23, Number(tm[2]));
    time = `${String(h).padStart(2, "0")}:${tm[3]}`;
    title = title.replace(tm[0], " ");
    if (!due) due = today;
  }
  const pm = title.match(/(\s)(!{1,3})(?=\s)/);
  if (pm) { prio = pm[2].length; title = title.replace(pm[0], " "); }
  return { title: title.replace(/\s+/g, " ").trim(), due, time, prio };
}
