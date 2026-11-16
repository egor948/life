"use client";

import { motion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { useStore } from "@/store/store";
import { WD, WDF, addD, diffDays, dow, dstr, fmtHuman, fmtMinutes, plural, range as dRange, toMin } from "@/lib/time";
import { eventOccurrences } from "@/lib/recur";
import { goalProgress, habitRate, habitStreak, taskSource } from "@/lib/derive";
import { BarChart, Donut, HBars, Heat, MiniBars, type BarDatum } from "./charts";
import { Empty, Ring, Segmented } from "./ui";

const loc = (ms: number) => dstr(new Date(ms));

function Card({ title, sub, children, wide }: { title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  return (
    <motion.section className={wide ? "card stat-card wide" : "card stat-card"} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
      <h3>{title}</h3>
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </motion.section>
  );
}

function Kpi({ v, label, delta, color, icon }: { v: string; label: string; delta?: string; color: string; icon: string }) {
  return (
    <motion.div className="kpi" style={{ ["--c" as string]: color }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <span className="kpi-ic">{icon}</span>
      <b>{v}</b>
      <span>{label}</span>
      {delta && <em className={delta.startsWith("−") ? "neg" : "pos"}>{delta}</em>}
    </motion.div>
  );
}

export function StatsView() {
  const { data, today, ui, a } = useStore();
  const s = data.settings;
  const R = ui.statsRange;

  const st = useMemo(() => {
    const from = addD(today, -(R - 1));
    const pFrom = addD(from, -R), pTo = addD(from, -1);
    const days = dRange(from, today);
    const inR = (d: string) => d >= from && d <= today;

    const doneTasks = data.tasks.filter((t) => t.done && t.doneAt);
    const doneNow = doneTasks.filter((t) => inR(loc(t.doneAt)));
    const donePrev = doneTasks.filter((t) => { const d = loc(t.doneAt); return d >= pFrom && d <= pTo; });

    const taskPerDay: Record<string, number> = {};
    doneNow.forEach((t) => { const d = loc(t.doneAt); taskPerDay[d] = (taskPerDay[d] || 0) + 1; });
    const habPerDay: Record<string, number> = {};
    data.habits.forEach((h) => h.checks.forEach((d) => { if (inR(d)) habPerDay[d] = (habPerDay[d] || 0) + 1; }));

    // корзины для графика
    const bucketSize = R <= 31 ? 1 : R <= 100 ? 7 : 30;
    const bars: BarDatum[] = [];
    for (let i = 0; i < days.length; i += bucketSize) {
      const chunk = days.slice(i, i + bucketSize);
      const tv = chunk.reduce((n, d) => n + (taskPerDay[d] || 0), 0);
      const hv = chunk.reduce((n, d) => n + (habPerDay[d] || 0), 0);
      const first = chunk[0];
      bars.push({
        label: bucketSize === 1 ? String(+first.slice(8)) : fmtHuman(first).split(" ")[0] + "." + first.slice(5, 7),
        sub: bucketSize === 1 ? fmtHuman(first) : `${fmtHuman(first)} – ${fmtHuman(chunk[chunk.length - 1])}`,
        values: [tv, hv],
      });
    }

    // задачи по срокам
    const dueIn = data.tasks.filter((t) => t.due && inR(t.due) && t.due <= today);
    const dueDone = dueIn.filter((t) => t.done).length;
    const onTime = doneNow.filter((t) => t.due).length;
    const onTimeOk = doneNow.filter((t) => t.due && loc(t.doneAt) <= t.due).length;

    // привычки
    const act = data.habits.filter((h) => !h.archived);
    const habRows = act.map((h) => ({ h, r: habitRate(h, from, today), streak: habitStreak(h, today) }));
    const planSum = habRows.reduce((n, x) => n + x.r.plan, 0);
    const doneSum = habRows.reduce((n, x) => n + x.r.done, 0);
    const prevRates = act.map((h) => habitRate(h, pFrom, pTo));
    const pPlan = prevRates.reduce((n, x) => n + x.plan, 0), pDone = prevRates.reduce((n, x) => n + x.done, 0);

    // по дням недели / часам
    const byDow = [0, 0, 0, 0, 0, 0, 0];
    const byHour = new Array(24).fill(0) as number[];
    doneNow.forEach((t) => { byDow[dow(loc(t.doneAt))]++; byHour[new Date(t.doneAt).getHours()]++; });

    // события
    let evCount = 0, evMin = 0;
    const evDow = [0, 0, 0, 0, 0, 0, 0];
    data.events.forEach((e) => {
      eventOccurrences(e, from, today).forEach((o) => {
        if (o.date < from) return;
        evCount++;
        const m = !e.allDay && e.start && o.date === o.endDate ? Math.max(0, (e.end ? toMin(e.end) : toMin(e.start) + s.eventMinutes) - toMin(e.start)) : 0;
        evMin += m;
        evDow[dow(o.date)] += m / 60;
      });
    });

    // источники
    const src: Record<string, { value: number; color: string }> = {};
    doneNow.forEach((t) => {
      const name = taskSource(t, data).replace(/ · .*/, "");
      const l = data.lists.find((x) => x.id === t.listId), g = data.goals.find((x) => x.id === t.goalId);
      const color = l?.color || g?.color || "#8E8E93";
      (src[name] ||= { value: 0, color }).value++;
    });
    const parts = Object.entries(src).map(([label, v]) => ({ label, ...v })).sort((x, y) => y.value - x.value);

    // тепловая карта
    const heatFrom = addD(today, -7 * 25);
    const heat: Record<string, number> = {};
    doneTasks.forEach((t) => { const d = loc(t.doneAt); if (d >= heatFrom) heat[d] = (heat[d] || 0) + 1; });
    data.habits.forEach((h) => h.checks.forEach((d) => { if (d >= heatFrom) heat[d] = (heat[d] || 0) + 1; }));

    const overdue = data.tasks.filter((t) => !t.done && t.due && t.due < today).length;
    const best = Math.max(0, ...habRows.map((x) => x.streak));
    return { from, days, doneNow, donePrev, bars, dueIn, dueDone, onTime, onTimeOk, habRows, planSum, doneSum, pPlan, pDone, byDow, byHour, evCount, evMin, evDow, parts, heat, overdue, best };
  }, [data, today, R, s.eventMinutes]);

  const habPct = st.planSum ? st.doneSum / st.planSum : 0;
  const prevPct = st.pPlan ? st.pDone / st.pPlan : 0;
  const dTask = st.donePrev.length ? Math.round(((st.doneNow.length - st.donePrev.length) / st.donePrev.length) * 100) : null;
  const fmtDelta = (v: number | null) => (v === null ? undefined : `${v >= 0 ? "+" : "−"}${Math.abs(v)}% к прошлому периоду`);
  const rate = st.dueIn.length ? st.dueDone / st.dueIn.length : 0;

  const peakDow = st.byDow.indexOf(Math.max(...st.byDow));
  const peakHour = st.byHour.indexOf(Math.max(...st.byHour));
  const insights: { ic: string; t: string; act?: () => void; actL?: string }[] = [];
  if (st.doneNow.length >= 3) insights.push({ ic: "🏆", t: `Самый продуктивный день — ${WDF[peakDow].toLowerCase()}: ${st.byDow[peakDow]} ${plural(st.byDow[peakDow], "задача", "задачи", "задач")}.` });
  if (st.doneNow.length >= 3) insights.push({ ic: "⏰", t: `Чаще всего вы завершаете дела около ${String(peakHour).padStart(2, "0")}:00.` });
  if (dTask !== null && Math.abs(dTask) >= 10) insights.push({ ic: dTask > 0 ? "📈" : "📉", t: `Выполнено задач ${dTask > 0 ? "на " + dTask + "% больше" : "на " + -dTask + "% меньше"}, чем в предыдущем периоде.` });
  const weak = st.habRows.filter((x) => x.r.plan >= 3).sort((x, y) => x.r.pct - y.r.pct)[0];
  if (weak && weak.r.pct < 0.7) insights.push({ ic: "🌱", t: `«${weak.h.title}» выполняется реже всего — ${Math.round(weak.r.pct * 100)}%. Попробуйте добавить напоминание.`, act: () => a.openSheet({ type: "habit", id: weak.h.id }), actL: "Настроить" });
  const top = st.habRows.slice().sort((x, y) => y.streak - x.streak)[0];
  if (top && top.streak >= 3) insights.push({ ic: "🔥", t: `Серия ${top.streak} ${plural(top.streak, "день", "дня", "дней")} подряд в «${top.h.title}». Не прерывайте!` });
  if (st.overdue) insights.push({ ic: "⚠️", t: `Просроченных задач: ${st.overdue}. Разберите их, чтобы не копились.`, act: () => a.moveOverdueToToday(), actL: "На сегодня" });
  const busy = st.evDow.indexOf(Math.max(...st.evDow));
  if (st.evMin > 0) insights.push({ ic: "📅", t: `Самый загруженный день недели — ${WDF[busy].toLowerCase()}: событий на ${fmtMinutes(Math.round(st.evDow[busy] * 60))} за период.` });

  const empty = !st.doneNow.length && !st.planSum && !st.evCount;
  return (
    <div className="stats">
      <div className="stats-bar">
        <Segmented value={R} onChange={(v) => a.setUi({ statsRange: v })} options={[{ v: 7, label: "7 дней" }, { v: 30, label: "30 дней" }, { v: 90, label: "90 дней" }, { v: 365, label: "Год" }]} />
        <span className="muted">{fmtHuman(st.from)} – {fmtHuman(today)}</span>
      </div>

      <div className="kpis">
        <Kpi icon="✅" v={String(st.doneNow.length)} label="задач выполнено" delta={fmtDelta(dTask)} color="#0A84FF" />
        <Kpi icon="🎯" v={`${Math.round(rate * 100)}%`} label="сроки выполнены" color="#30D158" />
        <Kpi icon="🔥" v={`${Math.round(habPct * 100)}%`} label="привычки" delta={st.pPlan ? `${habPct >= prevPct ? "+" : "−"}${Math.abs(Math.round((habPct - prevPct) * 100))} п.п.` : undefined} color="#FF375F" />
        <Kpi icon="⚡" v={String(st.best)} label="лучшая серия, дн." color="#FF9F0A" />
        <Kpi icon="📅" v={String(st.evCount)} label={`${plural(st.evCount, "событие", "события", "событий")}${st.evMin ? " · " + fmtMinutes(st.evMin) : ""}`} color="#BF5AF2" />
        <Kpi icon="⏱️" v={st.onTime ? `${Math.round((st.onTimeOk / st.onTime) * 100)}%` : "—"} label="завершено вовремя" color="#64D2FF" />
      </div>

      {empty && <Empty icon="📊" title="Пока мало данных" text="Выполняйте задачи и отмечайте привычки — здесь появятся графики и выводы." />}

      {insights.length > 0 && (
        <Card title="Выводы" sub="Автоматический анализ вашей активности" wide>
          <div className="insights">
            {insights.map((i, k) => (
              <motion.div key={k} className="insight" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.05 }}>
                <span>{i.ic}</span><p>{i.t}</p>
                {i.act && <button className="btn ghost sm" onClick={i.act}>{i.actL}</button>}
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Активность" sub="Выполненные задачи и отметки привычек" wide>
        <BarChart data={st.bars} colors={["var(--accent)", "#30D158"]} showEvery={R <= 7 ? 1 : R <= 31 ? 3 : 1} />
        <div className="legend-row"><span><i style={{ background: "var(--accent)" }} />Задачи</span><span><i style={{ background: "#30D158" }} />Привычки</span></div>
      </Card>

      <div className="stats-grid">
        <Card title="Дни недели" sub="Когда вы завершаете больше всего задач">
          <MiniBars values={st.byDow} labels={WD} color="var(--accent)" highlight={st.doneNow.length ? peakDow : undefined} />
        </Card>
        <Card title="Время суток" sub="Часы завершения задач">
          <MiniBars values={[0, 3, 6, 9, 12, 15, 18, 21].map((h) => st.byHour.slice(h, h + 3).reduce((x, y) => x + y, 0))} labels={["0–3", "3–6", "6–9", "9–12", "12–15", "15–18", "18–21", "21–24"]} color="#FF9F0A" highlight={st.doneNow.length ? Math.floor(peakHour / 3) : undefined} />
        </Card>
        <Card title="Задачи по спискам и целям" sub="Откуда выполненные задачи">
          {st.parts.length ? <Donut parts={st.parts} center={<><b>{st.doneNow.length}</b><span>всего</span></>} /> : <p className="muted-note">Нет выполненных задач за период</p>}
        </Card>
        <Card title="Занятость в календаре" sub="Часов в событиях по дням недели">
          <MiniBars values={st.evDow.map((x) => Math.round(x * 10) / 10)} labels={WD} color="#BF5AF2" highlight={st.evMin ? busy : undefined} />
        </Card>
      </div>

      <Card title="Привычки" sub="Выполнение запланированных дней за период" wide>
        {st.habRows.length ? (
          <HBars rows={st.habRows.sort((x, y) => y.r.pct - x.r.pct).map((x) => ({ label: `${x.h.icon} ${x.h.title}`, pct: x.r.pct, color: x.h.color, right: `${Math.round(x.r.pct * 100)}% · ${x.r.done}/${x.r.plan}${x.streak ? " · 🔥" + x.streak : ""}` }))} />
        ) : <p className="muted-note">Добавьте привычки, чтобы видеть статистику</p>}
      </Card>

      <Card title="Карта активности" sub="Последние 26 недель: задачи и привычки" wide>
        <Heat counts={st.heat} to={today} weeks={26} weekStart={s.weekStart} />
      </Card>

      {data.goals.filter((g) => !g.archived).length > 0 && (
        <Card title="Цели" sub="Прогресс по задачам" wide>
          <div className="goal-stats">
            {data.goals.filter((g) => !g.archived).map((g) => {
              const p = goalProgress(g.id, data.tasks);
              const habs = data.habits.filter((h) => h.goalId === g.id && !h.archived);
              const left = g.target ? diffDays(today, g.target) : null;
              return (
                <button key={g.id} className="gs" onClick={() => a.openRef("goal", g.id)}>
                  <Ring pct={p.pct} color={g.color} size={52} stroke={6}><span className="ring-n">{Math.round(p.pct * 100)}</span></Ring>
                  <div><b>{g.icon} {g.title}</b><small>{p.done}/{p.total} задач{habs.length ? ` · ${habs.length} ${plural(habs.length, "привычка", "привычки", "привычек")}` : ""}{left !== null ? ` · ${left >= 0 ? left + " дн." : "просрочено"}` : ""}</small></div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
