// Dev utility: dump the DataHub MCP server's tool list + schemas, and try a lineage call.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "uvx",
  args: ["mcp-server-datahub@latest"],
  env: { ...process.env, DATAHUB_GMS_URL: process.env.DATAHUB_GMS_URL ?? "http://localhost:8080" },
});
const client = new Client({ name: "orrery-probe", version: "0.0.1" });
await client.connect(transport);

const { tools } = await client.listTools();
for (const t of tools) {
  console.log(`\n=== ${t.name} ===`);
  console.log(JSON.stringify(t.inputSchema?.properties ?? {}, null, 1).slice(0, 900));
}

const urn = "urn:li:dataset:(urn:li:dataPlatform:dbt,orrery.stg_customers,PROD)";
for (const args of [
  { urn, direction: "downstream" },
  { urn, upstream: false },
]) {
  try {
    const res = await client.callTool({ name: "get_lineage", arguments: args });
    const text = res.content?.filter((c) => c.type === "text").map((c) => c.text).join("");
    console.log(`\n--- get_lineage ${JSON.stringify(args)} -> ${res.isError ? "ERROR" : "OK"}\n${(text ?? "").slice(0, 1200)}`);
    if (!res.isError) break;
  } catch (err) {
    console.log(`\n--- get_lineage ${JSON.stringify(args)} threw: ${err.message}`);
  }
}
process.exit(0);
