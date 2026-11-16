"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { newEvent, newGoal, newHabit, newList, newSub, newTask, uid } from "@/lib/factory";
import { REPEAT_LABELS, PALETTE, type CalEvent, type Goal, type Habit, type List, type Reminder, type Repeat, type Sub, type Task } from "@/lib/types";
import { WD, addD, diffDays, dow, dstr, fmtHuman, fromMin, startOfWeek, toMin } from "@/lib/time";
import { habitBest, habitRate, habitStreak } from "@/lib/derive";
import { useStore } from "@/store/store";
import { EmojiPicker, Fld, Segmented, Sheet, Swatches, Switch, cx, vars } from "./ui";
import { RemindersEditor } from "./Reminders";
import { SettingsSheet } from "./SettingsSheet";
import { SearchSheet } from "./SearchSheet";
import { NotifsSheet } from "./NotifsSheet";
import { AddSheet } from "./AddSheet";

const defRems = (m: number[]): Reminder[] => m.map((x) => ({ id: uid(), minutes: x }));

function Footer({ onDelete, onSave, saveText = "Сохранить", extra }: { onDelete?: () => void; onSave: () => void; saveText?: string; extra?: React.ReactNode }) {
  return (
    <>
      {onDelete && <button className="btn danger" onClick={onDelete}><Trash2 size={16} />Удалить</button>}
      {extra}
      <button className="btn primary" onClick={onSave}>{saveText}</button>
    </>
  );
}

