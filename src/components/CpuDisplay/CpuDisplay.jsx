/**
 * CpuDisplay — full-screen widget that visualizes CPU usage data.
 *
 * Animations (GSAP):
 *   • Panel slides up + fades in on mount
 *   • Gauge arc draws from 0 → percent with a glow effect
 *   • Percentage counter counts up from 0
 *   • Core rows stagger in from the right
 *   • Horizontal bar fills animate left → right per-core
 *
 * Props:
 *   data    — { overall, per_core[], cpu_count, physical_count, freq_mhz, freq_max_mhz }
 *   onClose — callback to dismiss the widget
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./CpuDisplay.module.css";

/* ── Colour helper ── */
function barColor(pct) {
  if (pct < 50) return "#34d399";
  if (pct < 80) return "#fbbf24";
  return "#f87171";
}

/* ─────────────────────────────────────────────
   CircularGauge — SVG arc with GSAP draw + count-up
───────────────────────────────────────────── */
function CircularGauge({ percent }) {
  const arcRef   = useRef(null);
  const valRef   = useRef(null);

  const RADIUS        = 90;
  const STROKE        = 14;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const color         = barColor(percent);

  useEffect(() => {
    const target = (Math.min(100, Math.max(0, percent)) / 100) * CIRCUMFERENCE;

    /* Draw the arc */
    gsap.fromTo(
      arcRef.current,
      { strokeDasharray: `0 ${CIRCUMFERENCE}` },
      {
        strokeDasharray: `${target} ${CIRCUMFERENCE}`,
        duration: 1.4,
        ease: "power3.out",
      }
    );

    /* Count-up number */
    const counter = { val: 0 };
    gsap.to(counter, {
      val: percent,
      duration: 1.4,
      ease: "power3.out",
      onUpdate() {
        if (valRef.current) valRef.current.textContent = `${counter.val.toFixed(1)}%`;
      },
    });
  }, [percent, CIRCUMFERENCE]);

  return (
    <svg
      viewBox="0 0 200 200"
      className={styles.gauge}
      aria-label={`Overall CPU usage: ${percent}%`}
    >
      {/* Background track */}
      <circle
        cx="100" cy="100" r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={STROKE}
      />

      {/* Active arc */}
      <circle
        ref={arcRef}
        cx="100" cy="100" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`0 ${CIRCUMFERENCE}`}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke 0.4s" }}
      />

      {/* Centre: animated percentage */}
      <text
        ref={valRef}
        x="100" y="96"
        textAnchor="middle"
        className={styles.gaugeValue}
        fill={color}
      >
        0%
      </text>
      <text
        x="100" y="120"
        textAnchor="middle"
        className={styles.gaugeSubLabel}
        fill="rgba(255,255,255,0.3)"
      >
        OVERALL
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   CoreRow — horizontal bar with GSAP fill + count-up
───────────────────────────────────────────── */
function CoreRow({ index, percent, delay }) {
  const fillRef = useRef(null);
  const pctRef  = useRef(null);
  const rowRef  = useRef(null);
  const color   = barColor(percent);

  useEffect(() => {
    /* Row slides in from right */
    gsap.fromTo(
      rowRef.current,
      { opacity: 0, x: 32 },
      { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", delay }
    );

    /* Bar fills left → right */
    gsap.fromTo(
      fillRef.current,
      { width: "0%" },
      { width: `${percent}%`, duration: 0.8, ease: "power2.out", delay }
    );

    /* Percentage count-up */
    const counter = { val: 0 };
    gsap.to(counter, {
      val: percent,
      duration: 0.8,
      ease: "power2.out",
      delay,
      onUpdate() {
        if (pctRef.current) pctRef.current.textContent = `${counter.val.toFixed(1)}%`;
      },
    });
  }, [percent, delay]);

  return (
    <div ref={rowRef} className={styles.coreRow} style={{ opacity: 0 }}>
      <span className={styles.coreLabel}>Core {index + 1}</span>
      <div className={styles.coreTrack}>
        <div
          ref={fillRef}
          className={styles.coreFill}
          style={{ background: color, width: 0 }}
        />
        {/* Tick marks at 25 / 50 / 75 */}
        {[25, 50, 75].map((t) => (
          <div key={t} className={styles.coreTick} style={{ left: `${t}%` }} />
        ))}
      </div>
      <span ref={pctRef} className={styles.corePercent}>0%</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CpuDisplay — main panel
───────────────────────────────────────────── */
export default function CpuDisplay({ data, onClose, embedded = false }) {
  const panelRef = useRef(null);

  const {
    overall       = 0,
    per_core      = [],
    cpu_count     = 0,
    physical_count = 0,
    freq_mhz      = null,
    freq_max_mhz  = null,
  } = data ?? {};

  const freqGhz    = freq_mhz     ? (freq_mhz / 1000).toFixed(2)     : null;
  const freqMaxGhz = freq_max_mhz ? (freq_max_mhz / 1000).toFixed(2) : null;

  /* Panel entrance: slide up + fade */
  useEffect(() => {
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
    );
  }, []);

  return (
    <div ref={panelRef} className={styles.panel} style={{ opacity: 0 }}>

      {/* Header — hidden when inside WidgetPanel (tab bar already provides title + close) */}
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg className={styles.headerIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className={styles.headerTitle}>CPU Usage</span>
            <span className={styles.headerBadge}>Live</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close CPU display">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Left: circular gauge */}
        <div className={styles.gaugeSection}>
          <CircularGauge percent={overall} />

          {/* Metadata pills below gauge */}
          <div className={styles.gaugeMeta}>
            <div className={styles.metaPill}>
              <span className={styles.metaPillLabel}>Logical</span>
              <span className={styles.metaPillValue}>{cpu_count}</span>
            </div>
            <div className={styles.metaPillDivider} />
            <div className={styles.metaPill}>
              <span className={styles.metaPillLabel}>Physical</span>
              <span className={styles.metaPillValue}>{physical_count}</span>
            </div>
            {freqGhz && (
              <>
                <div className={styles.metaPillDivider} />
                <div className={styles.metaPill}>
                  <span className={styles.metaPillLabel}>Freq</span>
                  <span className={styles.metaPillValue}>{freqGhz} GHz</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Right: per-core horizontal bars */}
        <div className={styles.coresSection}>
          <p className={styles.sectionLabel}>Per-core breakdown</p>
          <div className={styles.coreList}>
            {per_core.map((pct, i) => (
              <CoreRow key={i} index={i} percent={pct} delay={0.15 + i * 0.06} />
            ))}
          </div>

          {/* Scale legend */}
          <div className={styles.scaleLegend}>
            {["0%", "25%", "50%", "75%", "100%"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
