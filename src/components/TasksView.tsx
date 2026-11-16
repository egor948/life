"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "@/store/store";
import { addD } from "@/lib/time";
import type { Task } from "@/lib/types";
import { QuickAdd } from "./QuickAdd";
import { TaskRow } from "./rows";
import { Empty, Segmented, cx, vars } from "./ui";

export function TasksView() {
  const { data, ui, today, lingering, a } = useStore();
  const f = ui.filter;
  const act = (t: Task) => !t.done || !!lingering[t.id];

  const match = (t: Task, filter: string) => {
    if (filter === "today") return t.due === today;
    if (filter === "overdue") return !!t.due && t.due < today;
    if (filter === "soon") return !!t.due && t.due >= today && t.due <= addD(today, 7);
    if (filter === "inbox") return !t.listId && !t.goalId;
    if (filter.startsWith("goal:")) return t.goalId === filter.slice(5);
    if (filter === "all") return true;
    return t.listId === filter;
  };
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    const ids = ["all", "today", "overdue", "soon", "inbox", ...data.lists.map((l) => l.id), ...data.goals.filter((g) => !g.archived).map((g) => "goal:" + g.id)];
    ids.forEach((id) => { c[id] = data.tasks.filter((t) => !t.done && match(t, id)).length; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, data.lists, data.goals, today]);

  const tasks = data.tasks.filter((t) => match(t, f));
  const prioSort = (x: Task, y: Task) => y.prio - x.prio || (x.due ?? "9") .localeCompare(y.due ?? "9");
  const dateSort = (x: Task, y: Task) => (x.due ?? "9").localeCompare(y.due ?? "9") || (x.time || "99").localeCompare(y.time || "99") || y.prio - x.prio;
  const sorter = ui.sort === "prio" ? prioSort : dateSort;
  const activeT = tasks.filter(act);
  const groups = [
    { id: "over", title: "Просрочено", list: activeT.filter((t) => t.due && t.due < today), over: true, date: true },
    { id: "today", title: "Сегодня", list: activeT.filter((t) => t.due === today), date: false },
    { id: "soon", title: "Предстоящие", list: activeT.filter((t) => t.due && t.due > today), date: true },
    { id: "none", title: "Без срока", list: activeT.filter((t) => !t.due), date: false },
  ].map((g) => ({ ...g, list: g.list.slice().sort(sorter) }));
  const doneList = tasks.filter((t) => t.done && !lingering[t.id]).sort((x, y) => y.doneAt - x.doneAt);
  const shownDone = doneList.slice(0, 40);

  const curList = data.lists.find((l) => l.id === f);
  const curGoal = f.startsWith("goal:") ? data.goals.find((g) => g.id === f.slice(5)) : null;
  const preset: Partial<Task> = {
    listId: curList?.id ?? null, goalId: curGoal?.id ?? null,
    due: f === "today" ? today : null,
  };

  const Chip = ({ id, name, color }: { id: string; name: string; color?: string }) => (
    <button className={cx("chip", f === id && "on")} onClick={() => a.setUi({ filter: id })} style={color ? vars({ "--c": color }) : undefined}>
      {f === id && <motion.span layoutId="chip-bg" className="chip-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      {color && <i className="mdot" style={{ background: color }} />}
      <span className="chip-t">{name}</span>
      {counts[id] > 0 && <em>{counts[id]}</em>}
    </button>
  );

  const anything = groups.some((g) => g.list.length) || doneList.length;
  return (
    <LayoutGroup id="tasks">
      <div className="chips">
        <Chip id="all" name="Все" /><Chip id="today" name="Сегодня" /><Chip id="overdue" name="Просрочено" /><Chip id="soon" name="7 дней" /><Chip id="inbox" name="Входящие" />
        {data.lists.map((l) => <Chip key={l.id} id={l.id} name={`${l.icon} ${l.name}`.trim()} color={l.color} />)}
        {data.goals.filter((g) => !g.archived).map((g) => <Chip key={g.id} id={"goal:" + g.id} name={`${g.icon} ${g.title}`} color={g.color} />)}
        <button className="chip add" onClick={() => a.openSheet({ type: "list" })}><Plus size={14} />Список</button>
      </div>

      <div className="tools-row">
        {curList ? <button className="btn ghost sm" onClick={() => a.openSheet({ type: "list", id: curList.id })}><Pencil size={14} />«{curList.name}»</button> : <span />}
        <Segmented small value={ui.sort} onChange={(v) => a.setUi({ sort: v })} options={[{ v: "date", label: "По сроку" }, { v: "prio", label: "По важности" }]} />
      </div>

      <QuickAdd preset={preset} />

      <AnimatePresence initial={false}>
        {groups.filter((g) => g.list.length).map((g) => (
          <motion.div key={g.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
            <div className={cx("ghead", g.over && "over")}>
              <span>{g.title} · {g.list.length}</span>
              {g.over && <button className="glink" onClick={a.moveOverdueToToday}>На сегодня</button>}
            </div>
            <div className="group">
              <AnimatePresence initial={false}>{g.list.map((t) => <TaskRow key={t.id} t={t} scope="tasks" showDate={g.date} showSrc />)}</AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {doneList.length > 0 && (
        <motion.div layout>
          <div className="ghead clickable" onClick={() => a.setUi({ showDone: !ui.showDone })}>
            <span className="ghead-t"><ChevronDown size={15} className={cx("chev", !ui.showDone && "closed")} />Выполнено · {doneList.length}</span>
            <button className="glink" onClick={(e) => { e.stopPropagation(); if (confirm("Удалить все выполненные задачи?")) a.clearDone(); }}><Trash2 size={13} />Очистить</button>
          </div>
          <AnimatePresence initial={false}>
            {ui.showDone && (
              <motion.div className="group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <AnimatePresence initial={false}>{shownDone.map((t) => <TaskRow key={t.id} t={t} scope="tasks" showSrc />)}</AnimatePresence>
                {doneList.length > shownDone.length && <div className="empty-in">…и ещё {doneList.length - shownDone.length}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {!anything && (
        <Empty icon={<Inbox size={30} />} title="Здесь пока пусто" text={f === "all" ? "Добавьте первую задачу строкой выше" : "В этом фильтре нет задач"} />
      )}
    </LayoutGroup>
  );
}
