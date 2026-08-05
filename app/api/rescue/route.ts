import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export type RescueCandidate = {
  ref: string;
  title: string;
  source: string;
  license?: string;
  pricing?: string;
  quality?: number;
  url?: string;
  summary?: string;
};

type FixtureShape = {
  byDataset: Record<string, { query: string; candidates: RescueCandidate[] }>;
};

async function fixtureFor(dataset: string): Promise<{ query: string; candidates: RescueCandidate[]; origin: string } | null> {
  const raw = await readFile(path.join(process.cwd(), "fixtures", "rescue.json"), "utf8");
  const parsed = JSON.parse(raw) as FixtureShape;
  const entry = parsed.byDataset[dataset];
  return entry ? { ...entry, origin: "mundaneum-fixture" } : null;
}

// Live path: query the local Mundaneum CLI (a 40k+ cross-catalog dataset directory
// spanning Databricks/Snowflake marketplaces, Kaggle, HF, data.gov, Datarade, ...).
async function liveSearch(query: string): Promise<RescueCandidate[] | null> {
  try {
    const { stdout } = await execFileAsync("mundaneum-pp-cli", ["search", query, "--limit", "4", "--agent"], {
      timeout: 20_000,
      env: { ...process.env, MUNDANEUM_NO_LEARN: "true" },
    });
    const parsed = JSON.parse(stdout) as { results?: { results?: Array<Record<string, unknown>> } };
    const rows = parsed.results?.results ?? [];
    return rows.map((r) => ({
      ref: String(r.ref ?? ""),
      title: String(r.title ?? r.ref ?? ""),
      source: String(r.source ?? "unknown"),
      license: r.license ? String(r.license) : undefined,
      pricing: r.pricing ? String(r.pricing) : undefined,
      quality: typeof r.quality === "number" ? r.quality : undefined,
      url: r.url ? String(r.url) : undefined,
      summary: r.summary ? String(r.summary) : undefined,
    }));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset") ?? "";
  const fixture = await fixtureFor(dataset);
  if (!fixture) return NextResponse.json({ query: "", candidates: [], origin: "none" });

  const live = await liveSearch(fixture.query);
  if (live && live.length > 0) {
    return NextResponse.json({ query: fixture.query, candidates: live, origin: "mundaneum-live" });
  }
  return NextResponse.json(fixture);
}
