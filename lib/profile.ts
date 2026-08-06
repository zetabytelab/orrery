"use client";

import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Bin, ColumnIssue, ColumnProfile, DatasetMeta, DatasetProfile, FinopsSignal, Severity } from "./types";
import { FINOPS_SPECS } from "./finops";

const ISO_TS = "^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}";
const NUMERIC = "^-?\\d+(\\.\\d+)?$";

const one = async (conn: AsyncDuckDBConnection, sql: string): Promise<Record<string, unknown>> => {
  const table = await conn.query(sql);
  return table.toArray()[0] ?? {};
};
const many = async (conn: AsyncDuckDBConnection, sql: string): Promise<Record<string, unknown>[]> =>
  (await conn.query(sql)).toArray().map((r) => ({ ...r }));

const num = (v: unknown): number => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));
const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
};

// Declared types (from the DataHub schema) that the observed DuckDB type must satisfy.
const COMPATIBLE: Record<string, string[]> = {
  string: ["VARCHAR"],
  boolean: ["BOOLEAN", "VARCHAR"],
  date: ["DATE", "TIMESTAMP"],
  timestamp: ["TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "DATE"],
  double: ["DOUBLE", "FLOAT", "DECIMAL", "BIGINT", "INTEGER"],
  long: ["BIGINT", "INTEGER", "SMALLINT", "TINYINT", "HUGEINT"],
};

export async function profileDataset(db: AsyncDuckDB, meta: DatasetMeta): Promise<DatasetProfile> {
  const conn = await db.connect();
  try {
    const resp = await fetch(meta.csv);
    if (!resp.ok) throw new Error(`fetch ${meta.csv}: ${resp.status}`);
    await db.registerFileBuffer(meta.name, new Uint8Array(await resp.arrayBuffer()));
    await conn.query(`CREATE OR REPLACE TABLE "${meta.name}" AS SELECT * FROM read_csv_auto('${meta.name}', sample_size=-1)`);

    const rows = num((await one(conn, `SELECT count(*) AS n FROM "${meta.name}"`)).n);
    const observed = await many(
      conn,
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${meta.name}' ORDER BY ordinal_position`,
    );
    const observedTypes = new Map(observed.map((r) => [String(r.column_name), String(r.data_type)]));

    const columns: ColumnProfile[] = [];
    for (const field of meta.schema) {
      const col = field.field;
      const observedType = observedTypes.get(col) ?? "MISSING";
      const q = `"${col}"`;
      const isText = observedType === "VARCHAR";
      const missingExpr = isText ? `count(*) FILTER (WHERE ${q} IS NULL OR trim(${q}) = '')` : `count(*) FILTER (WHERE ${q} IS NULL)`;
      const base = await one(
        conn,
        `SELECT ${missingExpr} AS missing, count(DISTINCT ${q}) AS distinct_n, min(${q}) AS min_v, max(${q}) AS max_v FROM "${meta.name}"`,
      );
      const missingPct = rows === 0 ? 0 : (num(base.missing) / rows) * 100;

      const profile: ColumnProfile = {
        field: col,
        declaredType: field.type,
        observedType,
        missingPct,
        distinct: num(base.distinct_n),
        min: fmt(base.min_v),
        max: fmt(base.max_v),
        issues: [],
      };

      const isNumeric = ["BIGINT", "INTEGER", "DOUBLE", "FLOAT", "DECIMAL", "SMALLINT", "HUGEINT"].some((t) => observedType.startsWith(t));
      const isTemporal = observedType.startsWith("TIMESTAMP") || observedType === "DATE";

      if (isNumeric && num(base.distinct_n) > 1) {
        profile.histogram = (
          await many(
            conn,
            `WITH b AS (SELECT least(11, greatest(0, floor((${q} - ${num(base.min_v)}) / nullif(${num(base.max_v)} - ${num(base.min_v)}, 0) * 12)))::INT AS bin FROM "${meta.name}" WHERE ${q} IS NOT NULL)
             SELECT bin, count(*) AS n FROM b GROUP BY bin ORDER BY bin`,
          )
        ).map((r) => ({ label: `bin ${num(r.bin)}`, count: num(r.n) }));
      } else if (isTemporal) {
        profile.histogram = (
          await many(
            conn,
            `SELECT strftime(${q}, '%m-%d') AS d, count(*) AS n FROM "${meta.name}" WHERE ${q} IS NOT NULL GROUP BY 1 ORDER BY 1`,
          )
        ).map((r) => ({ label: String(r.d), count: num(r.n) }));
      } else if (isText) {
        profile.topk = (
          await many(
            conn,
            `SELECT coalesce(nullif(trim(${q}), ''), '∅ empty') AS v, count(*) AS n FROM "${meta.name}" GROUP BY 1 ORDER BY n DESC LIMIT 6`,
          )
        ).map((r) => ({ label: String(r.v), count: num(r.n) }));
        const pat = await one(
          conn,
          `SELECT count(*) FILTER (WHERE regexp_matches(${q}, '${ISO_TS}')) AS iso,
                  count(*) FILTER (WHERE regexp_matches(${q}, '${NUMERIC}')) AS num,
                  count(*) FILTER (WHERE ${q} IS NULL OR trim(${q}) = '') AS empty,
                  count(*) AS total
           FROM "${meta.name}"`,
        );
        const total = Math.max(1, num(pat.total));
        profile.patternBreakdown = {
          isoTimestamp: (num(pat.iso) / total) * 100,
          numeric: (num(pat.num) / total) * 100,
          empty: (num(pat.empty) / total) * 100,
          other: Math.max(0, 100 - ((num(pat.iso) + num(pat.num) + num(pat.empty)) / total) * 100),
        };
      }

      columns.push(withIssues(profile));
    }

    const profile = finalize(meta.urn, rows, columns);

    // Business value signals, measured from the data itself (never invented).
    const spec = FINOPS_SPECS[meta.name];
    if (spec) {
      try {
        const finops: FinopsSignal = { label: spec.label };
        if (spec.kind === "daily_value") {
          const r = await one(
            conn,
            `SELECT sum("${spec.valueColumn}") / nullif(count(DISTINCT "${spec.dateColumn}"), 0) AS v FROM "${meta.name}"`,
          );
          finops.eurPerDay = num(r.v);
        } else {
          const r = await one(
            conn,
            `SELECT count(*) AS v FROM "${meta.name}" WHERE "${spec.filterColumn}" = '${spec.filterValue}'`,
          );
          finops.population = num(r.v);
        }
        profile.finops = finops;
      } catch {
        // exposure signal is optional; profiling itself already succeeded
      }
    }

    return profile;
  } finally {
    await conn.close();
  }
}

function withIssues(p: ColumnProfile): ColumnProfile {
  const issues: ColumnIssue[] = [];
  const compatible = COMPATIBLE[p.declaredType] ?? [];
  const contractBroken = compatible.length > 0 && !compatible.some((t) => p.observedType.startsWith(t));

  if (contractBroken) {
    const drift = p.patternBreakdown;
    if (drift && (p.declaredType === "timestamp" || p.declaredType === "date") && drift.numeric > 0) {
      issues.push({
        kind: "type-drift",
        severity: "critical",
        message: `Declared ${p.declaredType} in DataHub, but ${drift.numeric.toFixed(1)}% of values are epoch-style numerics — mixed formats broke type inference (observed ${p.observedType}).`,
      });
    } else {
      issues.push({
        kind: "contract-violation",
        severity: "critical",
        message: `DataHub schema declares ${p.declaredType}; observed data reads as ${p.observedType}.`,
      });
    }
  }

  if (p.missingPct >= 2) {
    issues.push({
      kind: "missing-spike",
      severity: p.missingPct >= 10 ? "serious" : "warning",
      message: `${p.missingPct.toFixed(1)}% of values are missing or empty.`,
    });
  }

  return { ...p, issues };
}

const SEVERITY_RANK: Record<Severity | "good", number> = { good: 0, warning: 1, serious: 2, critical: 3 };

function finalize(urn: string, rows: number, columns: ColumnProfile[]): DatasetProfile {
  let health = 100;
  let worst: Severity | "good" = "good";
  for (const c of columns) {
    for (const i of c.issues) {
      health -= i.severity === "critical" ? 35 : i.severity === "serious" ? 20 : 8;
      if (SEVERITY_RANK[i.severity] > SEVERITY_RANK[worst]) worst = i.severity;
    }
  }
  return { urn, rows, columns, health: Math.max(0, health), worst, profiledAt: new Date().toISOString() };
}

export function topBins(bins: Bin[] | undefined, n = 24): Bin[] {
  if (!bins) return [];
  if (bins.length <= n) return bins;
  const step = bins.length / n;
  return Array.from({ length: n }, (_, i) => bins[Math.floor(i * step)]);
}
