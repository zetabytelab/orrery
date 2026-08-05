"use client";

// Micro-chart primitives for the profiling cards. Single-hue marks for magnitude
// (the validated series blue), status colors only for health state and always
// paired with an icon + text label.
import { AlertTriangle, CircleCheck, Flame, TriangleAlert } from "lucide-react";
import type { Bin, Severity } from "@/lib/types";

export const STATUS_COLOR: Record<Severity | "good", string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export function StatusIcon({ level, size = 13 }: { level: Severity | "good"; size?: number }) {
  const color = STATUS_COLOR[level];
  if (level === "good") return <CircleCheck size={size} color={color} aria-label="healthy" />;
  if (level === "warning") return <TriangleAlert size={size} color={color} aria-label="warning" />;
  if (level === "serious") return <AlertTriangle size={size} color={color} aria-label="serious" />;
  return <Flame size={size} color={color} aria-label="critical" />;
}

export function Histogram({ bins, width = 132, height = 26 }: { bins: Bin[]; width?: number; height?: number }) {
  if (bins.length === 0) return null;
  const max = Math.max(...bins.map((b) => b.count), 1);
  const gap = 2;
  const barW = Math.max(2, (width - gap * (bins.length - 1)) / bins.length);
  return (
    <svg width={width} height={height} role="img" aria-label="value distribution">
      {bins.map((b, i) => {
        const h = Math.max(1.5, (b.count / max) * (height - 2));
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={1.5}
            fill="var(--series)"
          >
            <title>{`${b.label}: ${b.count.toLocaleString()}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function TopKBars({ bins, width = 132 }: { bins: Bin[]; width?: number }) {
  if (bins.length === 0) return null;
  const max = Math.max(...bins.map((b) => b.count), 1);
  const shown = bins.slice(0, 4);
  return (
    <div className="flex flex-col gap-[3px]" style={{ width }}>
      {shown.map((b) => (
        <div key={b.label} className="flex items-center gap-1.5" title={`${b.label}: ${b.count.toLocaleString()}`}>
          <span className="w-[52px] truncate text-[9px] leading-[10px]" style={{ color: "var(--ink-3)" }}>
            {b.label}
          </span>
          <div className="h-[7px] flex-1 rounded-[2px]" style={{ background: "var(--grid)" }}>
            <div
              className="h-full rounded-[2px]"
              style={{ width: `${(b.count / max) * 100}%`, background: "var(--series)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MissingMeter({ pct, flagged, severity }: { pct: number; flagged: boolean; severity: Severity | "good" }) {
  const fill = flagged ? STATUS_COLOR[severity] : "var(--seq-250)";
  return (
    <div className="flex items-center gap-1.5" title={`${pct.toFixed(1)}% missing or empty`}>
      <div className="h-[6px] w-[44px] rounded-[2px]" style={{ background: "var(--grid)" }}>
        <div
          className="h-full rounded-[2px]"
          style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 4 : 0))}%`, background: fill }}
        />
      </div>
      <span className="tabular text-[9.5px]" style={{ color: flagged ? STATUS_COLOR[severity] : "var(--ink-3)" }}>
        {pct < 0.05 ? "0%" : `${pct.toFixed(1)}%`}
      </span>
      {flagged && severity !== "good" && <StatusIcon level={severity} size={11} />}
    </div>
  );
}

export function HealthRing({ health, worst, size = 30 }: { health: number; worst: Severity | "good"; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const color = STATUS_COLOR[worst];
  return (
    <div className="relative" style={{ width: size, height: size }} title={`health ${health}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - health / 100)}
        />
      </svg>
      <span
        className="tabular absolute inset-0 flex items-center justify-center text-[9px] font-semibold"
        style={{ color: "var(--ink-2)" }}
      >
        {health}
      </span>
    </div>
  );
}
