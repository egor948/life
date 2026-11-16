"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, BellRing, CalendarDays, CheckSquare, Clock, Flame, Trash2, X } from "lucide-react";
import { useStore } from "@/store/store";
import { computeFires } from "@/lib/reminders";
import { dstr, fmtHuman, fmtMinutes, msToLocal, relDay } from "@/lib/time";
import { enablePush } from "@/lib/push-client";
import { cx, Empty, Sheet } from "./ui";

const KIND_IC: Record<string, React.ReactNode> = {
  task: <CheckSquare size={16} />, event: <CalendarDays size={16} />, habit: <Flame size={16} />, snooze: <Clock size={16} />, test: <BellRing size={16} />,
};
const KIND_C: Record<string, string> = { task: "#0A84FF", event: "#FF9F0A", habit: "#FF375F", snooze: "#BF5AF2", test: "#30D158" };

function ago(ms: number, now: number) {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  if (m < 1440) return `${Math.floor(m / 60)} ч назад`;
  return fmtHuman(dstr(new Date(ms)));
}

export function NotifsSheet() {
  const { data, notifs, now, today, a } = useStore();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    void a.pollNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const unreadIds = notifs.filter((n) => !n.readAt).map((n) => n.id).join(",");
  useEffect(() => {
    if (!unreadIds) return;
    const t = setTimeout(() => void a.notifAction({ action: "read", ids: unreadIds.split(",").map(Number) }), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds]);
  const upcoming = useMemo(
    () => computeFires(data, data.settings, now, now + 72 * 3600e3).slice(0, 10),
    [data, now],
  );
  const enable = async () => {
    const r = await enablePush();
    setPerm(typeof Notification !== "undefined" ? Notification.permission : "default");
    a.toast(r.error ?? "Уведомления включены", { kind: r.ok && !r.error ? "success" : "info" });
  };
  const snooze = data.settings.snoozeMinutes;
  return (
    <Sheet title="Уведомления" onClose={a.closeSheet} size="lg"
      footer={<>
        <button className="btn ghost" onClick={() => void a.notifAction({ action: "readAll" })}>Прочитать все</button>
        <button className="btn danger" onClick={() => void a.notifAction({ action: "clear" })}><Trash2 size={16} />Очистить</button>
      </>}>
      {perm !== "granted" && (
        <div className="banner">
          <BellOff size={22} />
          <div><b>Системные уведомления выключены</b><small>Включите напоминания на этом устройстве. На iPhone установите Life на экран «Домой» через Safari.</small></div>
          <button className="btn primary sm" onClick={enable}>Включить</button>
        </div>
      )}
      <div className="s-sec">Ближайшие напоминания</div>
      {!upcoming.length && <div className="muted-note">На ближайшие 3 дня напоминаний нет. Добавьте их в задачах и событиях.</div>}
      {upcoming.map((f) => {
        const loc = msToLocal(f.at, data.settings.tz);
        return (
          <button key={f.key} className="n-item up" onClick={() => a.openRef(f.kind, f.refId)}>
            <span className="n-ic" style={{ background: KIND_C[f.kind] }}>{KIND_IC[f.kind]}</span>
            <div><b>{f.title}</b><small>{relDay(loc.date, today)}, {loc.hm} · {f.body.split(" · ")[0].toLowerCase()}</small></div>
            <span className="n-in">{fmtMinutes(Math.max(1, Math.round((f.at - now) / 60000)))}</span>
          </button>
        );
      })}
      <div className="s-sec">История</div>
      {!notifs.length && <Empty icon={<Bell size={28} />} title="Пока пусто" text="Сработавшие напоминания появятся здесь" />}
      <AnimatePresence initial={false}>
        {notifs.map((n) => (
          <motion.div key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }} className={cx("n-item", !n.readAt && "unread")}>
            <span className="n-ic" style={{ background: KIND_C[n.kind] ?? "#8E8E93" }}>{KIND_IC[n.kind] ?? <Bell size={16} />}</span>
            <div className="n-main" onClick={() => n.refId && a.openRef(n.refType, n.refId)}>
              <b>{n.title}</b>
              <small>{n.body}</small>
              <small className="n-ago">{ago(n.createdAt, now)}</small>
              {n.kind !== "test" && (
                <div className="n-acts">
                  <button onClick={(e) => { e.stopPropagation(); void a.notifAction({ action: "snooze", id: n.id, minutes: snooze }); a.toast(`Напомню через ${snooze} мин`); }}>Отложить на {snooze} мин</button>
                  <button onClick={(e) => { e.stopPropagation(); void a.notifAction({ action: "snooze", id: n.id, minutes: 60 }); a.toast("Напомню через час"); }}>На час</button>
                </div>
              )}
            </div>
            <button className="icon-btn plain sm" onClick={() => void a.notifAction({ action: "delete", id: n.id })} aria-label="Удалить"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </Sheet>
  );
}
