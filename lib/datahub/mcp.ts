// Server-side client for the official DataHub MCP server (uvx mcp-server-datahub).
// All live reads and write-backs go through MCP tools — never raw GraphQL — so the
// integration surface is exactly what any other agent connected to DataHub would use.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { EstateContext, WritebackCall } from "../types";

declare global {
  // eslint-disable-next-line no-var
  var __datahubMcp: Promise<Client> | undefined;
}

export function isLiveConfigured(): boolean {
  return Boolean(process.env.DATAHUB_GMS_URL);
}

async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "uvx",
    args: ["mcp-server-datahub@latest"],
    env: {
      ...(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>),
      DATAHUB_GMS_URL: process.env.DATAHUB_GMS_URL ?? "",
      DATAHUB_GMS_TOKEN: process.env.DATAHUB_GMS_TOKEN ?? "",
      // Orrery's write-back uses the server's mutation tools (update_description,
      // add_tags, save_document); the OSS server ships them disabled by default.
      TOOLS_IS_MUTATION_ENABLED: "true",
    },
  });
  const client = new Client({ name: "orrery", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

export function getMcp(): Promise<Client> {
  if (!globalThis.__datahubMcp) globalThis.__datahubMcp = connect();
  return globalThis.__datahubMcp;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = await getMcp();
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text?: string }> | undefined)
    ?.filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
  if (result.isError) throw new Error(`MCP tool ${name} failed: ${text ?? "unknown error"}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type AnyRecord = Record<string, unknown>;
const get = (obj: unknown, path: string[]): unknown =>
  path.reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as AnyRecord)[key] : undefined), obj);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

function entityName(entity: AnyRecord): string {
  const urn = str(entity.urn);
  const candidates = [get(entity, ["name"]), get(entity, ["properties", "name"]), urn.split(",").at(-2)?.split(".").at(-1)];
  return str(candidates.find((c) => typeof c === "string" && c.length > 0), urn);
}

function platformOf(urn: string): string {
  const m = urn.match(/dataPlatform:([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "unknown";
}

// Best-effort mapping from live DataHub search + lineage into the estate shape the
// canvas renders. Datasets whose name matches a bundled demo CSV get a local data
// path so profiling still runs in-browser; anything else renders metadata-only.
export async function fetchEstateFromDataHub(localCsvNames: Set<string>): Promise<EstateContext> {
  const query = process.env.ORRERY_DATAHUB_QUERY ?? "orrery";
  const search = (await callTool("search", { query, num_results: 40 })) as AnyRecord;
  const rawResults =
    (get(search, ["results"]) as unknown[]) ??
    (get(search, ["searchResults"]) as unknown[]) ??
    (Array.isArray(search) ? (search as unknown[]) : []);

  let entities = rawResults
    .map((r) => (get(r, ["entity"]) ?? r) as AnyRecord)
    .filter((e) => str(e.urn).length > 0);

  // Search results omit ownership/tags; hydrate every entity in one batch call.
  try {
    const detailed = (await callTool("get_entities", { urns: entities.map((e) => str(e.urn)) })) as unknown;
    const detailedList = (Array.isArray(detailed) ? detailed : (get(detailed, ["entities"]) as unknown[]) ?? []) as AnyRecord[];
    const byUrn = new Map(detailedList.map((e) => [str(e.urn), e]));
    entities = entities.map((e) => byUrn.get(str(e.urn)) ?? e);
  } catch {
    // fall back to the thinner search results
  }

  const datasets: EstateContext["datasets"] = [];
  const consumers: EstateContext["consumers"] = [];
  const edges: EstateContext["edges"] = [];
  const seenEdges = new Set<string>();

  for (const entity of entities) {
    const urn = str(entity.urn);
    const name = entityName(entity);
    const description = str(get(entity, ["properties", "description"]) ?? get(entity, ["description"]));
    const ownerRaw = get(entity, ["ownership", "owners"]) as unknown[] | undefined;
    const owner =
      str(get(ownerRaw?.[0], ["owner", "name"])) ||
      (str(get(ownerRaw?.[0], ["owner", "urn"]), "unknown").split(":").at(-1) ?? "unknown");
    const tagsRaw = (get(entity, ["tags", "tags"]) as unknown[] | undefined) ?? [];
    const tags = tagsRaw.map((t) => str(get(t, ["tag", "urn"])).split(":").at(-1) ?? "").filter(Boolean);

    if (urn.startsWith("urn:li:dataset:")) {
      let schema: EstateContext["datasets"][number]["schema"] = [];
      try {
        const fields = (await callTool("list_schema_fields", { urn })) as AnyRecord;
        const fieldList = (get(fields, ["fields"]) as unknown[]) ?? (Array.isArray(fields) ? (fields as unknown[]) : []);
        schema = fieldList.map((f) => ({
          field: str(get(f, ["fieldPath"]) ?? get(f, ["field"]) ?? get(f, ["name"])),
          type: str(get(f, ["nativeDataType"]) ?? get(f, ["type"]), "string").toLowerCase(),
          description: str(get(f, ["description"])),
        }));
      } catch {
        // schema stays empty; the card still renders from profiling alone
      }
      const shortName = name.split(".").at(-1) ?? name;
      datasets.push({
        urn,
        name: shortName,
        platform: platformOf(urn),
        layer: shortName.startsWith("raw") ? "raw" : shortName.startsWith("stg") ? "staging" : "mart",
        description,
        owner,
        tags,
        csv: localCsvNames.has(shortName) ? `/estate/${shortName}.csv` : "",
        schema,
      });
    } else if (urn.startsWith("urn:li:mlModel:") || urn.startsWith("urn:li:dashboard:")) {
      consumers.push({
        urn,
        name,
        type: urn.startsWith("urn:li:mlModel:") ? "ml_model" : "dashboard",
        description,
        owner,
        tags,
      });
    }

    if (urn.startsWith("urn:li:dataset:")) {
      try {
        const lineage = (await callTool("get_lineage", { urn, upstream: false, max_hops: 1, max_results: 30 })) as AnyRecord;
        for (const rel of (get(lineage, ["downstreams", "searchResults"]) as unknown[]) ?? []) {
          const downstream = str(get(rel, ["entity", "urn"]));
          if (!downstream || !downstream.startsWith("urn:li:dataset:")) continue;
          const key = `${urn}→${downstream}`;
          if (!seenEdges.has(key)) {
            seenEdges.add(key);
            edges.push({ upstream: urn, downstream });
          }
        }
      } catch {
        // no lineage for this entity is fine
      }
    }
  }

  // Consumers (models, dashboards) may sit several hops from their source datasets
  // (e.g. dataset -> training dataJob -> mlModel); trace their upstreams transitively
  // and connect them to the nearest known datasets.
  const datasetUrns = new Set(datasets.map((d) => d.urn));
  for (const consumer of consumers) {
    try {
      const lineage = (await callTool("get_lineage", { urn: consumer.urn, upstream: true, max_hops: 3, max_results: 30 })) as AnyRecord;
      const hits: Array<{ urn: string; degree: number }> = [];
      for (const rel of (get(lineage, ["upstreams", "searchResults"]) as unknown[]) ?? []) {
        const upstream = str(get(rel, ["entity", "urn"]));
        if (!datasetUrns.has(upstream)) continue;
        const degreeRaw = get(rel, ["degree"]);
        hits.push({ urn: upstream, degree: typeof degreeRaw === "number" ? degreeRaw : 99 });
      }
      const minDegree = Math.min(...hits.map((h) => h.degree));
      for (const hit of hits.filter((h) => h.degree === minDegree)) {
        const key = `${hit.urn}→${consumer.urn}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({ upstream: hit.urn, downstream: consumer.urn });
        }
      }
    } catch {
      // consumer without lineage is fine
    }
  }

  return { source: "datahub", domain: `DataHub · ${query}`, datasets, consumers, edges };
}

export async function executeWriteback(calls: WritebackCall[]): Promise<Array<{ tool: string; ok: boolean; detail: string }>> {
  const results: Array<{ tool: string; ok: boolean; detail: string }> = [];
  for (const call of calls) {
    try {
      const out = await callTool(call.tool, call.args);
      results.push({ tool: call.tool, ok: true, detail: typeof out === "string" ? out : JSON.stringify(out ?? "ok") });
    } catch (err) {
      results.push({ tool: call.tool, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
