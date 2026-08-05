"use client";

import { Orbit } from "lucide-react";
import type { EstateContext } from "@/lib/types";
import { StatusIcon } from "./micro";

type Props = {
  estate: EstateContext | null;
  profiledCount: number;
  profilableCount: number;
};

export function TopBar({ estate, profiledCount, profilableCount }: Props) {
  const live = estate?.source === "datahub";
  return (
    <header
      className="absolute left-4 right-4 top-4 z-20 flex items-center gap-4 rounded-2xl px-4 py-2.5"
      style={{ background: "rgba(26,26,25,0.88)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-2">
        <Orbit size={18} color="var(--series)" />
        <span className="text-[14px] font-semibold tracking-tight">Orrery</span>
        <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>
          DataHub estate observatory
        </span>
      </div>

      <div className="h-4 w-px" style={{ background: "var(--grid)" }} />

      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-[3px] text-[9px] font-bold tracking-widest"
          style={{
            background: live ? "rgba(12,163,12,0.12)" : "var(--surface-raised)",
            color: live ? "var(--status-good)" : "var(--ink-2)",
            border: "1px solid var(--border)",
          }}
          title={estate?.liveError ?? (live ? "reading live metadata through the DataHub MCP server" : "bundled demo estate — no DataHub required")}
        >
          {live ? "LIVE · DATAHUB MCP" : "DEMO ESTATE"}
        </span>
        {estate && (
          <span className="text-[10.5px]" style={{ color: "var(--ink-2)" }}>
            {estate.domain}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-[9.5px]" style={{ color: "var(--ink-3)" }}>
        <span className="flex items-center gap-1">
          <StatusIcon level="good" size={10} /> healthy
        </span>
        <span className="flex items-center gap-1">
          <StatusIcon level="warning" size={10} /> warning
        </span>
        <span className="flex items-center gap-1">
          <StatusIcon level="serious" size={10} /> serious
        </span>
        <span className="flex items-center gap-1">
          <StatusIcon level="critical" size={10} /> critical
        </span>
      </div>

      <div className="h-4 w-px" style={{ background: "var(--grid)" }} />

      <span className="tabular text-[10.5px]" style={{ color: "var(--ink-2)" }}>
        {profiledCount}/{profilableCount} profiled in-browser
      </span>
    </header>
  );
}
