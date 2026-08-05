"use client";

import { memo } from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import { Database, Loader2, User } from "lucide-react";
import type { ColumnProfile, DatasetMeta, DatasetProfile } from "@/lib/types";
import { HealthRing, Histogram, MissingMeter, StatusIcon, STATUS_COLOR, TopKBars } from "./micro";
import { topBins } from "@/lib/profile";

export type DatasetNodeData = {
  meta: DatasetMeta;
  profile?: DatasetProfile;
  running: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (urn: string, field?: string) => void;
};

const LAYER_LABEL: Record<DatasetMeta["layer"], string> = { raw: "RAW", staging: "STAGING", mart: "MART" };

function ColumnRow({ col, onClick }: { col: ColumnProfile; onClick: () => void }) {
  const worst = col.issues.reduce<"good" | "warning" | "serious" | "critical">(
    (acc, i) => (["good", "warning", "serious", "critical"].indexOf(i.severity) > ["good", "warning", "serious", "critical"].indexOf(acc) ? i.severity : acc),
    "good",
  );
  const flagged = col.issues.length > 0;
  const missingIssue = col.issues.find((i) => i.kind === "missing-spike");
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-left transition-colors"
      style={{ background: flagged ? "rgba(208,59,59,0.07)" : "transparent" }}
      title={col.issues.map((i) => i.message).join("\n") || `${col.field} · ${col.observedType}`}
    >
      <div className="w-[104px] shrink-0">
        <div className="flex items-center gap-1">
          {flagged && <StatusIcon level={worst} size={11} />}
          <span className="truncate text-[11px] font-medium" style={{ color: "var(--ink)" }}>
            {col.field}
          </span>
        </div>
        <div className="text-[9px]" style={{ color: flagged && worst === "critical" ? STATUS_COLOR.critical : "var(--ink-3)" }}>
          {col.declaredType}
          {col.issues.some((i) => i.kind === "type-drift" || i.kind === "contract-violation") && (
            <span> → {col.observedType.toLowerCase()}</span>
          )}
        </div>
      </div>
      <div className="flex-1">
        {col.histogram ? <Histogram bins={topBins(col.histogram)} /> : col.topk ? <TopKBars bins={col.topk} /> : null}
      </div>
      <div className="w-[72px] shrink-0">
        <MissingMeter pct={col.missingPct} flagged={Boolean(missingIssue)} severity={missingIssue?.severity ?? "good"} />
        <div className="tabular mt-[2px] text-[9px]" style={{ color: "var(--ink-3)" }}>
          {col.distinct.toLocaleString()} distinct
        </div>
      </div>
    </button>
  );
}

function DatasetNodeInner({ data }: { data: DatasetNodeData }) {
  const zoom = useStore((s) => s.transform[2]);
  const constellation = zoom < 0.45;
  const { meta, profile } = data;
  const worst = profile?.worst ?? "good";

  return (
    <div
      className={`relative rounded-xl transition-opacity ${data.dimmed ? "node-dimmed" : ""} card-glow-${worst}`}
      style={{ width: 340, background: "var(--surface)", cursor: "pointer" }}
      onClick={() => data.onSelect(meta.urn)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <Database size={14} color="var(--ink-3)" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold tracking-tight">{meta.name}</span>
            <span
              className="rounded-[4px] px-1 py-[1px] text-[8px] font-semibold tracking-wider"
              style={{ background: "var(--surface-raised)", color: "var(--ink-3)", border: "1px solid var(--border)" }}
            >
              {LAYER_LABEL[meta.layer]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9.5px]" style={{ color: "var(--ink-3)" }}>
            <span>{meta.platform}</span>
            <span className="flex items-center gap-0.5">
              <User size={9} /> {meta.owner}
            </span>
            {profile && <span className="tabular">{profile.rows.toLocaleString()} rows</span>}
          </div>
        </div>
        {data.running ? (
          <Loader2 size={18} className="animate-spin" color="var(--series)" />
        ) : profile ? (
          <HealthRing health={profile.health} worst={profile.worst} />
        ) : null}
      </div>

      <div className="mt-2 border-t px-2 pb-2 pt-1" style={{ borderColor: "var(--grid)", opacity: constellation ? 0.12 : 1 }}>
        {profile ? (
          profile.columns.map((col) => (
            <ColumnRow key={col.field} col={col} onClick={() => data.onSelect(meta.urn, col.field)} />
          ))
        ) : (
          <div className="px-2 py-3 text-[10px]" style={{ color: "var(--ink-3)" }}>
            {data.running ? "profiling in the browser…" : meta.csv ? "queued for profiling" : "metadata only — no local data registered"}
          </div>
        )}
      </div>

      {constellation && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1"
          style={{ transform: `scale(${Math.min(2.4, 1.1 / Math.max(zoom, 0.18))})` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[worst], boxShadow: `0 0 10px ${STATUS_COLOR[worst]}` }} />
            <span className="text-[13px] font-semibold">{meta.name}</span>
          </div>
          {profile && worst !== "good" && (
            <span className="flex items-center gap-1 text-[9px]" style={{ color: STATUS_COLOR[worst] }}>
              <StatusIcon level={worst} size={10} />
              {profile.columns.reduce((n, c) => n + c.issues.length, 0)} issues
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const DatasetNode = memo(DatasetNodeInner);
