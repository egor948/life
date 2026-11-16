"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_SETTINGS, type AppData, type CalEvent, type CalView, type Entity, type EntityMap, type Goal, type Habit,
  type List, type NotificationItem, type Settings, type Sub, type SyncOp, type Tab, type Task,
} from "@/lib/types";
import { addD, dstr, inQuiet, msToLocal } from "@/lib/time";
import { newTask, uid } from "@/lib/factory";
import { nextDue } from "@/lib/recur";
import { makeDemo } from "@/lib/seed";
import { registerSW, showLocalNotification, haptic } from "@/lib/push-client";
import { computeFires } from "@/lib/reminders";
import { loadLastCheck, loadNotifs, saveData, saveLastCheck, saveNotifs } from "@/lib/storage";

export type Sheet =
  | { type: "task"; id?: string; preset?: Partial<Task> }
  | { type: "event"; id?: string; preset?: Partial<CalEvent> }
  | { type: "goal"; id?: string }
  | { type: "sub"; goalId: string; id?: string }
  | { type: "habit"; id?: string }
  | { type: "list"; id?: string }
  | { type: "settings" }
  | { type: "search" }
  | { type: "notifs" }
  | { type: "add" };

export interface UI {
  tab: Tab;
  calView: CalView;
  calDate: string;
  filter: string;
  showDone: boolean;
  sort: "date" | "prio";
  statsRange: number;
  openGoal: string | null;
  sheet: Sheet | null;
}

export interface Toast {
  id: number;
  msg: string;
  sub?: string;
  kind: "info" | "success" | "error" | "notif";
  ms: number;
  action?: { label: string; run: () => void };
}

export type SyncState = "idle" | "saving" | "error";

interface Actions {
  setUi: (p: Partial<UI>) => void;
  openSheet: (s: Sheet) => void;
  closeSheet: () => void;
  openRef: (type: string | null, id: string | null) => void;
  gotoDay: (date: string, view?: CalView) => void;
  saveTask: (t: Task) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  toggleChecklist: (taskId: string, itemId: string) => void;
  moveOverdueToToday: () => void;
  clearDone: () => void;
  saveEvent: (e: CalEvent) => void;
  deleteEvent: (id: string) => void;
  saveList: (l: List) => void;
  deleteList: (id: string) => void;
  saveGoal: (g: Goal) => void;
  deleteGoal: (id: string) => void;
  saveSub: (s: Sub) => void;
  deleteSub: (id: string) => void;
  saveHabit: (h: Habit) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (id: string, date: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  replaceAll: (d: AppData) => void;
  loadDemo: () => void;
  toast: (msg: string, o?: Partial<Omit<Toast, "id" | "msg">>) => void;
  dismissToast: (id: number) => void;
  pollNotifs: () => Promise<void>;
  notifAction: (body: Record<string, unknown>) => Promise<void>;
}

interface Store {
  data: AppData;
  ui: UI;
  now: number;
  today: string;
  toasts: Toast[];
  lingering: Record<string, number>;
  notifs: NotificationItem[];
  unread: number;
  sync: SyncState;
  a: Actions;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("store");
  return c;
};

const UI_KEY = "life.ui";

export function StoreProvider({ initial, fresh, children }: { initial: AppData; fresh: boolean; children: ReactNode }) {
  const [data, setData] = useState<AppData>(initial);
  const dataRef = useRef<AppData>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lingering, setLingering] = useState<Record<string, number>>({});
  const [notifs, setNotifs] = useState<NotificationItem[]>(() => loadNotifs());
  const notifsRef = useRef<NotificationItem[]>(notifs);
  const [sync, setSync] = useState<SyncState>("idle");
  const [ui, setUiState] = useState<UI>(() => {
    const base: UI = {
      tab: initial.settings.startTab, calView: initial.settings.calView, calDate: dstr(new Date()),
      filter: "all", showDone: true, sort: "date", statsRange: 30, openGoal: null, sheet: null,
    };
    if (typeof window === "undefined") return base;
    try {
      const s = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
      return { ...base, filter: s.filter ?? base.filter, showDone: s.showDone ?? base.showDone, sort: s.sort ?? base.sort, statsRange: s.statsRange ?? base.statsRange };
    } catch {
      return base;
    }
  });
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const today = dstr(new Date(now));
  const todayRef = useRef(today);
  todayRef.current = today;

