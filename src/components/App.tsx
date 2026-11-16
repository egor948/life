"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";
import { BarChart3, Bell, CalendarDays, Flame, ListChecks, Plus, Search, Settings as Cog, Sparkles, Target, CloudOff, Loader2 } from "lucide-react";
import type { AppData, Tab } from "@/lib/types";
import { fmtLong } from "@/lib/time";
import { StoreProvider, useStore } from "@/store/store";
import { TodayView } from "./TodayView";
import { CalendarView } from "./CalendarView";
import { TasksView } from "./TasksView";
import { GoalsView } from "./GoalsView";
import { HabitsView } from "./HabitsView";
import { StatsView } from "./StatsView";
import { SheetHost } from "./Editors";
import { ToastHost, cx } from "./ui";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "today", label: "Сегодня", icon: <Sparkles size={22} /> },
  { id: "calendar", label: "Календарь", icon: <CalendarDays size={22} /> },
  { id: "tasks", label: "Задачи", icon: <ListChecks size={22} /> },
  { id: "goals", label: "Цели", icon: <Target size={22} /> },
  { id: "habits", label: "Привычки", icon: <Flame size={22} /> },
  { id: "stats", label: "Статистика", icon: <BarChart3 size={22} /> },
];

function greet(h: number) {
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

function ThemeApplier() {
  const { data } = useStore();
  const s = data.settings;
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = s.theme === "dark" || s.theme === "black" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = s.theme === "black" ? "black" : dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", s.theme === "black" ? "#000000" : dark ? "#0b0b0e" : "#f2f2f7");
    };
    apply();
    root.dataset.radius = s.radius;
    root.dataset.density = s.density;
    root.dataset.bg = s.background;
    root.dataset.motion = s.motion;
    root.style.setProperty("--accent", s.accent);
    root.style.setProperty("--fs", String(s.fontScale));
    try {
      localStorage.setItem("life.theme", JSON.stringify({ theme: s.theme, accent: s.accent, radius: s.radius, density: s.density, background: s.background, motion: s.motion, fontScale: s.fontScale }));
    } catch { /* */ }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [s.theme, s.accent, s.radius, s.density, s.background, s.motion, s.fontScale]);
  return null;
}

export function Shell() {
  const { data, ui, now, unread, sync, a } = useStore();
  const s = data.settings;
  const tab = ui.tab;
  const nd = new Date(now);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); a.openSheet({ type: "search" }); }
      else if (!typing && !ui.sheet && e.key === "/") { e.preventDefault(); a.openSheet({ type: "search" }); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [a, ui.sheet]);

  const go = (id: Tab) => a.setUi({ tab: id, ...(id === "goals" && tab === "goals" ? { openGoal: null } : {}) });
  const title = tab === "today" ? `${greet(nd.getHours())}${s.name ? ", " + s.name : ""}` : TABS.find((t) => t.id === tab)!.label;
  const sub = tab === "today" ? fmtLong(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`) : null;

  return (
    <MotionConfig reducedMotion={s.motion === "full" ? "never" : "always"} transition={s.motion === "off" ? { duration: 0 } : undefined}>
      <ThemeApplier />
      <div className="bg-fx" aria-hidden />
      <div className="app">
        <aside className="side">
          <div className="brand"><span className="brand-logo"><Sparkles size={18} /></span>Life</div>
          <LayoutGroup id="side">
            <nav>
              {TABS.map((t) => (
                <button key={t.id} className={cx("side-item", tab === t.id && "on")} onClick={() => go(t.id)}>
                  {tab === t.id && <motion.span layoutId="side-pill" className="side-pill" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className="side-in">{t.icon}{t.label}</span>
                </button>
              ))}
            </nav>
          </LayoutGroup>
          <div className="side-foot">
            <button className="btn primary wide" onClick={() => a.openSheet({ type: "add" })}><Plus size={17} />Создать</button>
            <div className="hint-keys">⌘K — поиск</div>
          </div>
        </aside>

        <main className={cx("main", tab === "calendar" && "wide")}>
          <header className="hdr">
            <div className="hdr-t">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
                  <h1>{title}</h1>
                  {sub && <div className="hdr-sub">{sub}</div>}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hdr-a">
              <AnimatePresence>
                {sync !== "idle" && (
                  <motion.span className={cx("sync", sync)} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    {sync === "saving" ? <Loader2 size={14} className="spin" /> : <CloudOff size={14} />}
                    <span>{sync === "saving" ? "Сохранение" : "Не сохранено"}</span>
                  </motion.span>
                )}
              </AnimatePresence>
              <button className="icon-btn" onClick={() => a.openSheet({ type: "search" })} aria-label="Поиск"><Search size={18} /></button>
              <button className="icon-btn" onClick={() => a.openSheet({ type: "notifs" })} aria-label="Уведомления">
                <Bell size={18} />
                <AnimatePresence>{unread > 0 && <motion.span className="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>{unread > 9 ? "9+" : unread}</motion.span>}</AnimatePresence>
              </button>
              <button className="icon-btn" onClick={() => a.openSheet({ type: "settings" })} aria-label="Настройки"><Cog size={18} /></button>
            </div>
          </header>

          <div className={cx("view", tab === "calendar" && "wide-view")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
                {tab === "today" && <TodayView />}
                {tab === "calendar" && <CalendarView />}
                {tab === "tasks" && <TasksView />}
                {tab === "goals" && <GoalsView />}
                {tab === "habits" && <HabitsView />}
                {tab === "stats" && <StatsView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <motion.button className="fab" onClick={() => a.openSheet({ type: "add" })} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.05 }} aria-label="Создать"><Plus size={26} strokeWidth={2.6} /></motion.button>

        <nav className="tabbar">
          <LayoutGroup id="tabbar">
            {TABS.map((t) => (
              <button key={t.id} className={cx("tab", tab === t.id && "on")} onClick={() => go(t.id)}>
                {tab === t.id && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="tab-in">{t.icon}<span>{t.label}</span></span>
              </button>
            ))}
          </LayoutGroup>
        </nav>
      </div>

      <SheetHost />
      <ToastHost />
    </MotionConfig>
  );
}

export default function App({ initial, fresh }: { initial: AppData; fresh: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="splash"><span className="brand-logo big"><Sparkles size={34} /></span></div>
    );
  }
  return (
    <StoreProvider initial={initial} fresh={fresh}>
      <Shell />
    </StoreProvider>
  );
}
