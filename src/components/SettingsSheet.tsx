"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing, CheckCircle2, Download, Eraser, Share, Smartphone, Sparkles, Upload, WifiOff } from "lucide-react";
import { useStore } from "@/store/store";
import { DEFAULT_SETTINGS, PALETTE, type CalView, type Reminder, type Settings, type Tab } from "@/lib/types";
import { uid } from "@/lib/factory";
import { normalizeImport } from "@/lib/backup";
import { disablePush, currentSubscription, enablePush, pushSupported } from "@/lib/push-client";
import { RemindersEditor } from "./Reminders";
import { Row, Segmented, Sheet, Swatches, Switch, vars } from "./ui";

const ACCENTS = ["#0A84FF", "#5E5CE6", "#BF5AF2", "#FF375F", "#FF9F0A", "#30D158", "#00C7BE", "#AC8E68"];
const TABS: { v: Tab; label: string }[] = [
  { v: "today", label: "Сегодня" }, { v: "calendar", label: "Календарь" }, { v: "tasks", label: "Задачи" },
  { v: "goals", label: "Цели" }, { v: "habits", label: "Привычки" }, { v: "stats", label: "Статистика" },
];
const VIEWS: { v: CalView; label: string }[] = [
  { v: "day", label: "День" }, { v: "3days", label: "3 дня" }, { v: "week", label: "Неделя" },
  { v: "month", label: "Месяц" }, { v: "year", label: "Год" }, { v: "agenda", label: "Сводка" },
];
const hours = Array.from({ length: 24 }, (_, i) => i);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sgroup">
      <h3>{title}</h3>
      <div className="sbox">{children}</div>
    </section>
  );
}

