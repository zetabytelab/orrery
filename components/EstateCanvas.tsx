"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import { Background, BackgroundVariant, MiniMap, ReactFlow, type Edge, type Node, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DatasetProfile, EstateContext, Severity } from "@/lib/types";
import { DatasetNode, type DatasetNodeData } from "./DatasetNode";
import { ConsumerNode, type ConsumerNodeData } from "./ConsumerNode";

const nodeTypes = { dataset: DatasetNode, consumer: ConsumerNode };

type Props = {
  estate: EstateContext;
  profiles: Record<string, DatasetProfile>;
  runningUrn: string | null;
  selection: { urn: string; field?: string } | null;
  propagation: Set<string>;
  consumerImpact: Record<string, Severity | "good">;
  onSelect: (urn: string, field?: string) => void;
};

export function EstateCanvas({ estate, profiles, runningUrn, selection, propagation, consumerImpact, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 46, ranksep: 150, marginx: 60, marginy: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    const dims = new Map<string, { width: number; height: number }>();
    for (const d of estate.datasets) {
      const cols = profiles[d.urn]?.columns.length ?? d.schema.length;
      dims.set(d.urn, { width: 340, height: 74 + Math.max(1, cols) * 42 });
    }
    for (const c of estate.consumers) dims.set(c.urn, { width: 250, height: consumerImpact[c.urn] !== "good" ? 106 : 66 });

    for (const [urn, size] of dims) g.setNode(urn, size);
    for (const e of estate.edges) if (dims.has(e.upstream) && dims.has(e.downstream)) g.setEdge(e.upstream, e.downstream);
    dagre.layout(g);

    const dimActive = selection !== null;
    const flowNodes: Node[] = [];
    for (const d of estate.datasets) {
      const pos = g.node(d.urn);
      flowNodes.push({
        id: d.urn,
        type: "dataset",
        position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
        data: {
          meta: d,
          profile: profiles[d.urn],
          running: runningUrn === d.urn,
          dimmed: dimActive && !propagation.has(d.urn),
          selected: selection?.urn === d.urn,
          onSelect,
        } satisfies DatasetNodeData as unknown as Record<string, unknown>,
      });
    }
    for (const c of estate.consumers) {
      const pos = g.node(c.urn);
      flowNodes.push({
        id: c.urn,
        type: "consumer",
        position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
        data: {
          meta: c,
          impact: consumerImpact[c.urn] ?? "good",
          dimmed: dimActive && !propagation.has(c.urn),
          onSelect,
        } satisfies ConsumerNodeData as unknown as Record<string, unknown>,
      });
    }

    const flowEdges: Edge[] = estate.edges
      .filter((e) => dims.has(e.upstream) && dims.has(e.downstream))
      .map((e) => {
        const propagating = dimActive && propagation.has(e.upstream) && propagation.has(e.downstream);
        return {
          id: `${e.upstream}→${e.downstream}`,
          source: e.upstream,
          target: e.downstream,
          className: propagating ? "edge-propagating" : dimActive ? "edge-dimmed" : "",
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: propagating ? "#fab219" : "#383835" },
        };
      });

    return { nodes: flowNodes, edges: flowEdges };
  }, [estate, profiles, runningUrn, selection, propagation, consumerImpact, onSelect]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.1}
      maxZoom={1.75}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable={false}
      onPaneClick={() => onSelect("", undefined)}
      style={{ background: "transparent" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={34} size={1} color="#2c2c2a" />
      <MiniMap
        pannable
        zoomable
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
        maskColor="rgba(13,13,13,0.75)"
        nodeColor={(n) => {
          const worst = n.type === "consumer" ? consumerImpact[n.id] ?? "good" : profiles[n.id]?.worst ?? "good";
          return worst === "critical" ? "#d03b3b" : worst === "serious" ? "#ec835a" : worst === "warning" ? "#fab219" : "#383835";
        }}
      />
    </ReactFlow>
  );
}
