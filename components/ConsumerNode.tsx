"use client";

import { memo } from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import { BrainCircuit, LayoutDashboard, User } from "lucide-react";
import type { ConsumerMeta, Severity } from "@/lib/types";
import { StatusIcon, STATUS_COLOR } from "./micro";

export type ConsumerNodeData = {
  meta: ConsumerMeta;
  impact: Severity | "good";
  dimmed: boolean;
  onSelect: (urn: string) => void;
};

function ConsumerNodeInner({ data }: { data: ConsumerNodeData }) {
  const zoom = useStore((s) => s.transform[2]);
  const constellation = zoom < 0.45;
  const { meta, impact } = data;
  const Icon = meta.type === "ml_model" ? BrainCircuit : LayoutDashboard;
  const atRisk = impact !== "good";

  return (
    <div
      className={`relative rounded-xl px-3.5 py-3 transition-opacity ${data.dimmed ? "node-dimmed" : ""} card-glow-${impact}`}
      style={{ width: 250, background: "var(--surface-raised)", cursor: "pointer" }}
      onClick={() => data.onSelect(meta.urn)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-2.5" style={{ opacity: constellation ? 0.12 : 1 }}>
        <Icon size={18} color={atRisk ? STATUS_COLOR[impact] : "var(--series)"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold tracking-tight">{meta.name}</div>
          <div className="flex items-center gap-2 text-[9.5px]" style={{ color: "var(--ink-3)" }}>
            <span>{meta.type === "ml_model" ? "ML model" : "dashboard"}</span>
            <span className="flex items-center gap-0.5">
              <User size={9} /> {meta.owner}
            </span>
          </div>
        </div>
      </div>
      {atRisk && (
        <div
          className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-[9.5px] font-semibold tracking-wide"
          style={{ background: "rgba(208,59,59,0.1)", color: STATUS_COLOR[impact], opacity: constellation ? 0.12 : 1 }}
        >
          <StatusIcon level={impact} size={11} />
          UPSTREAM QUALITY INCIDENT REACHES THIS {meta.type === "ml_model" ? "MODEL" : "DASHBOARD"}
        </div>
      )}
      {constellation && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5"
          style={{ transform: `scale(${Math.min(2.4, 1.1 / Math.max(zoom, 0.18))})` }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: atRisk ? STATUS_COLOR[impact] : "var(--series)", boxShadow: `0 0 10px ${atRisk ? STATUS_COLOR[impact] : "var(--series)"}` }}
          />
          <span className="text-[13px] font-semibold">{meta.name}</span>
        </div>
      )}
    </div>
  );
}

export const ConsumerNode = memo(ConsumerNodeInner);
