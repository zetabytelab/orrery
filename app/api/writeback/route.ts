import { NextRequest, NextResponse } from "next/server";
import { executeWriteback, isLiveConfigured } from "@/lib/datahub/mcp";
import type { WritebackPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const plan = (await request.json()) as WritebackPlan & { dryRun?: boolean };
  if (!Array.isArray(plan.calls) || plan.calls.length === 0) {
    return NextResponse.json({ error: "empty write-back plan" }, { status: 400 });
  }
  const allowedTools = new Set(["update_description", "add_tags", "add_structured_properties", "save_document"]);
  const disallowed = plan.calls.find((c) => !allowedTools.has(c.tool));
  if (disallowed) {
    return NextResponse.json({ error: `tool ${disallowed.tool} is not permitted in a write-back plan` }, { status: 400 });
  }

  if (plan.dryRun || !isLiveConfigured()) {
    return NextResponse.json({
      mode: "dry-run",
      executed: false,
      results: plan.calls.map((c) => ({ tool: c.tool, ok: true, detail: "dry-run: no live DataHub configured, call not sent" })),
    });
  }

  const results = await executeWriteback(plan.calls);
  return NextResponse.json({ mode: "live", executed: true, results });
}
