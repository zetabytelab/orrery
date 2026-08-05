"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { getDuckDB } from "@/lib/duckdb";
import { profileDataset } from "@/lib/profile";
import type { DatasetProfile, EstateContext, Severity } from "@/lib/types";
import { EstateCanvas } from "@/components/EstateCanvas";
import { ImpactPanel } from "@/components/ImpactPanel";
import { TopBar } from "@/components/TopBar";

const SEVERITY_RANK: Record<Severity | "good", number> = { good: 0, warning: 1, serious: 2, critical: 3 };

export default function Home() {
  const [estate, setEstate] = useState<EstateContext | null>(null);
  const [profiles, setProfiles] = useState<Record<string, DatasetProfile>>({});
  const [runningUrn, setRunningUrn] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ urn: string; field?: string } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then(setEstate)
      .catch(() => setEstate(null));
  }, []);

  useEffect(() => {
    if (!estate || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const db = await getDuckDB();
      for (const dataset of estate.datasets) {
        if (!dataset.csv) continue;
        setRunningUrn(dataset.urn);
        try {
          const profile = await profileDataset(db, dataset);
          setProfiles((prev) => ({ ...prev, [dataset.urn]: profile }));
        } catch (err) {
          console.warn(`[orrery] profiling ${dataset.name} failed`, err);
        }
      }
      setRunningUrn(null);
    })();
  }, [estate]);

  const adjacency = useMemo(() => {
    const down = new Map<string, string[]>();
    const up = new Map<string, string[]>();
    for (const e of estate?.edges ?? []) {
      down.set(e.upstream, [...(down.get(e.upstream) ?? []), e.downstream]);
      up.set(e.downstream, [...(up.get(e.downstream) ?? []), e.upstream]);
    }
    return { down, up };
  }, [estate]);

  const closure = useCallback((start: string, dir: "down" | "up") => {
    const adj = dir === "down" ? adjacency.down : adjacency.up;
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  }, [adjacency]);

  const propagation = useMemo(
    () => (selection ? closure(selection.urn, "down") : new Set<string>()),
    [selection, closure],
  );

  const consumerImpact = useMemo(() => {
    const impact: Record<string, Severity | "good"> = {};
    for (const c of estate?.consumers ?? []) {
      let worst: Severity | "good" = "good";
      for (const urn of closure(c.urn, "up")) {
        const p = profiles[urn];
        if (p && SEVERITY_RANK[p.worst] > SEVERITY_RANK[worst]) worst = p.worst;
      }
      impact[c.urn] = worst;
    }
    return impact;
  }, [estate, profiles, closure]);

  const onSelect = useCallback((urn: string, field?: string) => {
    setSelection(urn ? { urn, field } : null);
  }, []);

  const profilable = estate?.datasets.filter((d) => d.csv).length ?? 0;

  useEffect(() => {
    // Debug/export surface: lets `examples/` sample outputs be captured verbatim.
    (window as unknown as Record<string, unknown>).__orrery = { estate, profiles, consumerImpact };
  }, [estate, profiles, consumerImpact]);

  return (
    <main className="relative h-screen w-screen">
      <TopBar estate={estate} profiledCount={Object.keys(profiles).length} profilableCount={profilable} />
      {estate ? (
        <ReactFlowProvider>
          <EstateCanvas
            estate={estate}
            profiles={profiles}
            runningUrn={runningUrn}
            selection={selection}
            propagation={propagation}
            consumerImpact={consumerImpact}
            onSelect={onSelect}
          />
        </ReactFlowProvider>
      ) : (
        <div className="flex h-full items-center justify-center text-[12px]" style={{ color: "var(--ink-3)" }}>
          loading the estate…
        </div>
      )}
      {selection && estate && (
        <ImpactPanel
          estate={estate}
          profiles={profiles}
          selection={selection}
          propagation={propagation}
          live={estate.source === "datahub"}
          onClose={() => setSelection(null)}
        />
      )}
    </main>
  );
}
