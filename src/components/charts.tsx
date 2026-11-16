"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { addD, dow, fmtHuman, startOfWeek } from "@/lib/time";
import { cx, vars } from "./ui";

export interface BarDatum { label: string; sub?: string; values: number[] }

/** Столбчатая диаграмма (можно стопкой) */
export function BarChart({ data, colors, height = 150, showEvery = 1, unit = "" }: { data: BarDatum[]; colors: string[]; height?: number; showEvery?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const [hover, setHover] = useState<number | null>(null);
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  return (
    <div className="bars" style={{ height: height + 26 }}>
      <div className="bars-grid" style={{ height }}>
        {[4, 3, 2, 1, 0].map((i) => <div key={i}><span>{i * step}</span></div>)}
      </div>
      <div className="bars-cols" style={{ height }}>
        {data.map((d, i) => {
          const total = d.values.reduce((a, b) => a + b, 0);
          return (
            <div key={i} className={cx("bar-col", hover === i && "hov")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
              <div className="bar-stack">
                {d.values.map((v, j) => (
                  <motion.i key={j} style={{ background: colors[j] }} initial={{ height: 0 }} animate={{ height: `${(v / top) * 100}%` }}
                    transition={{ duration: 0.7, delay: Math.min(0.5, i * 0.012), ease: [0.2, 0.8, 0.2, 1] }} />
                ))}
              </div>
              {hover === i && <div className="bar-tip"><b>{total}{unit}</b><span>{d.sub ?? d.label}</span></div>}
            </div>
          );
        })}
      </div>
      <div className="bars-x">
        {data.map((d, i) => <span key={i}>{i % showEvery === 0 ? d.label : ""}</span>)}
      </div>
    </div>
  );
}

/** Кольцевая диаграмма */
export function Donut({ parts, size = 150, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={18} />
          {total > 0 && parts.map((p, i) => {
            const len = (p.value / total) * c;
            const off = -acc;
            acc += len;
            return (
              <motion.circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={18}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={off}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08, duration: 0.5 }} />
            );
          })}
        </svg>
        <div className="donut-c">{center}</div>
      </div>
      <ul className="legend-list">
        {parts.slice(0, 6).map((p, i) => (
          <li key={i}><i style={{ background: p.color }} /><span>{p.label}</span><b>{p.value}</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Горизонтальные полосы с процентами */
export function HBars({ rows }: { rows: { label: string; pct: number; color: string; right?: string }[] }) {
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div key={i} className="hbar">
          <div className="hbar-t"><span>{r.label}</span><b>{r.right ?? `${Math.round(r.pct * 100)}%`}</b></div>
          <div className="hbar-track"><motion.i style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(2, r.pct * 100)}%` }} transition={{ duration: 0.8, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Календарь-тепловая карта активности */
export function Heat({ counts, to, weeks, weekStart, color = "var(--accent)" }: { counts: Record<string, number>; to: string; weeks: number; weekStart: number; color?: string }) {
  const first = startOfWeek(addD(to, -7 * (weeks - 1)), weekStart);
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(addD(first, w * 7 + d));
    cols.push(col);
  }
  const max = Math.max(1, ...Object.values(counts));
  const [tip, setTip] = useState<string | null>(null);
  return (
    <div className="heat-wrap">
      <div className="heat" style={vars({ "--c": color, "--w": weeks })}>
        {cols.map((col, i) => (
          <div key={i} className="heat-col">
            {col.map((d) => {
              const v = counts[d] || 0;
              const lvl = d > to ? -1 : v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4));
              return <i key={d} data-l={lvl} onMouseEnter={() => setTip(d)} onMouseLeave={() => setTip(null)} onClick={() => setTip(d)} />;
            })}
          </div>
        ))}
      </div>
      <div className="heat-tip">{tip ? `${fmtHuman(tip)} · ${counts[tip] || 0} действий` : "Наведите на день"}</div>
    </div>
  );
}

export function MiniBars({ values, labels, color, highlight }: { values: number[]; labels: string[]; color: string; highlight?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mbars">
      {values.map((v, i) => (
        <div key={i} className={cx("mbar", highlight === i && "hl")}>
          <div className="mbar-t"><motion.i style={{ background: color }} initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.03, ease: [0.2, 0.8, 0.2, 1] }} /></div>
          <span>{labels[i]}</span>
          <em>{v}</em>
        </div>
      ))}
    </div>
  );
}

export { dow };
