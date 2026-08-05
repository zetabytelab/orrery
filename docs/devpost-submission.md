# Devpost submission materials

## Project name

**Orrery — the DataHub estate observatory**

## Elevator pitch (one-liner)

An infinite canvas where every node of your DataHub lineage graph is a live data-profiling card — quality incidents propagate visually downstream to the models and dashboards they poison, and findings are written back to DataHub through the official MCP server.

## Challenge category

Open / Wildcard (with strong overlap into Production ML Agents — the demo's climax is a broken column reaching a production churn model through real lineage).

## Text description (paste into Devpost)

**The problem.** Data catalogs know what *should* be true about your data — schemas, lineage, ownership. Profilers know what *is* true — nulls, types, distributions. These two worlds almost never meet. A column silently drifting from ISO timestamps to epoch integers breaks nothing visibly today; three hops of lineage later it degrades a churn model and an executive dashboard, and nobody knows which team to call.

**What Orrery does.** Orrery renders your DataHub lineage graph on an infinite canvas where every node is *alive*:

- **Zoomed out** — your estate is a constellation, each star colored by observed data health.
- **Zoomed in** — every dataset is a full Trifacta-style profiling card: type inference, null bars, histograms, top-k value frequencies, distinct counts — computed live in your browser by DuckDB-Wasm. No warehouse connection, no profiling job to schedule.
- **The delta is the product** — Orrery checks the *observed* data against the schema DataHub *declares*. A column declared `timestamp` whose values are 9% epoch-millis integers becomes a critical contract violation.
- **Click the broken column** — the incident propagates as animated beams along real DataHub lineage edges, dimming everything unaffected, straight to the ML model and executive dashboard it reaches. The impact panel lists the blast radius, the owners of every affected asset, and the teams to notify.
- **Write it back** — one click sends `update_description` (a run-marked profile note) and `add_tags` (a severity tag) through the official DataHub MCP server, so the finding lives in the catalog where the next person — or the next agent — inherits it.

**How DataHub is used.** DataHub is not a data source here; it is the *spine*. The estate graph (entities, schemas, ownership, lineage) is read through the DataHub MCP server (`search`, `list_schema_fields`, `get_lineage`); declared schemas power the contract checks; lineage powers the propagation; ownership powers the notify list; and the loop closes with MCP mutations back into the catalog. A bundled fixture estate makes the demo run with zero configuration; an included ingestion script loads the same estate into any DataHub instance for the full live loop.

**Tech.** Next.js + React Flow (infinite canvas, semantic zoom), DuckDB-Wasm (in-browser SQL profiling), the official DataHub MCP server via the MCP TypeScript SDK (stdio), acryl-datahub Python SDK (demo ingestion). All data is synthetic and deterministic.

**Why it matters.** Every data platform team plays "who is affected by this bad column" during incidents — usually with SQL archaeology and Slack. Orrery answers it in one glance, and leaves the answer in DataHub.

## Built with (Devpost tags)

datahub · mcp · duckdb-wasm · next.js · react-flow · typescript · python · dagre

## URLs

- Repository (public, Apache 2.0): https://github.com/zetabytelab/orrery
- Try it: clone → `npm install && npm run dev` → http://localhost:3000 (zero config)

## 3-minute video script

Target: ≤ 2:45. Record at 1080p+ with the app at http://localhost:3789 (or 3000), fresh reload so profiling animates on camera. Practice the click path once before recording.

| Time | Shot | Voiceover |
|---|---|---|
| 0:00–0:15 | Constellation view (click **Constellation**). Slow pan. | "This is a data estate the way an operator should see it: every star is a dataset in DataHub, and its color is the *observed* health of the actual data. Two of them are burning. This is Orrery." |
| 0:15–0:40 | Click **Fit estate**; fresh page reload so cards profile one by one. | "Orrery reads the lineage graph, schemas, and ownership from DataHub through its MCP server — and then profiles every dataset live, in the browser, with DuckDB-Wasm. Types, nulls, histograms, value frequencies. No warehouse connection, no profiling jobs." |
| 0:40–1:10 | Zoom into `stg_events.event_ts` (red). Hover the row so the tooltip with the message shows. | "Here's why that matters. DataHub declares this column a *timestamp*. The data says 9% of its values are epoch integers — an upstream producer drifted. The catalog's contract and the data's reality disagree, and Orrery is the first place they meet." |
| 1:10–1:50 | Click `stg_customers.email` (the 13% null spike). Propagation beams animate; impact panel opens. Point at blast radius + teams. | "Now the aha. This email column lost 13% of its values to a consent-scrubber bug. Click it — and the incident travels along *real* DataHub lineage: through the customer-health feature table, into the production churn model and the executive dashboard. Blast radius, affected owners, teams to notify — computed from the catalog, not from tribal knowledge." |
| 1:50–2:20 | Expand the `update_description` call preview; click **Write profile to DataHub** (live mode if you have quickstart running, else the dry-run). If live: cut to the DataHub UI showing the description + orrery-serious tag on stg_customers. | "And the loop closes. One click writes the finding back into DataHub through the official MCP server — a run-marked profile note and a severity tag on the asset. The next engineer, or the next agent, opens the catalog and inherits everything Orrery observed." |
| 2:20–2:40 | Constellation view again; slow zoom out. | "Catalogs know what should be true. Profilers know what is. Orrery puts them on one canvas — and writes the difference back where it belongs. Orrery, built on DataHub, for the Agent Hackathon." |

## Judge test path (put in "How to test")

1. `git clone https://github.com/zetabytelab/orrery && cd orrery && npm install && npm run dev` → http://localhost:3000 — works with zero configuration (bundled demo estate, write-back shown as dry-run).
2. Watch the 8 datasets profile in-browser; click the flagged `email` column on `stg_customers`, then the flagged `event_ts` on `stg_events`.
3. Optional full live loop: `uvx --from acryl-datahub datahub docker quickstart`, then `cd ingest && DATAHUB_GMS_URL=http://localhost:8080 uv run --with acryl-datahub python ingest_estate.py`, then restart Orrery with `DATAHUB_GMS_URL=http://localhost:8080`. The banner flips to LIVE · DATAHUB MCP and write-back mutates the catalog for real.
