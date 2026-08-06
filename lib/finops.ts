// FinOps exposure estimation. Every number is either measured from the data
// (value signals computed in DuckDB at profile time) or a labeled assumption
// (repair heuristic constants below) — never an unexplained score.
import type { DatasetProfile, EstateContext } from "./types";

export type FinopsSpec =
  | { kind: "daily_value"; valueColumn: string; dateColumn: string; label: string }
  | { kind: "population_at_risk"; filterColumn: string; filterValue: string; label: string };

// Keyed by dataset name so it works identically in fixture and live-DataHub modes.
export const FINOPS_SPECS: Record<string, FinopsSpec> = {
  fct_revenue_daily: {
    kind: "daily_value",
    valueColumn: "revenue_eur",
    dateColumn: "order_date",
    label: "net revenue steered per day",
  },
  dim_customer_health: {
    kind: "population_at_risk",
    filterColumn: "churn_risk_band",
    filterValue: "high",
    label: "high-churn-risk customers whose retention decisions depend on this table",
  },
};

// Repair-effort heuristic — assumptions surfaced verbatim in the UI.
export const REPAIR_ASSUMPTIONS = {
  triageHours: 2,
  hoursPerDownstreamAsset: 1.5,
  backfillHoursPerCorruptedDataset: 2,
  blendedRateEurPerHour: 110,
};

export type ExposureLine = { asset: string; kind: "steers" | "protects"; text: string };

export function buildExposure(
  estate: EstateContext,
  profiles: Record<string, DatasetProfile>,
  propagation: Set<string>,
  selectedUrn: string,
): { lines: ExposureLine[]; repairHours: number; repairEur: number; formula: string } {
  const upstreamOf = new Map<string, string[]>();
  for (const e of estate.edges) upstreamOf.set(e.downstream, [...(upstreamOf.get(e.downstream) ?? []), e.upstream]);

  const lines: ExposureLine[] = [];
  for (const consumer of estate.consumers) {
    if (!propagation.has(consumer.urn)) continue;
    for (const up of upstreamOf.get(consumer.urn) ?? []) {
      const signal = profiles[up]?.finops;
      if (!signal) continue;
      if (signal.eurPerDay !== undefined) {
        lines.push({
          asset: consumer.name,
          kind: "steers",
          text: `steers ~€${Math.round(signal.eurPerDay).toLocaleString()}/day of ${signal.label} (measured from the data)`,
        });
      }
      if (signal.population !== undefined) {
        lines.push({
          asset: consumer.name,
          kind: "protects",
          text: `acts on ${signal.population.toLocaleString()} ${signal.label} (measured from the data)`,
        });
      }
    }
  }

  const downstreamAssets = [...propagation].filter((u) => u !== selectedUrn).length;
  const corrupted = [...propagation].filter((u) => (profiles[u]?.worst ?? "good") !== "good").length;
  const { triageHours, hoursPerDownstreamAsset, backfillHoursPerCorruptedDataset, blendedRateEurPerHour } = REPAIR_ASSUMPTIONS;
  const repairHours = triageHours + hoursPerDownstreamAsset * downstreamAssets + backfillHoursPerCorruptedDataset * corrupted;
  const repairEur = repairHours * blendedRateEurPerHour;
  const formula = `${triageHours}h triage + ${hoursPerDownstreamAsset}h × ${downstreamAssets} downstream assets + ${backfillHoursPerCorruptedDataset}h backfill × ${corrupted} corrupted datasets, at €${blendedRateEurPerHour}/h blended`;

  return { lines, repairHours, repairEur, formula };
}
