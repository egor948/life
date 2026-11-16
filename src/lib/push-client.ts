import { notificationsEnabled, setNotificationsEnabled } from "./storage";

/**
 * Статическая PWA: сервера push нет, поэтому используется локальные
 * системные уведомления + service worker для офлайна и установки.
 * На iPhone уведомления показываются, пока приложение запущено
 * (в том числе при возврате в него), история напоминаний сохраняется.
 */
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator
  );
}

/** Собирает URL относительно текущей страницы — важно для GitHub Pages (/life/). */
export function assetUrl(path: string): string {
  try {
    const base = document.baseURI.endsWith("/")
      ? document.baseURI
      : document.baseURI.replace(/[^/]+$/, "");
    return new URL(path.replace(/^\//, ""), base).toString();
  } catch {
    return path.replace(/^\//, "");
  }
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(assetUrl("sw.js"), { scope: "./" });
  } catch {
    return null;
  }
}

export async function currentSubscription() {
  if (!pushSupported() || !notificationsEnabled()) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
    return reg ? { local: true } : null;
  } catch {
    return null;
  }
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return {
      ok: false,
      error: "Этот браузер не поддерживает уведомления. На iPhone добавьте приложение на экран «Домой».",
    };
  }
  try {
    const perm =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (perm !== "granted") {
      return { ok: false, error: "Разрешение на уведомления не выдано" };
    }
    setNotificationsEnabled(true);
    const reg = await registerSW();
    await navigator.serviceWorker.ready;
    if (!reg) {
      return { ok: true, error: "Service worker не запустился — уведомления будут только внутри приложения." };
    }
    return {
      ok: true,
      error: "Уведомления включены. На iPhone они срабатывают, когда приложение открыто или когда вы возвращаетесь в него.",
    };
  } catch (e) {
    return {
      ok: false,
      error: "Не удалось включить уведомления: " + (e instanceof Error ? e.message : "ошибка"),
    };
  }
}

export async function disablePush() {
  setNotificationsEnabled(false);
}

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
void b64ToUint8;

export async function showLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: assetUrl("icons/icon-192.png"),
        badge: assetUrl("icons/icon-192.png"),
        data,
        tag: typeof data.key === "string" ? data.key : undefined,
      });
    } else {
      new Notification(title, { body, icon: assetUrl("icons/icon-192.png") });
    }
  } catch {
    /* iOS может отклонить, если приложение не установлено */
  }
}

/** Короткая вибрация там, где она поддерживается (не Safari). */
export function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* ignore */
  }
}