  /* ---------- сохранение на этом устройстве ---------- */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((d: AppData) => {
    const ok = saveData(d);
    setSync(ok ? "saving" : "error");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSync(ok ? "idle" : "error"), 500);
  }, []);
  const enqueue = useCallback((_op: SyncOp) => {
    persist(dataRef.current);
  }, [persist]);

  useEffect(() => {
    const onLeave = () => saveData(dataRef.current);
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  const setNotifsSafe = useCallback((fn: (items: NotificationItem[]) => NotificationItem[]) => {
    setNotifs((prev) => {
      const next = fn(prev);
      notifsRef.current = next;
      saveNotifs(next);
      return next;
    });
  }, []);

  /* ---------- действия ---------- */
  const a = useMemo<Actions>(() => {
    const apply = (fn: (d: AppData) => AppData) => {
      const next = fn(dataRef.current);
      dataRef.current = next;
      setData(next);
    };
    const put = <K extends Entity>(e: K, row: EntityMap[K]) => {
      apply((d) => {
        const arr = d[e] as EntityMap[K][];
        const i = arr.findIndex((x) => x.id === row.id);
        const next = i >= 0 ? arr.map((x, j) => (j === i ? row : x)) : [...arr, row];
        return { ...d, [e]: next };
      });
      enqueue({ e, t: "put", id: row.id, row } as SyncOp);
    };
    const del = (e: Entity, id: string) => {
      apply((d) => ({ ...d, [e]: (d[e] as { id: string }[]).filter((x) => x.id !== id) }) as AppData);
      enqueue({ e, t: "del", id });
    };
    const lingerTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
    let tid = 1;

    const dismissToast = (id: number) => {
      const t = toastTimers.get(id);
      if (t) clearTimeout(t);
      toastTimers.delete(id);
      setToasts((l) => l.filter((x) => x.id !== id));
    };
    const toast: Actions["toast"] = (msg, o = {}) => {
      const id = tid++;
      const t: Toast = { id, msg, kind: "info", ms: 3200, ...o };
      setToasts((l) => [...l.slice(-3), t]);
      toastTimers.set(id, setTimeout(() => dismissToast(id), t.ms));
      return id as unknown as void;
    };

    const stopLinger = (id: string) => {
      const t = lingerTimers.get(id);
      if (t) clearTimeout(t);
      lingerTimers.delete(id);
      setLingering((l) => { if (!(id in l)) return l; const n = { ...l }; delete n[id]; return n; });
    };

    const undoDone = (id: string) => {
      stopLinger(id);
      const t = dataRef.current.tasks.find((x) => x.id === id);
      if (!t) return;
      put("tasks", { ...t, done: false, doneAt: 0, spawnedId: null });
      if (t.spawnedId) {
        const c = dataRef.current.tasks.find((x) => x.id === t.spawnedId);
        if (c && !c.done) del("tasks", c.id);
      }
    };

    const openSheet = (sheet: Sheet) => setUiState((u) => ({ ...u, sheet }));
    const act: Actions = {
      setUi: (p) => setUiState((u) => {
        const n = { ...u, ...p };
        try { localStorage.setItem(UI_KEY, JSON.stringify({ filter: n.filter, showDone: n.showDone, sort: n.sort, statsRange: n.statsRange })); } catch { /* */ }
        return n;
      }),
      openSheet,
      closeSheet: () => setUiState((u) => ({ ...u, sheet: null })),
      openRef: (type, id) => {
        if (!type || !id) return;
        if (type === "task") openSheet({ type: "task", id });
        else if (type === "event") openSheet({ type: "event", id });
        else if (type === "habit") { setUiState((u) => ({ ...u, tab: "habits" })); openSheet({ type: "habit", id }); }
        else if (type === "goal") setUiState((u) => ({ ...u, tab: "goals", openGoal: id, sheet: null }));
      },
      gotoDay: (date, view) => setUiState((u) => ({ ...u, tab: "calendar", calDate: date, calView: view ?? u.calView, sheet: null })),

      saveTask: (t) => put("tasks", t),
      deleteTask: (id) => {
        const t = dataRef.current.tasks.find((x) => x.id === id);
        if (!t) return;
        stopLinger(id);
        del("tasks", id);
        toast("Задача удалена", { action: { label: "Вернуть", run: () => put("tasks", t) }, ms: 5000 });
      },
      toggleTask: (id) => {
        const t = dataRef.current.tasks.find((x) => x.id === id);
        if (!t) return;
        if (t.done) { undoDone(id); return; }
        const secs = dataRef.current.settings.undoSeconds;
        const doneT: Task = { ...t, done: true, doneAt: Date.now() };
        if (t.repeat !== "none" && t.due) {
          const spawned = newTask({
            ...t, id: uid(), done: false, doneAt: 0, spawnedId: null, createdAt: Date.now(),
            due: nextDue(t.repeat, t.due, todayRef.current),
            checklist: t.checklist.map((c) => ({ ...c, done: false })),
          });
          doneT.spawnedId = spawned.id;
          put("tasks", spawned);
        }
        put("tasks", doneT);
        if (secs > 0) {
          setLingering((l) => ({ ...l, [id]: Date.now() + secs * 1000 }));
          lingerTimers.set(id, setTimeout(() => stopLinger(id), secs * 1000));
        }
        toast(t.repeat !== "none" ? "Выполнено · создана следующая" : "Задача выполнена", {
          kind: "success", ms: Math.max(2500, secs * 1000), action: { label: "Отменить", run: () => undoDone(id) },
        });
      },
      toggleChecklist: (taskId, itemId) => {
        const t = dataRef.current.tasks.find((x) => x.id === taskId);
        if (!t) return;
        put("tasks", { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) });
      },
      moveOverdueToToday: () => {
        const td = todayRef.current;
        const list = dataRef.current.tasks.filter((t) => !t.done && t.due && t.due < td);
        list.forEach((t) => put("tasks", { ...t, due: td }));
        toast(`Перенесено на сегодня: ${list.length}`, { kind: "success" });
      },
      clearDone: () => {
        const list = dataRef.current.tasks.filter((t) => t.done);
        list.forEach((t) => del("tasks", t.id));
        toast(`Удалено выполненных: ${list.length}`, { action: { label: "Вернуть", run: () => list.forEach((t) => put("tasks", t)) }, ms: 6000 });
      },

      saveEvent: (e) => put("events", e),
      deleteEvent: (id) => {
        const e = dataRef.current.events.find((x) => x.id === id);
        if (!e) return;
        del("events", id);
        toast("Событие удалено", { action: { label: "Вернуть", run: () => put("events", e) }, ms: 5000 });
      },

      saveList: (l) => put("lists", l),
      deleteList: (id) => {
        dataRef.current.tasks.filter((t) => t.listId === id).forEach((t) => put("tasks", { ...t, listId: null }));
        if (uiRef.current.filter === id) act.setUi({ filter: "all" });
        del("lists", id);
        toast("Список удалён, задачи сохранены");
      },
      saveGoal: (g) => put("goals", g),
      deleteGoal: (id) => {
        dataRef.current.tasks.filter((t) => t.goalId === id).forEach((t) => put("tasks", { ...t, goalId: null, subId: null }));
        dataRef.current.habits.filter((h) => h.goalId === id).forEach((h) => put("habits", { ...h, goalId: null }));
        dataRef.current.subs.filter((s) => s.goalId === id).forEach((s) => del("subs", s.id));
        del("goals", id);
        setUiState((u) => ({ ...u, openGoal: u.openGoal === id ? null : u.openGoal, filter: u.filter === "goal:" + id ? "all" : u.filter }));
        toast("Цель удалена, задачи сохранены");
      },
      saveSub: (s) => put("subs", s),
      deleteSub: (id) => {
        dataRef.current.tasks.filter((t) => t.subId === id).forEach((t) => put("tasks", { ...t, subId: null }));
        del("subs", id);
      },

      saveHabit: (h) => put("habits", h),
      deleteHabit: (id) => {
        const h = dataRef.current.habits.find((x) => x.id === id);
        if (!h) return;
        del("habits", id);
        toast("Привычка удалена", { action: { label: "Вернуть", run: () => put("habits", h) }, ms: 5000 });
      },
      toggleHabit: (id, date) => {
        const h = dataRef.current.habits.find((x) => x.id === id);
        if (!h) return;
        const on = h.checks.includes(date);
        put("habits", { ...h, checks: on ? h.checks.filter((d) => d !== date) : [...h.checks, date] });
      },

      updateSettings: (p) => {
        const s = { ...dataRef.current.settings, ...p };
        apply((d) => ({ ...d, settings: s }));
        enqueue({ e: "settings", t: "put", id: "main", row: s });
      },
      replaceAll: (d) => {
        apply(() => d);
        const ok = saveData(d);
        setSync(ok ? "idle" : "error");
        toast(ok ? "Данные обновлены и сохранены на устройстве" : "Не удалось сохранить данные", {
          kind: ok ? "success" : "error",
        });
      },
      loadDemo: () => {
        const s = dataRef.current.settings;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        act.replaceAll({ ...makeDemo(todayRef.current), settings: { ...s, tz } });
      },
      toast,
      dismissToast,
      pollNotifs: async () => { /* заменяется ниже */ },
      notifAction: async () => { /* заменяется ниже */ },
    };
    return act;
  }, [enqueue]);

  /* ---------- напоминания и уведомления (локально, без сервера) ---------- */
  const lastCheck = useRef(loadLastCheck());
  const notifSeq = useRef(notifsRef.current.reduce((m, n) => Math.max(m, n.id), 0) + 1);

  const pollNotifs = useCallback(async () => {
    const nowMs = Date.now();
    const d = dataRef.current;
    const st = d.settings;
    let from = lastCheck.current;
    if (!from || from > nowMs) from = nowMs - 60_000;
    if (nowMs - from > 6 * 3600e3) from = nowMs - 6 * 3600e3;
    const quiet = inQuiet(msToLocal(nowMs, st.tz).hm, st.quietFrom, st.quietTo);
    const fires = computeFires(d, st, from, nowMs);
    lastCheck.current = nowMs;
    saveLastCheck(nowMs);

    const dueSnoozes = notifsRef.current.filter(
      (n) => n.kind === "snooze" && !n.deliveredAt && n.fireAt <= nowMs,
    );

    const seen = new Set(notifsRef.current.map((n) => n.key));
    const added: NotificationItem[] = [];
    for (const f of fires) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      added.push({
        id: notifSeq.current++,
        key: f.key,
        kind: f.kind,
        title: f.title,
        body: f.body,
        refType: f.kind,
        refId: f.refId,
        fireAt: f.at,
        readAt: null,
        createdAt: nowMs,
        deliveredAt: nowMs,
      });
    }
    if (!added.length && !dueSnoozes.length) return;
    const fresh = added.slice().sort((x, y) => y.fireAt - x.fireAt);
    const dueIds = new Set(dueSnoozes.map((n) => n.id));
    setNotifsSafe((prev) => [
      ...fresh,
      ...prev.map((n) => (dueIds.has(n.id) ? { ...n, deliveredAt: nowMs } : n)),
    ].slice(0, 120));

    for (const n of [...fresh, ...dueSnoozes]) {
      const action = n.refId
        ? { label: "Открыть", run: () => a.openRef(n.refType, n.refId) }
        : undefined;
      if (!document.hidden) {
        a.toast(n.title, { kind: "notif", sub: n.body, ms: 9000, action });
      } else if (!quiet) {
        void showLocalNotification(n.title, n.body, {
          refType: n.refType,
          refId: n.refId,
          key: n.key,
        });
      }
    }
    if (!quiet) haptic();
  }, [a, setNotifsSafe]);

  const notifAction = useCallback(async (body: Record<string, unknown>) => {
    const action = String(body.action ?? "");
    const id = Number(body.id);
    const minutes = Number(body.minutes);
    const stamp = Date.now();
    if (action === "read") {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [id];
      setNotifsSafe((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt || stamp } : n)));
      return;
    }
    if (action === "readAll") {
      setNotifsSafe((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || stamp })));
      return;
    }
    if (action === "clear") {
      setNotifsSafe(() => []);
      return;
    }
    if (action === "delete") {
      setNotifsSafe((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    if (action === "snooze") {
      const n = notifsRef.current.find((x) => x.id === id);
      if (!n) return;
      const until = stamp + (Number.isFinite(minutes) && minutes > 0 ? minutes : 10) * 60_000;
      setNotifsSafe((prev) => [
        {
          id: notifSeq.current++,
          key: `snooze:${n.id}:${until}`,
          kind: "snooze",
          title: `Отложено: ${n.title}`,
          body: `Напомню через ${Number.isFinite(minutes) && minutes > 0 ? minutes : 10} мин`,
          refType: n.refType,
          refId: n.refId,
          fireAt: until,
          readAt: null,
          createdAt: stamp,
          deliveredAt: null,
        },
        ...prev.map((x) => (x.id === id ? { ...x, readAt: x.readAt || stamp } : x)),
      ]);
      // Срабатывание обработает pollNotifs — в том числе после возврата в приложение.
      return;
    }
    if (action === "test") {
      const n: NotificationItem = {
        id: notifSeq.current++,
        key: `test:${stamp}`,
        kind: "test",
        title: "Life на связи",
        body: "Тестовое уведомление. Напоминания сохраняются на этом устройстве.",
        refType: null,
        refId: null,
        fireAt: stamp,
        readAt: null,
        createdAt: stamp,
      };
      setNotifsSafe((prev) => [n, ...prev]);
      const quiet = inQuiet(msToLocal(stamp, dataRef.current.settings.tz).hm, dataRef.current.settings.quietFrom, dataRef.current.settings.quietTo);
      if (!quiet) void showLocalNotification(n.title, n.body, { key: n.key });
      return;
    }
  }, [setNotifsSafe]);
  a.pollNotifs = pollNotifs;
  a.notifAction = notifAction;

  /* ---------- жизненный цикл ---------- */
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15000);
    const vis = () => {
      if (!document.hidden) {
        setNow(Date.now());
        void pollNotifs();
      }
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("focus", vis);
    };
  }, [pollNotifs]);

  useEffect(() => {
    void pollNotifs();
    const iv = setInterval(() => { if (!document.hidden) void pollNotifs(); }, 20000);
    return () => clearInterval(iv);
  }, [pollNotifs]);

  useEffect(() => {
    void registerSW();
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; refType?: string; refId?: string };
      if (m?.type === "open") a.openRef(m.refType ?? null, m.refId ?? null);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    const q = new URLSearchParams(location.search).get("open");
    if (q) {
      const [t, id] = q.split(":");
      a.openRef(t, id);
      const clean = new URL(location.href);
      clean.searchParams.delete("open");
      history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
    }
    if (fresh) a.loadDemo();
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    if (data.settings.tz !== tz) a.updateSettings({ tz });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings.tz]);

  const unread = notifs.filter((n) => !n.readAt).length;
  useEffect(() => {
    document.title = unread ? `(${unread}) Life` : "Life";
  }, [unread]);

  const value = useMemo<Store>(
    () => ({ data, ui, now, today, toasts, lingering, notifs, unread, sync, a }),
    [data, ui, now, today, toasts, lingering, notifs, unread, sync, a],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { addD, DEFAULT_SETTINGS };
