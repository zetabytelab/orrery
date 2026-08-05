import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { fetchEstateFromDataHub, isLiveConfigured } from "@/lib/datahub/mcp";
import type { EstateContext } from "@/lib/types";

export const dynamic = "force-dynamic";

async function fixture(): Promise<EstateContext> {
  const raw = await readFile(path.join(process.cwd(), "fixtures", "estate.json"), "utf8");
  return JSON.parse(raw) as EstateContext;
}

export async function GET(request: NextRequest) {
  const forced = request.nextUrl.searchParams.get("mode");
  if (forced !== "fixture" && isLiveConfigured()) {
    try {
      const csvNames = new Set(
        (await readdir(path.join(process.cwd(), "public", "estate"))).filter((f) => f.endsWith(".csv")).map((f) => f.replace(/\.csv$/, "")),
      );
      const estate = await fetchEstateFromDataHub(csvNames);
      if (estate.datasets.length > 0) return NextResponse.json(estate);
      const fallback = await fixture();
      return NextResponse.json({ ...fallback, liveError: "Live DataHub returned no matching datasets; showing the bundled fixture." });
    } catch (err) {
      const fallback = await fixture();
      return NextResponse.json({
        ...fallback,
        liveError: `Live DataHub unreachable (${err instanceof Error ? err.message : String(err)}); showing the bundled fixture.`,
      });
    }
  }
  return NextResponse.json(await fixture());
}