function DateChips({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const { today } = useStore();
  const opts = [
    { l: "Сегодня", d: today }, { l: "Завтра", d: addD(today, 1) }, { l: "Через неделю", d: addD(today, 7) },
  ];
  return (
    <div className="chips-inline">
      {opts.map((o) => (
        <button type="button" key={o.l} className={cx("chip sm", value === o.d && "on")} onClick={() => onChange(o.d)}>{o.l}</button>
      ))}
      {value && <button type="button" className="chip sm" onClick={() => onChange(null)}><X size={12} />Без срока</button>}
    </div>
  );
}

/* ================= Задача ================= */
function TaskEditor({ id, preset }: { id?: string; preset?: Partial<Task> }) {
  const { data, a } = useStore();
  const s = data.settings;
  const existing = id ? data.tasks.find((x) => x.id === id) : undefined;
  const [t, setT] = useState<Task>(() =>
    existing ? { ...existing, reminders: existing.reminders.map((r) => ({ ...r })), checklist: existing.checklist.map((c) => ({ ...c })) }
      : newTask({ ...preset, reminders: preset?.reminders ?? (preset?.due ? defRems(s.taskReminders) : []) }));
  const touched = useRef(false);
  const [newItem, setNewItem] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!existing) setTimeout(() => titleRef.current?.focus(), 350); }, [existing]);
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const setDue = (due: string | null) =>
    setT((x) => ({
      ...x, due,
      ...(due && !x.due && !x.reminders.length && !touched.current ? { reminders: defRems(s.taskReminders) } : {}),
      ...(!due ? { time: "", repeat: "none" as Repeat, reminders: [] } : {}),
    }));
  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    set({ checklist: [...t.checklist, { id: uid(), title: v, done: false }] });
    setNewItem("");
  };
  const save = () => {
    if (!t.title.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    a.saveTask({ ...t, title: t.title.trim(), notes: t.notes.trim(), reminders: t.due ? t.reminders : [] });
    a.closeSheet();
    a.toast("Сохранено");
  };
  const goalVal = t.goalId ? `${t.goalId}|${t.subId ?? ""}` : "";
  return (
    <Sheet title={existing ? "Задача" : "Новая задача"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { a.deleteTask(existing.id); a.closeSheet(); } : undefined} />}>
      <Fld label="Название">
        <input ref={titleRef} className="inpt big" placeholder="Что нужно сделать?" value={t.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} />
      </Fld>
      <Fld label="Срок">
        <div className="inline-2">
          <input className="inpt" type="date" value={t.due ?? ""} onChange={(e) => setDue(e.target.value || null)} />
          <input className="inpt" type="time" value={t.time} disabled={!t.due} onChange={(e) => set({ time: e.target.value })} />
        </div>
        <DateChips value={t.due} onChange={setDue} />
      </Fld>
      <Fld label="Приоритет">
        <Segmented value={t.prio} onChange={(v) => set({ prio: v })} options={[{ v: 0, label: "Нет" }, { v: 1, label: "Низкий" }, { v: 2, label: "Средний" }, { v: 3, label: "Высокий" }]} />
      </Fld>
      <Fld label="Напоминания" hint={t.due ? (t.time ? undefined : `Без времени напоминания отсчитываются от ${s.allDayTime}`) : undefined}>
        <RemindersEditor value={t.reminders} disabled={!t.due} hint={!t.due ? "Укажите срок, чтобы добавить напоминания" : undefined}
          onChange={(v) => { touched.current = true; set({ reminders: v }); }} />
      </Fld>
      <Fld label="Повтор">
        <select className="inpt" value={t.repeat} disabled={!t.due} onChange={(e) => set({ repeat: e.target.value as Repeat })}>
          {(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
        </select>
      </Fld>
      <Fld label="Подзадачи">
        <div className="cl">
          {t.checklist.map((c) => (
            <div className="cl-row" key={c.id}>
              <button type="button" className={cx("cl-chk", c.done && "on")} onClick={() => set({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} aria-label="Отметить" />
              <input className="cl-in" value={c.title} onChange={(e) => set({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)) })} />
              <button type="button" className="icon-btn plain sm" onClick={() => set({ checklist: t.checklist.filter((x) => x.id !== c.id) })}><X size={14} /></button>
            </div>
          ))}
          <div className="cl-row add">
            <Plus size={16} className="mut" />
            <input className="cl-in" placeholder="Добавить пункт" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} onBlur={addItem} />
          </div>
        </div>
      </Fld>
      <div className="inline-2">
        <Fld label="Список">
          <select className="inpt" value={t.listId ?? ""} onChange={(e) => set({ listId: e.target.value || null })}>
            <option value="">Входящие</option>
            {data.lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
          </select>
        </Fld>
        <Fld label="Цель">
          <select className="inpt" value={goalVal} onChange={(e) => { const [g, sb] = e.target.value.split("|"); set({ goalId: g || null, subId: sb || null }); }}>
            <option value="">— не привязано —</option>
            {data.goals.filter((g) => !g.archived || g.id === t.goalId).map((g) => (
              [<option key={g.id} value={`${g.id}|`}>{g.icon} {g.title}</option>,
                ...data.subs.filter((x) => x.goalId === g.id).map((x) => <option key={x.id} value={`${g.id}|${x.id}`}>&nbsp;&nbsp;↳ {x.title}</option>)]
            ))}
          </select>
        </Fld>
      </div>
      <Fld label="Заметка">
        <textarea className="inpt" rows={3} placeholder="Необязательно" value={t.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Fld>
      {t.due && existing && (
        <button className="btn ghost wide" onClick={() => a.gotoDay(t.due!, "day")}><CalendarDays size={16} />Показать в календаре · {fmtHuman(t.due)}</button>
      )}
    </Sheet>
  );
}

/* ================= Событие ================= */
function EventEditor({ id, preset }: { id?: string; preset?: Partial<CalEvent> }) {
  const { data, today, now, ui, a } = useStore();
  const s = data.settings;
  const existing = id ? data.events.find((x) => x.id === id) : undefined;
  const [e, setE] = useState<CalEvent>(() => {
    if (existing) return { ...existing, endDate: existing.endDate || existing.date, reminders: existing.reminders.map((r) => ({ ...r })) };
    const date = preset?.date || ui.calDate || today;
    const nd = new Date(now);
    const nextHour = Math.min(23, nd.getHours() + 1);
    const start = preset?.allDay ? "" : preset?.start ?? (date === today ? `${String(nextHour).padStart(2, "0")}:00` : "09:00");
    const end = preset?.end ?? (start ? fromMin(Math.min(1439, toMin(start) + s.eventMinutes)) : "");
    return newEvent({ ...preset, date, endDate: preset?.endDate || date, start, end, color: preset?.color ?? PALETTE[0], reminders: preset?.reminders ?? defRems(s.eventReminders) });
  });
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!existing) setTimeout(() => titleRef.current?.focus(), 350); }, [existing]);
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  const setStartTime = (v: string) => setE((x) => {
    if (!v) return { ...x, start: v };
    const dur = x.start && x.end ? toMin(x.end) - toMin(x.start) : s.eventMinutes;
    const d = dur > 0 ? dur : s.eventMinutes;
    return { ...x, start: v, end: fromMin(Math.min(1439, toMin(v) + d)) };
  });
  const setDate = (v: string) => setE((x) => {
    if (!v) return x;
    const span = Math.max(0, diffDays(x.date, x.endDate || x.date));
    return { ...x, date: v, endDate: addD(v, span) };
  });
  const save = () => {
    if (!e.title.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    const endDate = e.endDate && e.endDate > e.date ? e.endDate : null;
    let allDay = e.allDay || !e.start;
    if (!allDay && !endDate && e.end && e.end <= e.start) { a.toast("Конец должен быть позже начала", { kind: "error" }); return; }
    if (endDate && !e.allDay && !e.start) allDay = true;
    a.saveEvent({
      ...e, title: e.title.trim(), notes: e.notes.trim(), location: e.location.trim(), endDate, allDay,
      start: allDay ? "" : e.start, end: allDay ? "" : e.end,
      repeatUntil: e.repeat === "none" ? null : e.repeatUntil || null,
    });
    a.closeSheet();
    a.toast("Сохранено");
  };
  return (
    <Sheet title={existing ? "Событие" : "Новое событие"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { a.deleteEvent(existing.id); a.closeSheet(); } : undefined} />}>
      <Fld label="Название">
        <input ref={titleRef} className="inpt big" placeholder="Новое событие" value={e.title} onChange={(ev) => set({ title: ev.target.value })} onKeyDown={(ev) => ev.key === "Enter" && save()} />
      </Fld>
      <Fld>
        <div className="srow tight"><div className="srow-l">Весь день</div><div className="srow-r"><Switch on={e.allDay} onChange={(v) => set(v ? { allDay: true } : { allDay: false, start: e.start || "09:00", end: e.end || fromMin(toMin(e.start || "09:00") + s.eventMinutes) })} /></div></div>
      </Fld>
      <Fld label="Начало">
        <div className="inline-2">
          <input className="inpt" type="date" value={e.date} onChange={(ev) => setDate(ev.target.value)} />
          {!e.allDay && <input className="inpt" type="time" value={e.start} onChange={(ev) => setStartTime(ev.target.value)} />}
        </div>
      </Fld>
      <Fld label="Конец">
        <div className="inline-2">
          <input className="inpt" type="date" min={e.date} value={e.endDate || e.date} onChange={(ev) => set({ endDate: ev.target.value || e.date })} />
          {!e.allDay && <input className="inpt" type="time" value={e.end} onChange={(ev) => set({ end: ev.target.value })} />}
        </div>
      </Fld>
      <Fld label="Место">
        <input className="inpt" placeholder="Необязательно" value={e.location} onChange={(ev) => set({ location: ev.target.value })} />
      </Fld>
      <Fld label="Напоминания" hint={e.allDay || !e.start ? `Для событий на весь день отсчёт идёт от ${s.allDayTime}` : undefined}>
        <RemindersEditor value={e.reminders} onChange={(v) => set({ reminders: v })} />
      </Fld>
      <div className="inline-2">
        <Fld label="Повтор">
          <select className="inpt" value={e.repeat} onChange={(ev) => set({ repeat: ev.target.value as Repeat })}>
            {(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
          </select>
        </Fld>
        {e.repeat !== "none" && (
          <Fld label="Повторять до">
            <input className="inpt" type="date" min={e.date} value={e.repeatUntil ?? ""} onChange={(ev) => set({ repeatUntil: ev.target.value || null })} />
          </Fld>
        )}
      </div>
      <Fld label="Цвет"><Swatches value={e.color} onChange={(c) => set({ color: c })} /></Fld>
      <Fld label="Заметка">
        <textarea className="inpt" rows={3} placeholder="Необязательно" value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} />
      </Fld>
    </Sheet>
  );
}