function NumRems({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [list, setList] = useState<Reminder[]>(() => value.map((m) => ({ id: uid(), minutes: m })));
  return <RemindersEditor value={list} onChange={(v) => { setList(v); onChange(v.map((r) => r.minutes)); }} />;
}

export function SettingsSheet() {
  const { data, a } = useStore();
  const s = data.settings;
  const set = (p: Partial<Settings>) => a.updateSettings(p);
  const [perm, setPerm] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [standalone] = useState(() => {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      );
    } catch {
      return false;
    }
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    void currentSubscription().then((x) => setSubscribed(!!x));
  }, []);

  const enable = async () => {
    const r = await enablePush();
    setPerm(typeof Notification !== "undefined" ? Notification.permission : "default");
    setSubscribed(!!(await currentSubscription()));
    a.toast(r.error ?? "Уведомления включены", { kind: r.ok && !r.error ? "success" : "info", ms: 5000 });
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `life-backup-${new Date().toISOString().slice(0, 10)}.json`;
    el.click();
    URL.revokeObjectURL(el.href);
    a.toast("Бэкап сохранён", { kind: "success" });
  };
  const importJson = async (f: File) => {
    try {
      const d = normalizeImport(JSON.parse(await f.text()));
      if (!d) throw new Error("bad");
      if (!confirm(`Заменить все данные? Задач: ${d.tasks.length}, событий: ${d.events.length}, привычек: ${d.habits.length}.`)) return;
      a.replaceAll({ ...d, settings: { ...d.settings, tz: s.tz } });
    } catch {
      a.toast("Не удалось прочитать файл", { kind: "error" });
    }
  };

  return (
    <Sheet title="Настройки" onClose={a.closeSheet} size="lg">
      <Group title="Профиль">
        <Row label="Ваше имя" hint="Для приветствия на главной">
          <input className="inpt sm-in" value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="Егор" />
        </Row>
      </Group>

      <Group title="Оформление">
        <Row label="Тема">
          <Segmented small value={s.theme} onChange={(v) => set({ theme: v })} options={[{ v: "auto", label: "Авто" }, { v: "light", label: "Светлая" }, { v: "dark", label: "Тёмная" }, { v: "black", label: "OLED" }]} />
        </Row>
        <div className="srow col">
          <div className="srow-l"><div>Акцентный цвет</div></div>
          <Swatches value={s.accent} colors={ACCENTS} onChange={(c) => set({ accent: c })} />
          <label className="custom-color"><input type="color" value={s.accent} onChange={(e) => set({ accent: e.target.value })} /> Свой цвет · {s.accent.toUpperCase()}</label>
        </div>
        <Row label="Фон">
          <Segmented small value={s.background} onChange={(v) => set({ background: v })} options={[{ v: "plain", label: "Чистый" }, { v: "aurora", label: "Аврора" }, { v: "mesh", label: "Меш" }]} />
        </Row>
        <Row label="Скругления">
          <Segmented small value={s.radius} onChange={(v) => set({ radius: v })} options={[{ v: "sharp", label: "Строгие" }, { v: "normal", label: "Обычные" }, { v: "round", label: "Круглые" }]} />
        </Row>
        <Row label="Плотность">
          <Segmented small value={s.density} onChange={(v) => set({ density: v })} options={[{ v: "compact", label: "Компакт" }, { v: "cozy", label: "Обычная" }, { v: "roomy", label: "Свободная" }]} />
        </Row>
        <Row label="Размер текста" hint={`${Math.round(s.fontScale * 100)}%`}>
          <input className="range" type="range" min={0.85} max={1.25} step={0.05} value={s.fontScale} onChange={(e) => set({ fontScale: Number(e.target.value) })} style={vars({ "--p": `${((s.fontScale - 0.85) / 0.4) * 100}%` })} />
        </Row>
        <Row label="Анимации" hint="«Мягкие» — только плавное появление, без движения">
          <Segmented small value={s.motion} onChange={(v) => set({ motion: v })} options={[{ v: "full", label: "Полные" }, { v: "reduced", label: "Мягкие" }, { v: "off", label: "Выкл" }]} />
        </Row>
      </Group>

      <Group title="Календарь и время">
        <Row label="Неделя начинается с">
          <Segmented small value={s.weekStart} onChange={(v) => set({ weekStart: v })} options={[{ v: 0, label: "Пн" }, { v: 6, label: "Вс" }]} />
        </Row>
        <Row label="Формат времени">
          <Segmented small value={s.use12h ? "12" : "24"} onChange={(v) => set({ use12h: v === "12" })} options={[{ v: "24", label: "24 ч" }, { v: "12", label: "12 ч" }]} />
        </Row>
        <Row label="Открывать при запуске">
          <select className="inpt sm-in" value={s.startTab} onChange={(e) => set({ startTab: e.target.value as Tab })}>{TABS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
        </Row>
        <Row label="Вид календаря по умолчанию">
          <select className="inpt sm-in" value={s.calView} onChange={(e) => set({ calView: e.target.value as CalView })}>{VIEWS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
        </Row>
        <Row label="Рабочие часы в сетке" hint="Сетка дня/недели прокручивается к началу">
          <div className="inline-2 narrow">
            <select className="inpt sm-in" value={s.dayStart} onChange={(e) => set({ dayStart: Number(e.target.value) })}>{hours.map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
            <select className="inpt sm-in" value={s.dayEnd} onChange={(e) => set({ dayEnd: Number(e.target.value) })}>{hours.map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
          </div>
        </Row>
        <Row label="Длительность события по умолчанию">
          <select className="inpt sm-in" value={s.eventMinutes} onChange={(e) => set({ eventMinutes: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} мин</option>)}
          </select>
        </Row>
        <Row label="Показывать выходные"><Switch on={s.showWeekends} onChange={(v) => set({ showWeekends: v })} /></Row>
        <Row label="Номера недель"><Switch on={s.weekNumbers} onChange={(v) => set({ weekNumbers: v })} /></Row>
        <Row label="Задачи в календаре" hint="Задачи со сроком видны рядом с событиями"><Switch on={s.showTasksInCal} onChange={(v) => set({ showTasksInCal: v })} /></Row>
        <Row label="Дедлайны целей в календаре"><Switch on={s.showGoalsInCal} onChange={(v) => set({ showGoalsInCal: v })} /></Row>
      </Group>

      <Group title="Задачи">
        <Row label="Время на отмену выполнения" hint="Выполненная задача остаётся на месте, зачёркнутой, и затем уходит в «Выполнено»">
          <Segmented small value={s.undoSeconds} onChange={(v) => set({ undoSeconds: v })} options={[0, 3, 6, 10, 15].map((v) => ({ v, label: v ? `${v} с` : "Сразу" }))} />
        </Row>
      </Group>

      <Group title="Напоминания">
        <div className="srow col"><div className="srow-l"><div>Для новых задач</div><small>Добавляются автоматически, когда указан срок</small></div><NumRems value={s.taskReminders} onChange={(v) => set({ taskReminders: v })} /></div>
        <div className="srow col"><div className="srow-l"><div>Для новых событий</div></div><NumRems value={s.eventReminders} onChange={(v) => set({ eventReminders: v })} /></div>
        <Row label="Время для дел «на весь день»" hint="От него отсчитываются напоминания">
          <input className="inpt sm-in" type="time" value={s.allDayTime} onChange={(e) => set({ allDayTime: e.target.value || "09:00" })} />
        </Row>
        <Row label="Отложить на" hint="Кнопка «Отложить» в центре уведомлений">
          <select className="inpt sm-in" value={s.snoozeMinutes} onChange={(e) => set({ snoozeMinutes: Number(e.target.value) })}>{[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} мин</option>)}</select>
        </Row>
        <Row label="Тихие часы" hint="В это время системные уведомления не показываются, но напоминания остаются в истории">
          <div className="inline-2 narrow">
            <input className="inpt sm-in" type="time" value={s.quietFrom} onChange={(e) => set({ quietFrom: e.target.value })} />
            <input className="inpt sm-in" type="time" value={s.quietTo} onChange={(e) => set({ quietTo: e.target.value })} />
          </div>
        </Row>
        <div className="srow col">
          <div className="srow-l">
            <div>Системные уведомления</div>
            <small>
              {perm === "granted" ? (subscribed ? "Включены · уведомления и история сохраняются на устройстве" : "Разрешены · показываются, когда Life открыт") : perm === "denied" ? "Заблокированы в настройках браузера" : "Выключены"}
              {!pushSupported() && " · на iPhone добавьте Life на экран «Домой»"}
            </small>
          </div>
          <div className="btn-row">
            {(perm !== "granted" || !subscribed) && perm !== "denied" && <button className="btn primary sm" onClick={enable}><BellRing size={15} />Включить</button>}
            {subscribed && <button className="btn ghost sm" onClick={async () => { await disablePush(); setSubscribed(false); a.toast("Уведомления отключены"); }}>Отключить</button>}
            <button className="btn ghost sm" onClick={() => { void a.notifAction({ action: "test" }); a.toast("Тест отправлен"); }}>Тестовое уведомление</button>
          </div>
        </div>
      </Group>

      <Group title="Life на iPhone">
        <div className="srow col">
          <div className="srow-l">
            <div>Установка как приложение</div>
            <small>
              {standalone
                ? "Life открыт с экрана «Домой» — работает без адресной строки и без интернета."
                : "Safari → «Поделиться» → «На экран „Домой“». Приложение запустится в полноэкранном режиме."}
            </small>
          </div>
          {standalone ? (
            <div className="install-status"><CheckCircle2 size={16} /> Установлено · офлайн-режим активен</div>
          ) : (
            <div className="install-steps">
              <div><b>1</b><span><Share size={16} />Откройте Life в Safari</span></div>
              <div><b>2</b><span><Share size={16} />Нажмите «Поделиться»</span></div>
              <div><b>3</b><span><Smartphone size={16} />Выберите «На экран „Домой“»</span></div>
            </div>
          )}
          <small className="hint install-hint"><WifiOff size={14} />Задачи, цели и привычки хранятся только на этом устройстве и доступны офлайн. Резервная копия — кнопка «Экспорт» ниже.</small>
        </div>
      </Group>

      <Group title="Данные">
        <div className="srow col">
          <div className="btn-row">
            <button className="btn ghost sm" onClick={exportJson}><Download size={15} />Экспорт</button>
            <button className="btn ghost sm" onClick={() => fileRef.current?.click()}><Upload size={15} />Импорт</button>
            <button className="btn ghost sm" onClick={() => { if (confirm("Заменить данные демо-набором?")) a.loadDemo(); }}><Sparkles size={15} />Демо-данные</button>
            <button className="btn danger sm" onClick={() => { if (confirm("Удалить все данные Life? Это необратимо.")) a.replaceAll({ tasks: [], events: [], goals: [], subs: [], lists: [], habits: [], settings: s }); }}><Eraser size={15} />Удалить всё</button>
          </div>
          <small className="hint">Импорт понимает и бэкапы этой версии, и экспорт старой версии LifeOS.</small>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
        </div>
        <Row label="Сбросить оформление и настройки">
          <button className="btn ghost sm" onClick={() => { a.updateSettings({ ...DEFAULT_SETTINGS, tz: s.tz, name: s.name }); a.toast("Настройки сброшены"); }}>Сбросить</button>
        </Row>
      </Group>
      <div className="about">Life · офлайн-PWA · данные хранятся на этом устройстве · акцентов: {PALETTE.length}</div>
    </Sheet>
  );
}
