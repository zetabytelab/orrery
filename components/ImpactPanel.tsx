"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Radio, Send, Users, X } from "lucide-react";
import type { DatasetProfile, EstateContext, Severity, WritebackCall } from "@/lib/types";
import { StatusIcon, STATUS_COLOR } from "./micro";

type Props = {
  estate: EstateContext;
  profiles: Record<string, DatasetProfile>;
  selection: { urn: string; field?: string };
  propagation: Set<string>;
  live: boolean;
  onClose: () => void;
};

type SendState = { status: "idle" | "sending" | "done" | "error"; results?: Array<{ tool: string; ok: boolean; detail: string }>; mode?: string };

export function buildWritebackPlan(urn: string, name: string, profile: DatasetProfile, downstreamNames: string[]): WritebackCall[] {
  const issueLines = profile.columns
    .flatMap((c) => c.issues.map((i) => `- \`${c.field}\`: ${i.message}`))
    .join("\n");
  const marker = `orrery-profile ${profile.profiledAt.slice(0, 10)}`;
  const summary = [
    `**Orrery data profile** \`[${marker}]\``,
    ``,
    `Health **${profile.health}/100** over ${profile.rows.toLocaleString()} rows, ${profile.columns.length} columns.`,
    issueLines ? `\nObserved issues:\n${issueLines}` : `\nNo issues observed.`,
    downstreamNames.length ? `\nDownstream blast radius: ${downstreamNames.join(", ")}.` : "",
  ].join("\n");

  const calls: WritebackCall[] = [{ tool: "update_description", args: { urn, description: summary } }];
  if (profile.worst !== "good") {
    calls.push({ tool: "add_tags", args: { urn, tags: [`urn:li:tag:orrery-${profile.worst}`] } });
  }
  return calls;
}