/* ================= Цель / подцель ================= */
function GoalEditor({ id }: { id?: string }) {
  const { data, a } = useStore();
  const existing = id ? data.goals.find((x) => x.id === id) : undefined;
  const [g, setG] = useState<Goal>(() => existing ? { ...existing } : newGoal());
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }));
  const save = () => {
    if (!g.title.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    a.saveGoal({ ...g, title: g.title.trim() });
    a.closeSheet();
    a.toast("Сохранено");
  };
  return (
    <Sheet title={existing ? "Цель" : "Новая цель"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { if (confirm("Удалить цель? Задачи сохранятся.")) { a.deleteGoal(existing.id); a.closeSheet(); } } : undefined}
        extra={existing ? <button className="btn ghost" onClick={() => { a.saveGoal({ ...g, archived: !g.archived }); a.closeSheet(); }}>{g.archived ? "Вернуть" : "В архив"}</button> : undefined} />}>
      <Fld label="Название"><input className="inpt big" placeholder="Например, Пробежать полумарафон" value={g.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!existing} /></Fld>
      <Fld label="Иконка"><EmojiPicker value={g.icon} onChange={(v) => set({ icon: v })} /></Fld>
      <Fld label="Цвет"><Swatches value={g.color} onChange={(c) => set({ color: c })} /></Fld>
      <Fld label="Дедлайн цели" hint="Дедлайн появится в календаре">
        <input className="inpt" type="date" value={g.target ?? ""} onChange={(e) => set({ target: e.target.value || null })} />
      </Fld>
      <Fld label="Заметка"><textarea className="inpt" rows={3} value={g.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Зачем эта цель?" /></Fld>
    </Sheet>
  );
}

