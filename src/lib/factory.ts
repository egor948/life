import type { CalEvent, Goal, Habit, List, Sub, Task } from "./types";

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const newTask = (p: Partial<Task> = {}): Task => ({
  id: uid(), title: "", notes: "", due: null, time: "", prio: 0, done: false, doneAt: 0,
  listId: null, goalId: null, subId: null, repeat: "none", reminders: [], checklist: [],
  spawnedId: null, createdAt: Date.now(), ...p,
});
export const newEvent = (p: Partial<CalEvent> = {}): CalEvent => ({
  id: uid(), title: "", date: "", endDate: null, allDay: false, start: "", end: "", color: "#0A84FF",
  notes: "", location: "", repeat: "none", repeatUntil: null, reminders: [], createdAt: Date.now(), ...p,
});
export const newGoal = (p: Partial<Goal> = {}): Goal => ({
  id: uid(), title: "", icon: "🎯", color: "#BF5AF2", notes: "", target: null, archived: false, createdAt: Date.now(), ...p,
});
export const newSub = (p: Partial<Sub> = {}): Sub => ({ id: uid(), goalId: "", title: "", position: 0, ...p });
export const newList = (p: Partial<List> = {}): List => ({ id: uid(), name: "", color: "#0A84FF", icon: "", position: 0, ...p });
export const newHabit = (p: Partial<Habit> = {}): Habit => ({
  id: uid(), title: "", icon: "✨", color: "#30D158", days: [0, 1, 2, 3, 4, 5, 6], times: [], checks: [],
  goalId: null, archived: false, createdAt: Date.now(), ...p,
});
