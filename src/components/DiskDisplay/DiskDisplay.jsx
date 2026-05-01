/**
 * DiskDisplay — visualizes disk usage data received from the agent tool.
 *
 * Props:
 *   data    — { overall_percent, total_gb, used_gb, free_gb, partitions[] }
 *   onClose — callback to dismiss this widget
 *
 * Animations (GSAP):
 *   • Panel slides up + fades in on mount
 *   • Overall arc draws from 0 → percent
 *   • Partition rows stagger in from the right with bar fills
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./DiskDisplay.module.css";

/* ── Colour helper — disk uses blue/amber/red scale ── */
function barColor(pct) {
  if (pct < 70) return "#60a5fa";   // blue — healthy
  if (pct < 90) return "#fbbf24";   // amber — getting full
  return "#f87171";                  // red — critical
}

/* ── Format GB value nicely ── */
function fmtGb(gb) {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(1)} GB`;
}

/* ─────────────────────────────────────────────
   DonutGauge — overall usage as a donut chart
───────────────────────────────────────────── */
function DonutGauge({ percent, usedGb, totalGb }) {
  const arcRef  = useRef(null);
  const valRef  = useRef(null);

  const RADIUS        = 90;
  const STROKE        = 20;          // thicker than CPU for a "donut" look
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const color         = barColor(percent);

  useEffect(() => {
    const target = (Math.min(100, Math.max(0, percent)) / 100) * CIRCUMFERENCE;

    gsap.fromTo(
      arcRef.current,
      { strokeDasharray: `0 ${CIRCUMFERENCE}` },
      { strokeDasharray: `${target} ${CIRCUMFERENCE}`, duration: 1.4, ease: "power3.out" }
    );

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
    <svg viewBox="0 0 200 200" className={styles.gauge} aria-label={`Overall disk usage: ${percent}%`}>
      {/* Background track */}
      <circle cx="100" cy="100" r={RADIUS} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />

      {/* Active arc */}
      <circle ref={arcRef} cx="100" cy="100" r={RADIUS} fill="none"
        stroke={color} strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={`0 ${CIRCUMFERENCE}`}
        transform="rotate(-90 100 100)" style={{ transition: "stroke 0.4s" }} />

      {/* Centre text */}
      <text ref={valRef} x="100" y="90" textAnchor="middle"
        className={styles.gaugeValue} fill={color}>0%</text>
      <text x="100" y="110" textAnchor="middle"
        className={styles.gaugeUsed} fill="rgba(255,255,255,0.55)">
        {fmtGb(usedGb)} used
      </text>
      <text x="100" y="128" textAnchor="middle"
        className={styles.gaugeTotal} fill="rgba(255,255,255,0.25)">
        of {fmtGb(totalGb)}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   PartitionRow — one horizontal bar per partition
───────────────────────────────────────────── */
function PartitionRow({ partition, delay }) {
  const fillRef = useRef(null);
  const pctRef  = useRef(null);
  const rowRef  = useRef(null);
  const color   = barColor(partition.percent);

  useEffect(() => {
    gsap.fromTo(rowRef.current,
      { opacity: 0, x: 28 },
      { opacity: 1, x: 0, duration: 0.45, ease: "power2.out", delay }
    );
    gsap.fromTo(fillRef.current,
      { width: "0%" },
      { width: `${partition.percent}%`, duration: 0.85, ease: "power2.out", delay }
    );
    const counter = { val: 0 };
    gsap.to(counter, {
      val: partition.percent, duration: 0.85, ease: "power2.out", delay,
      onUpdate() {
        if (pctRef.current) pctRef.current.textContent = `${counter.val.toFixed(1)}%`;
      },
    });
  }, [partition.percent, delay]);

  return (
    <div ref={rowRef} className={styles.partitionRow} style={{ opacity: 0 }}>
      {/* Label column */}
      <div className={styles.partitionLabel}>
        <span className={styles.mountpoint}>{partition.mountpoint}</span>
        <span className={styles.fstype}>{partition.fstype}</span>
      </div>

      {/* Bar */}
      <div className={styles.partTrack}>
        <div ref={fillRef} className={styles.partFill} style={{ background: color, width: 0 }} />
        {[25, 50, 75].map((t) => (
          <div key={t} className={styles.partTick} style={{ left: `${t}%` }} />
        ))}
      </div>

      {/* Stats column */}
      <div className={styles.partStats}>
        <span ref={pctRef} className={styles.partPercent} style={{ color }}>0%</span>
        <span className={styles.partFree}>{fmtGb(partition.free_gb)} free</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DiskDisplay — main panel
───────────────────────────────────────────── */
export default function DiskDisplay({ data, onClose, embedded = false }) {
  const panelRef = useRef(null);

  const {
    overall_percent = 0,
    total_gb        = 0,
    used_gb         = 0,
    free_gb         = 0,
    partitions      = [],
  } = data ?? {};

  /* Panel entrance */
  useEffect(() => {
    gsap.fromTo(panelRef.current,
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
            <svg className={styles.headerIcon} viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"
                stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"
                stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span className={styles.headerTitle}>Disk Usage</span>
            <span className={styles.headerBadge}>Live</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close disk display">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>

        {/* Left: donut gauge */}
        <div className={styles.gaugeSection}>
          <DonutGauge percent={overall_percent} usedGb={used_gb} totalGb={total_gb} />

          {/* Free space pill */}
          <div className={styles.freePill}>
            <span className={styles.freePillLabel}>Free</span>
            <span className={styles.freePillValue}>{fmtGb(free_gb)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Right: per-partition bars */}
        <div className={styles.partitionsSection}>
          <p className={styles.sectionLabel}>Partitions</p>
          <div className={styles.partitionList}>
            {partitions.map((p, i) => (
              <PartitionRow key={p.mountpoint} partition={p} delay={0.15 + i * 0.07} />
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
