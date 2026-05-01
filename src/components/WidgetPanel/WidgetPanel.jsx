/**
 * WidgetPanel — tabbed widget container.
 *
 * Replaces the old WidgetGrid. Instead of showing all widgets at once in a
 * grid (which breaks with many widgets), this renders a horizontal tab bar
 * at the top and shows exactly one widget at a time — full size — beneath it.
 *
 * Scaling:
 *   - The tab bar scrolls horizontally so 2 or 20 widgets work equally well.
 *   - Each tab has its own × close button; other tabs are unaffected.
 *   - When a new widget arrives the panel auto-switches to that tab.
 *   - GSAP fades the content on tab switch for a polished feel.
 *
 * Extending (adding a new widget type):
 *   1. Create a display component, e.g. frontend/src/components/RamDisplay/
 *   2. Import it and add one entry to WIDGET_REGISTRY below — done.
 *
 * Props:
 *   widgets     — { [type: string]: object }  from useLiveKitStore
 *   clearWidget — (type: string) => void
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";

import CpuDisplay  from "../CpuDisplay/CpuDisplay";
import DiskDisplay from "../DiskDisplay/DiskDisplay";
import styles      from "./WidgetPanel.module.css";

/* ─────────────────────────────────────────────────────────────────────────────
   Registry — ONE entry per widget type.
   Import the component and add its key/label/icon here.
───────────────────────────────────────────────────────────────────────────── */
export const WIDGET_REGISTRY = {
  cpu:  { label: "CPU Usage",  Component: CpuDisplay  },
  disk: { label: "Disk Usage", Component: DiskDisplay },
  // ram: { label: "RAM Usage", Component: RamDisplay },
};

/* ── Tab icon SVGs ── */
export function TabIcon({ type }) {
  if (type === "cpu") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  if (type === "disk") return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
  /* Generic fallback */
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   WidgetPanel
───────────────────────────────────────────────────────────────────────────── */
export default function WidgetPanel({ widgets, activeType }) {
  const contentRef  = useRef(null);
  const prevTypeRef = useRef(activeType);

  /* GSAP fade-in whenever the active tab changes */
  useEffect(() => {
    if (prevTypeRef.current === activeType) return;
    prevTypeRef.current = activeType;
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }
    );
  }, [activeType]);

  if (!activeType || !widgets[activeType]) return null;

  const activeData      = widgets[activeType];
  const activeEntry     = WIDGET_REGISTRY[activeType];
  const ActiveComponent = activeEntry?.Component;

  return (
    <div className={styles.panel}>
      {/* Active widget fills the full content area */}
      <div ref={contentRef} className={styles.content}>
        {ActiveComponent && activeData ? (
          <ActiveComponent data={activeData} embedded={true} onClose={() => {}} />
        ) : null}
      </div>
    </div>
  );
}
