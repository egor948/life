"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { Check, MapPin, Repeat } from "lucide-react";
import { useStore } from "@/store/store";
import { WD, dow, fmtTime, fromMin, isoWeek } from "@/lib/time";
import type { CalItem } from "@/lib/derive";
import { cx, vars } from "./ui";

const HH = 56; // px на час

interface Placed { it: CalItem; col: number; cols: number }
function layoutDay(items: CalItem[]): Placed[] {
  const sorted = items.slice().sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];
  const flush = () => {
    cluster.forEach((c) => { c.cols = colEnds.length; });
    out.push(...cluster);
    cluster = []; colEnds = []; clusterEnd = -1;
  };
  for (const it of sorted) {
    const end = Math.max(it.endMin, it.startMin + 26);
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= it.startMin);
    if (col < 0) { col = colEnds.length; colEnds.push(end); } else colEnds[col] = end;
    cluster.push({ it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

export function ItemChip({ it, compact }: { it: CalItem; compact?: boolean }) {
  const { a } = useStore();
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (it.kind === "event") a.openSheet({ type: "event", id: it.id });
    else if (it.kind === "task") a.openSheet({ type: "task", id: it.id });
    else a.openRef("goal", it.id);
  };
  const cont = it.kind === "event" && !it.firstDay ? "cont-l" : "";
  const cont2 = it.kind === "event" && !it.lastDay ? "cont-r" : "";
  return (
    <button className={cx("chip-ev", it.kind, it.done && "done", cont, cont2, compact && "compact")} style={vars({ "--c": it.color })} onClick={open} title={it.title}>
      {it.kind === "task" && <span className="mini-chk">{it.done && <Check size={9} strokeWidth={4} />}</span>}
      <span className="chip-ev-t">{it.title}</span>
    </button>
  );
}

export function TimeGrid({ days, map, today }: { days: string[]; map: Record<string, CalItem[]>; today: string }) {
  const { data, now, a } = useStore();
  const s = data.settings;
  const scroller = useRef<HTMLDivElement>(null);
  const key = days[0] + days.length;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const nd = new Date();
    const target = days.includes(today) ? Math.max(0, nd.getHours() - 1) : s.dayStart;
    el.scrollTop = Math.max(0, target * HH - 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const placed = useMemo(
    () => Object.fromEntries(days.map((d) => [d, layoutDay((map[d] ?? []).filter((i) => !i.allDay))])),
    [days, map],
  );
  const nd = new Date(now);
  const nowMin = nd.getHours() * 60 + nd.getMinutes();
  const single = days.length === 1;
  const anyAllDay = days.some((d) => (map[d] ?? []).some((i) => i.allDay));
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  const createAt = (e: React.MouseEvent<HTMLDivElement>, d: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    const min = Math.max(0, Math.min(1425, Math.floor(((e.clientY - r.top) / HH) * 4) * 15));
    a.openSheet({ type: "event", preset: { date: d, start: fromMin(min), end: fromMin(Math.min(1439, min + s.eventMinutes)) } });
  };

  return (
    <div className="tg">
      <div className="tg-head">
        <div className="tg-gutter wk">{s.weekNumbers && days.length > 1 ? `н${isoWeek(days[0])}` : ""}</div>
        <div className="tg-cols" style={cols}>
          {days.map((d) => (
            <button key={d} className={cx("tg-dh", d === today && "today", [5, 6].includes(dow(d)) && "wknd")} onClick={() => !single && a.gotoDay(d, "day")}>
              <span>{WD[dow(d)]}</span>
              <b>{+d.slice(8)}</b>
            </button>
          ))}
        </div>
      </div>

      {anyAllDay && (
        <div className="tg-allday">
          <div className="tg-gutter">весь день</div>
          <div className="tg-cols" style={cols}>
            {days.map((d) => (
              <div key={d} className="tg-ad-col" onDoubleClick={() => a.openSheet({ type: "event", preset: { date: d, allDay: true } })}>
                {(map[d] ?? []).filter((i) => i.allDay).map((it) => <ItemChip key={it.kind + it.id + d} it={it} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ height: HH * 24 }}>
          <div className="tg-gutter hours">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HH }}>{h === 0 ? "" : s.use12h ? fmtTime(`${h}:00`, true).replace(":00", "") : `${String(h).padStart(2, "0")}:00`}</span>
            ))}
          </div>
          <div className="tg-cols" style={cols}>
            {days.map((d) => (
              <div key={d} className={cx("tg-col", d === today && "today", [5, 6].includes(dow(d)) && "wknd")} onClick={(e) => createAt(e, d)}>
                {Array.from({ length: 24 }, (_, h) => <i key={h} className="tg-line" style={{ top: h * HH }} />)}
                {placed[d].map(({ it, col, cols: n }) => {
                  const end = Math.max(it.endMin, it.startMin + 26);
                  const h = Math.max(22, ((end - it.startMin) / 60) * HH - 2);
                  const small = h < 40;
                  return (
                    <motion.div
                      key={it.kind + it.id + d}
                      className={cx("tg-ev", it.kind, it.done && "done", small && "small")}
                      style={{ top: (it.startMin / 60) * HH + 1, height: h, left: `calc(${(col / n) * 100}% + 1px)`, width: `calc(${100 / n}% - 3px)`, ["--c" as string]: it.color }}
                      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.kind === "event") a.openSheet({ type: "event", id: it.id });
                        else a.openSheet({ type: "task", id: it.id });
                      }}
                    >
                      {it.kind === "task" && (
                        <button className="tg-chk" onClick={(e) => { e.stopPropagation(); a.toggleTask(it.id); }} aria-label="Выполнено">{it.done && <Check size={10} strokeWidth={4} />}</button>
                      )}
                      <div className="tg-ev-in">
                        <b>{it.title}</b>
                        {!small && (
                          <span>
                            {fmtTime(it.start, s.use12h)}{it.end ? ` – ${fmtTime(it.end, s.use12h)}` : ""}
                            {it.location && <><MapPin size={10} />{it.location}</>}
                            {it.repeat && <Repeat size={10} />}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                {d === today && (
                  <div className="tg-now" style={{ top: (nowMin / 60) * HH }}><i /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
