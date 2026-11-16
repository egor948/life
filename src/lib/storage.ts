import { DEFAULT_SETTINGS, type AppData, type NotificationItem } from "./types";
import { normalizeImport } from "./backup";

/**
 * Локальное хранилище Life.
 * На GitHub Pages нет сервера и базы данных, поэтому все данные
 * сохраняются прямо на устройстве (localStorage) и доступны офлайн.
 */
export const DATA_KEY = "life.data.v1";
export const NOTIFS_KEY = "life.notifications.v1";
export const LAST_CHECK_KEY = "life.lastCheck";
export const NOTIFS_ON_KEY = "life.notificationsEnabled";

export function localTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function emptyData(): AppData {
  return {
    tasks: [],
    events: [],
    goals: [],
    subs: [],
    lists: [],
    habits: [],
    settings: { ...DEFAULT_SETTINGS, tz: localTz() },
  };
}

export function normalizeData(raw: unknown): AppData | null {
  const normalized = normalizeImport(raw);
  if (!normalized) return null;
  return {
    ...normalized,
    settings: {
      ...DEFAULT_SETTINGS,
      ...normalized.settings,
      tz: normalized.settings.tz || localTz(),
    },
  };
}

export function loadData(): { data: AppData; fresh: boolean } {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const data = normalizeData(JSON.parse(raw));
      if (data) return { data, fresh: false };
    }
  } catch {
    /* приватный режим или повреждённые данные */
  }
  return { data: emptyData(), fresh: true };
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadNotifs(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is NotificationItem =>
        !!n && typeof n === "object" && typeof n.id === "number" && typeof n.key === "string",
    );
  } catch {
    return [];
  }
}

export function saveNotifs(items: NotificationItem[]) {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(items.slice(0, 120)));
  } catch {
    /* ignore */
  }
}

export function loadLastCheck(): number {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLastCheck(ms: number) {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIFS_ON_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(NOTIFS_ON_KEY, "1");
    else localStorage.removeItem(NOTIFS_ON_KEY);
  } catch {
    /* ignore */
  }
}