export function ImpactPanel({ estate, profiles, selection, propagation, live, onClose }: Props) {
  const [send, setSend] = useState<SendState>({ status: "idle" });

  const dataset = estate.datasets.find((d) => d.urn === selection.urn);
  const consumer = estate.consumers.find((c) => c.urn === selection.urn);
  const profile = dataset ? profiles[dataset.urn] : undefined;

  const downstream = useMemo(() => {
    const ds = estate.datasets.filter((d) => d.urn !== selection.urn && propagation.has(d.urn));
    const cs = estate.consumers.filter((c) => propagation.has(c.urn));
    return { datasets: ds, consumers: cs };
  }, [estate, propagation, selection.urn]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const d of downstream.datasets) set.add(d.owner);
    for (const c of downstream.consumers) set.add(c.owner);
    return [...set];
  }, [downstream]);

  const plan = useMemo(() => {
    if (!dataset || !profile) return [];
    return buildWritebackPlan(dataset.urn, dataset.name, profile, [
      ...downstream.datasets.map((d) => d.name),
      ...downstream.consumers.map((c) => c.name),
    ]);
  }, [dataset, profile, downstream]);

  const focusedColumn = selection.field && profile ? profile.columns.find((c) => c.field === selection.field) : undefined;

  const doSend = async () => {
    setSend({ status: "sending" });
    try {
      const resp = await fetch("/api/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urn: selection.urn, calls: plan }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? resp.statusText);
      setSend({ status: "done", results: body.results, mode: body.mode });
    } catch (err) {
      setSend({ status: "error", results: [{ tool: "—", ok: false, detail: err instanceof Error ? err.message : String(err) }] });
    }
  };

  const title = dataset?.name ?? consumer?.name ?? "";
  const issues = profile?.columns.flatMap((c) => c.issues.map((i) => ({ field: c.field, ...i }))) ?? [];

  return (
    <aside
      className="absolute right-4 top-16 bottom-4 z-20 flex w-[360px] flex-col overflow-hidden rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 18px 50px rgba(0,0,0,0.55)" }}
    >
      <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5" style={{ borderBottom: "1px solid var(--grid)" }}>
        <div>
          <div className="text-[14px] font-semibold tracking-tight">{title}</div>
          <div className="text-[10px]" style={{ color: "var(--ink-3)" }}>
            {dataset ? `${dataset.platform} · owned by ${dataset.owner}` : consumer ? `${consumer.type === "ml_model" ? "ML model" : "dashboard"} · owned by ${consumer.owner}` : ""}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-white/5" aria-label="close">
          <X size={15} color="var(--ink-3)" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {focusedColumn && focusedColumn.issues.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "var(--ink-3)" }}>
              FOCUSED COLUMN
            </h3>
            {focusedColumn.issues.map((i, k) => (
              <div key={k} className="mb-1.5 flex gap-2 rounded-lg p-2.5 text-[11px] leading-snug" style={{ background: "var(--surface-raised)" }}>
                <StatusIcon level={i.severity} size={14} />
                <div>
                  <span className="font-semibold">{focusedColumn.field}</span> — {i.message}
                </div>
              </div>
            ))}
          </section>
        )}

        {issues.length > 0 && !focusedColumn && (
          <section>
            <h3 className="mb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "var(--ink-3)" }}>
              OBSERVED ISSUES
            </h3>
            {issues.map((i, k) => (
              <div key={k} className="mb-1.5 flex gap-2 rounded-lg p-2.5 text-[11px] leading-snug" style={{ background: "var(--surface-raised)" }}>
                <StatusIcon level={i.severity} size={14} />
                <div>
                  <span className="font-semibold">{i.field}</span> — {i.message}
                </div>
              </div>
            ))}
          </section>
        )}

        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "var(--ink-3)" }}>
            <Radio size={11} /> BLAST RADIUS — REAL DATAHUB LINEAGE
          </h3>
          {downstream.datasets.length + downstream.consumers.length === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              Nothing downstream of this node.
            </p>
          ) : (
            <ul className="space-y-1">
              {[...downstream.datasets, ...downstream.consumers].map((n) => (
                <li key={n.urn} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]" style={{ background: "var(--surface-raised)" }}>
                  <ArrowRight size={11} color="var(--status-warning)" />
                  <span className="flex-1 truncate font-medium">{n.name}</span>
                  <span className="text-[9.5px]" style={{ color: "var(--ink-3)" }}>
                    {n.owner}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {owners.length > 0 && (
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "var(--ink-3)" }}>
              <Users size={11} /> TEAMS TO NOTIFY
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {owners.map((o) => (
                <span key={o} className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  {o}
                </span>
              ))}
            </div>
          </section>
        )}

        {dataset && profile && (
          <section>
            <h3 className="mb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "var(--ink-3)" }}>
              WRITE BACK TO DATAHUB — VIA MCP SERVER
            </h3>
            <div className="space-y-1.5">
              {plan.map((call, k) => (
                <details key={k} className="rounded-lg text-[10.5px]" style={{ background: "var(--surface-raised)" }}>
                  <summary className="cursor-pointer px-2.5 py-1.5 font-mono font-medium" style={{ color: "var(--seq-250)" }}>
                    {call.tool}
                  </summary>
                  <pre className="overflow-x-auto px-2.5 pb-2 text-[9.5px] leading-snug" style={{ color: "var(--ink-2)" }}>
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
            <button
              onClick={doSend}
              disabled={send.status === "sending" || send.status === "done"}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11.5px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "var(--series-soft)", color: "var(--ink)" }}
            >
              <Send size={12} />
              {send.status === "sending"
                ? "Sending…"
                : send.status === "done"
                  ? send.mode === "live"
                    ? "Written to DataHub"
                    : "Dry-run complete"
                  : live
                    ? "Write profile to DataHub"
                    : "Preview write-back (dry-run)"}
            </button>
            {send.results && (
              <ul className="mt-2 space-y-1">
                {send.results.map((r, k) => (
                  <li key={k} className="flex items-start gap-1.5 text-[10px] leading-snug" style={{ color: r.ok ? "var(--ink-2)" : STATUS_COLOR.critical }}>
                    <span className="font-mono">{r.tool}</span> — {r.detail}
                  </li>
                ))}
              </ul>
            )}
            {!live && (
              <p className="mt-1.5 text-[9.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
                No live DataHub configured — the exact MCP tool calls above are shown as a dry-run. Set DATAHUB_GMS_URL to execute them.
              </p>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
