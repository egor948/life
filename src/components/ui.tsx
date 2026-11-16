"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Check, X } from "lucide-react";
import { PALETTE } from "@/lib/types";
import { useStore } from "@/store/store";

export function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}
export const useDesktop = () => useMedia("(min-width: 820px)");

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
type CSSVars = CSSProperties & Record<`--${string}`, string | number>;
export const vars = (v: CSSVars) => v;

/* ---------- Sheet ---------- */
export function Sheet({
  title, onClose, children, footer, size = "md",
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  const desktop = useDesktop();
  const controls = useDragControls();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="sheet-root">
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} />
      <motion.div
        className={cx("sheet", size === "lg" && "lg")}
        role="dialog"
        initial={desktop ? { opacity: 0, y: 24, scale: 0.97 } : { y: "100%" }}
        animate={desktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
        exit={desktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 380, mass: 0.9 }}
        drag={desktop ? false : "y"}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 700) onClose(); }}
      >
        <div className="sheet-top" onPointerDown={(e) => !desktop && controls.start(e)}>
          <div className="sheet-grab" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn plain" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </motion.div>
    </div>
  );
}

/* ---------- form bits ---------- */
export function Fld({ label, children, hint }: { label?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="fld">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("switch", on && "on")} onClick={() => onChange(!on)}>
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} />
    </button>
  );
}

export function Row({ label, hint, children, onClick }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className={cx("srow", onClick && "click")} onClick={onClick}>
      <div className="srow-l">
        <div>{label}</div>
        {hint && <small>{hint}</small>}
      </div>
      <div className="srow-r">{children}</div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange, small,
}: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  const id = useId();
  return (
    <div className={cx("seg", small && "small")}>
      {options.map((o) => (
        <button type="button" key={String(o.v)} className={cx(value === o.v && "on")} onClick={() => onChange(o.v)}>
          {value === o.v && <motion.span layoutId={"seg" + id} className="seg-pill" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
          <span className="seg-t">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Swatches({ value, onChange, colors = PALETTE }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button type="button" key={c} className={cx("swatch", c.toLowerCase() === value.toLowerCase() && "sel")} style={vars({ "--c": c })} onClick={() => onChange(c)} aria-label={c}>
          <Check size={14} strokeWidth={3} />
        </button>
      ))}
    </div>
  );
}

const EMOJIS = ["🎯", "📚", "💪", "🏃", "💧", "🧘", "💼", "🏠", "🛒", "✈️", "💰", "🎨", "🎵", "💻", "🍎", "😴", "🌱", "❤️", "🇬🇧", "🧠", "🗣️", "📝", "🔥", "✨"];
export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="emojis">
      {EMOJIS.map((e) => (
        <button type="button" key={e} className={cx(e === value && "sel")} onClick={() => onChange(e)}>{e}</button>
      ))}
    </div>
  );
}

/* ---------- Checkbox ---------- */
export function Check26({ on, color, onClick, label }: { on: boolean; color: string; onClick: () => void; label?: string }) {
  return (
    <button type="button" className={cx("chk", on && "on")} style={vars({ "--c": color })} onClick={(e) => { e.stopPropagation(); onClick(); }} aria-pressed={on} aria-label={label || "Выполнено"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 12.5l4.2 4.2L18.5 7.8" /></svg>
    </button>
  );
}

/* ---------- Ring ---------- */
export function Ring({ pct, color, size = 64, stroke = 7, children }: { pct: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fill)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      {children && <div className="ring-in">{children}</div>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-ic">{icon}</div>}
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* ---------- Toasts ---------- */
export function ToastHost() {
  const { toasts, a } = useStore();
  return (
    <div className="toast-host">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id} layout className={cx("toast", t.kind)}
            initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
          >
            {t.kind === "notif" && <span className="toast-ic"><Bell size={16} /></span>}
            {t.kind === "success" && <span className="toast-ic ok"><Check size={15} strokeWidth={3} /></span>}
            <div className="toast-t">
              <b>{t.msg}</b>
              {t.sub && <small>{t.sub}</small>}
            </div>
            {t.action && (
              <button className="toast-a" onClick={() => { t.action?.run(); a.dismissToast(t.id); }}>{t.action.label}</button>
            )}
            <button className="toast-x" onClick={() => a.dismissToast(t.id)} aria-label="Закрыть"><X size={14} /></button>
            <span className="toast-bar" style={{ animationDuration: t.ms + "ms" }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
