import { DEFAULT_SETTINGS, type AppData } from "./types";
import { newEvent, newGoal, newHabit, newList, newSub, newTask } from "./factory";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Принимает бэкап нового формата и экспорт старой версии (lifeos.v1) */
export function normalizeImport(raw: any): AppData | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.tasks)) return null;
  const arr = (x: any) => (Array.isArray(x) ? x : []);
  const lists = arr(raw.lists).map((l: any, i: number) => newList({ ...l, icon: l.icon ?? "", position: l.position ?? i }));
  const goals = arr(raw.goals).map((g: any) => newGoal({ ...g, icon: g.icon ?? "🎯", notes: g.notes ?? "", target: g.target || null }));
  const subs = arr(raw.subs).map((s: any, i: number) => newSub({ ...s, position: s.position ?? i }));
  const tasks = arr(raw.tasks).map((t: any) =>
    newTask({
      ...t, due: t.due || null, time: t.time || "", reminders: Array.isArray(t.reminders) ? t.reminders : [],
      checklist: Array.isArray(t.checklist) ? t.checklist : [], repeat: t.repeat || "none", spawnedId: t.spawnedId ?? null,
    }));
  const events = arr(raw.events).map((e: any) =>
    newEvent({
      ...e, allDay: e.allDay ?? !e.start, endDate: e.endDate || null, start: e.start || "", end: e.end || "",
      reminders: Array.isArray(e.reminders) ? e.reminders : [], location: e.location || "", repeat: e.repeat || "none", repeatUntil: e.repeatUntil || null,
    }));
  const habits = arr(raw.habits).map((h: any) =>
    newHabit({
      ...h, icon: h.icon ?? "✨",
      checks: Array.isArray(h.checks) ? h.checks : Object.keys(h.checks || {}).filter((k) => h.checks[k]),
      times: Array.isArray(h.times) ? h.times : h.time ? [h.time] : [],
      days: Array.isArray(h.days) && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6], goalId: h.goalId ?? null, archived: !!h.archived,
    }));
  const rs = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const settings = { ...DEFAULT_SETTINGS, ...(rs.tz !== undefined || rs.accent ? rs : {}) };
  return { tasks, events, goals, subs, lists, habits, settings };
}