function SubEditor({ goalId, id }: { goalId: string; id?: string }) {
  const { data, a } = useStore();
  const existing = id ? data.subs.find((x) => x.id === id) : undefined;
  const [s, setS] = useState<Sub>(() => existing ? { ...existing } : newSub({ goalId, position: data.subs.filter((x) => x.goalId === goalId).length }));
  const save = () => {
    if (!s.title.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    a.saveSub({ ...s, title: s.title.trim() });
    a.closeSheet();
  };
  return (
    <Sheet title={existing ? "Подцель" : "Новая подцель"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { a.deleteSub(existing.id); a.closeSheet(); } : undefined} />}>
      <Fld label="Название"><input className="inpt big" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus placeholder="Например, Аудирование" /></Fld>
    </Sheet>
  );
}

/* ================= Список ================= */
function ListEditor({ id }: { id?: string }) {
  const { data, a } = useStore();
  const existing = id ? data.lists.find((x) => x.id === id) : undefined;
  const [l, setL] = useState<List>(() => existing ? { ...existing } : newList({ position: data.lists.length, color: PALETTE[data.lists.length % PALETTE.length], icon: "📋" }));
  const save = () => {
    if (!l.name.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    a.saveList({ ...l, name: l.name.trim() });
    a.closeSheet();
  };
  return (
    <Sheet title={existing ? "Список" : "Новый список"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { a.deleteList(existing.id); a.closeSheet(); } : undefined} />}>
      <Fld label="Название"><input className="inpt big" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus placeholder="Например, Работа" /></Fld>
      <Fld label="Иконка"><EmojiPicker value={l.icon} onChange={(v) => setL({ ...l, icon: v })} /></Fld>
      <Fld label="Цвет"><Swatches value={l.color} onChange={(c) => setL({ ...l, color: c })} /></Fld>
    </Sheet>
  );
}

/* ================= Привычка ================= */
function HabitHeat({ h, today }: { h: Habit; today: string }) {
  const { data } = useStore();
  const from = startOfWeek(addD(today, -7 * 15), data.settings.weekStart);
  const cells: string[] = [];
  for (let d = from; d <= today; d = addD(d, 1)) cells.push(d);
  return (
    <div className="hheat" style={vars({ "--c": h.color })}>
      {cells.map((d) => (
        <i key={d} title={fmtHuman(d)} className={cx(h.checks.includes(d) && "on", !h.days.includes(dow(d)) && "off")} />
      ))}
    </div>
  );
}

