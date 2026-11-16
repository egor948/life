export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";
export const REPEAT_LABELS: Record<Repeat, string> = {
  none: "Не повторять",
  daily: "Каждый день",
  weekdays: "По будням",
  weekly: "Каждую неделю",
  biweekly: "Раз в 2 недели",
  monthly: "Каждый месяц",
  yearly: "Каждый год",
};

export interface Reminder {
  id: string;
  /** за сколько минут до начала */
  minutes: number;
}
export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  due: string | null;
  time: string;
  prio: number;
  done: boolean;
  doneAt: number;
  listId: string | null;
  goalId: string | null;
  subId: string | null;
  repeat: Repeat;
  reminders: Reminder[];
  checklist: ChecklistItem[];
  spawnedId: string | null;
  createdAt: number;
}

export interface CalEvent {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  allDay: boolean;
  start: string;
  end: string;
  color: string;
  notes: string;
  location: string;
  repeat: Repeat;
  repeatUntil: string | null;
  reminders: Reminder[];
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  icon: string;
  color: string;
  notes: string;
  target: string | null;
  archived: boolean;
  createdAt: number;
}
export interface Sub {
  id: string;
  goalId: string;
  title: string;
  position: number;
}
export interface List {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}
export interface Habit {
  id: string;
  title: string;
  icon: string;
  color: string;
  days: number[];
  times: string[];
  checks: string[];
  goalId: string | null;
  archived: boolean;
  createdAt: number;
}

export type Tab = "today" | "calendar" | "tasks" | "goals" | "habits" | "stats";
export type CalView = "day" | "3days" | "week" | "month" | "year" | "agenda";

export interface Settings {
  name: string;
  theme: "auto" | "light" | "dark" | "black";
  accent: string;
  radius: "sharp" | "normal" | "round";
  fontScale: number;
  density: "compact" | "cozy" | "roomy";
  motion: "full" | "reduced" | "off";
  background: "plain" | "aurora" | "mesh";
  weekStart: 0 | 6;
  use12h: boolean;
  startTab: Tab;
  calView: CalView;
  dayStart: number;
  dayEnd: number;
  weekNumbers: boolean;
  showWeekends: boolean;
  showTasksInCal: boolean;
  showGoalsInCal: boolean;
  undoSeconds: number;
  taskReminders: number[];
  eventReminders: number[];
  allDayTime: string;
  eventMinutes: number;
  quietFrom: string;
  quietTo: string;
  snoozeMinutes: number;
  tz: string;
}

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  theme: "auto",
  accent: "#0A84FF",
  radius: "normal",
  fontScale: 1,
  density: "cozy",
  motion: "full",
  background: "aurora",
  weekStart: 0,
  use12h: false,
  startTab: "today",
  calView: "month",
  dayStart: 8,
  dayEnd: 22,
  weekNumbers: false,
  showWeekends: true,
  showTasksInCal: true,
  showGoalsInCal: true,
  undoSeconds: 6,
  taskReminders: [],
  eventReminders: [15],
  allDayTime: "09:00",
  eventMinutes: 60,
  quietFrom: "",
  quietTo: "",
  snoozeMinutes: 10,
  tz: "UTC",
};

export interface AppData {
  tasks: Task[];
  events: CalEvent[];
  goals: Goal[];
  subs: Sub[];
  lists: List[];
  habits: Habit[];
  settings: Settings;
}
export type Entity = "tasks" | "events" | "goals" | "subs" | "lists" | "habits";
export type EntityMap = {
  tasks: Task;
  events: CalEvent;
  goals: Goal;
  subs: Sub;
  lists: List;
  habits: Habit;
};

export interface NotificationItem {
  id: number;
  key: string;
  kind: string;
  title: string;
  body: string;
  refType: string | null;
  refId: string | null;
  fireAt: number;
  readAt: number | null;
  createdAt: number;
  /** Когда локальное уведомление реально показано (для отложенных). */
  deliveredAt?: number | null;
}

export type SyncOp =
  | { e: Entity; t: "put"; id: string; row: unknown }
  | { e: Entity; t: "del"; id: string }
  | { e: "settings"; t: "put"; id: "main"; row: Settings };

export const PALETTE = ["#0A84FF", "#30D158", "#FF9F0A", "#FF375F", "#BF5AF2", "#64D2FF", "#FFD60A", "#AC8E68"];