function HabitEditor({ id }: { id?: string }) {
  const { data, today, a } = useStore();
  const existing = id ? data.habits.find((x) => x.id === id) : undefined;
  const [h, setH] = useState<Habit>(() => existing ? { ...existing, times: [...existing.times] } : newHabit({ color: PALETTE[1] }));
  const set = (p: Partial<Habit>) => setH((x) => ({ ...x, ...p }));
  const save = () => {
    if (!h.title.trim()) { a.toast("Введите название", { kind: "error" }); return; }
    if (!h.days.length) { a.toast("Выберите хотя бы один день", { kind: "error" }); return; }
    a.saveHabit({ ...h, title: h.title.trim(), times: [...new Set(h.times.filter(Boolean))].sort() });
    a.closeSheet();
    a.toast("Сохранено");
  };
  const stat = existing ? { st: habitStreak(h, today), best: habitBest(h, today), r30: habitRate(h, addD(today, -29), today), total: h.checks.length } : null;
  return (
    <Sheet title={existing ? "Привычка" : "Новая привычка"} onClose={a.closeSheet}
      footer={<Footer onSave={save} onDelete={existing ? () => { a.deleteHabit(existing.id); a.closeSheet(); } : undefined} />}>
      <Fld label="Название"><input className="inpt big" placeholder="Например, Чтение 30 минут" value={h.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!existing} /></Fld>
      {stat && (
        <div className="mini-stats">
          <div><b>🔥 {stat.st}</b><span>серия</span></div>
          <div><b>{stat.best}</b><span>рекорд</span></div>
          <div><b>{Math.round(stat.r30.pct * 100)}%</b><span>за 30 дней</span></div>
          <div><b>{stat.total}</b><span>всего</span></div>
        </div>
      )}
      {existing && <Fld label="Последние 16 недель"><HabitHeat h={h} today={today} /></Fld>}
      <Fld label="Иконка"><EmojiPicker value={h.icon} onChange={(v) => set({ icon: v })} /></Fld>
      <Fld label="Цвет"><Swatches value={h.color} onChange={(c) => set({ color: c })} /></Fld>
      <Fld label="Дни недели">
        <div className="days-pick">
          {WD.map((d, i) => (
            <button type="button" key={d} className={cx(h.days.includes(i) && "on")} style={vars({ "--c": h.color })}
              onClick={() => set({ days: h.days.includes(i) ? h.days.filter((x) => x !== i) : [...h.days, i].sort() })}>{d}</button>
          ))}
        </div>
      </Fld>
      <Fld label="Напоминания (время)" hint="Напоминание не придёт, если привычка уже отмечена">
        <div className="cl">
          {h.times.map((t, i) => (
            <div className="cl-row" key={i}>
              <input className="inpt tm" type="time" value={t} onChange={(e) => set({ times: h.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="icon-btn plain sm" onClick={() => set({ times: h.times.filter((_, j) => j !== i) })}><X size={14} /></button>
            </div>
          ))}
          <button type="button" className="chip sm accent" onClick={() => set({ times: [...h.times, "09:00"] })}><Plus size={12} />Добавить время</button>
        </div>
      </Fld>
      <Fld label="Цель">
        <select className="inpt" value={h.goalId ?? ""} onChange={(e) => set({ goalId: e.target.value || null })}>
          <option value="">— не привязана —</option>
          {data.goals.filter((g) => !g.archived).map((g) => <option key={g.id} value={g.id}>{g.icon} {g.title}</option>)}
        </select>
      </Fld>
      {existing && <Fld><div className="srow tight"><div className="srow-l">В архиве<small>Скрыть из списка и напоминаний</small></div><div className="srow-r"><Switch on={h.archived} onChange={(v) => set({ archived: v })} /></div></div></Fld>}
    </Sheet>
  );
}

/* ================= Хост ================= */
export function SheetHost() {
  const { ui } = useStore();
  const s = ui.sheet;
  return (
    <AnimatePresence>
      {s && (
        s.type === "task" ? <TaskEditor key={"t" + (s.id ?? "new" + JSON.stringify(s.preset))} id={s.id} preset={s.preset} />
        : s.type === "event" ? <EventEditor key={"e" + (s.id ?? "new" + JSON.stringify(s.preset))} id={s.id} preset={s.preset} />
        : s.type === "goal" ? <GoalEditor key={"g" + s.id} id={s.id} />
        : s.type === "sub" ? <SubEditor key={"s" + s.id} goalId={s.goalId} id={s.id} />
        : s.type === "list" ? <ListEditor key={"l" + s.id} id={s.id} />
        : s.type === "habit" ? <HabitEditor key={"h" + s.id} id={s.id} />
        : s.type === "settings" ? <SettingsSheet key="settings" />
        : s.type === "search" ? <SearchSheet key="search" />
        : s.type === "notifs" ? <NotifsSheet key="notifs" />
        : <AddSheet key="add" />
      )}
    </AnimatePresence>
  );
}

export { dstr };
