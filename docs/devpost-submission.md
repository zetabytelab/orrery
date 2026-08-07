# Devpost submission materials

## Project name

**Orrery — the DataHub estate observatory**

## Devpost project title

**Orrery — see the blast radius before it hits**

## Elevator pitch (one-liner)

Every node of your DataHub lineage graph becomes a live data profile; broken columns light up the models and dashboards they'll poison, and the rescue is filed right back into DataHub.

## The name (open the description with this)

> An **orrery** is a clockwork model of the solar system — small enough to sit on a desk, true enough to predict an eclipse. This one is a clockwork model of your data estate — true enough to predict which dashboards go dark.

Thumbnail: use `docs/logo.png` (the orrery glyph: the catalog at the center, one planet burning red, its blast radius already arcing to the next asset).

## Challenge category

Open / Wildcard (with strong overlap into Production ML Agents — the demo's climax is a broken column reaching a production churn model through real lineage).

## Text description (paste into Devpost)

**The problem.** Data catalogs know what *should* be true about your data — schemas, lineage, ownership. Profilers know what *is* true — nulls, types, distributions. These two worlds almost never meet. A column silently drifting from ISO timestamps to epoch integers breaks nothing visibly today; three hops of lineage later it degrades a churn model and an executive dashboard, and nobody knows which team to call.

**What Orrery does.** Orrery renders your DataHub lineage graph on an infinite canvas where every node is *alive*:

- **Zoomed out** — your estate is a constellation, each star colored by observed data health.
- **Zoomed in** — every dataset is a full Trifacta-style profiling card: type inference, null bars, histograms, top-k value frequencies, distinct counts — computed live in your browser by DuckDB-Wasm. No warehouse connection, no profiling job to schedule.
- **The delta is the product** — Orrery checks the *observed* data against the schema DataHub *declares*. A column declared `timestamp` whose values are 9% epoch-millis integers becomes a critical contract violation.
- **Click the broken column** — the incident propagates as animated beams along real DataHub lineage edges, dimming everything unaffected, straight to the ML model and executive dashboard it reaches. The impact panel lists the blast radius, the owners of every affected asset, and the teams to notify.
- **Write it back** — one click sends the findings through the official DataHub MCP server: a run-marked profile note with the exposure figures (`update_description`), severity tags down to the **exact schema field** (`add_tags` with `column_paths`), and a per-column observed-profile note — so the finding lives in the catalog, on the asset *and* on the column, where the next person or agent inherits it.
- **And launch a lifeboat** — for seriously damaged datasets, Orrery ranks replacement/backfill candidates from a 40k+ dataset cross-catalog directory spanning the Databricks and Snowflake marketplaces, Kaggle, Hugging Face, Datarade, data.gov and more — license, pricing, and quality included (powered by Mundaneum, an external open-source data-aggregator project by the same author — it indexes datasets across public and commercial catalogs with license, pricing, and quality metadata; in development, and the demo bundles a snapshot of real results so nothing extra is needed to test) — and files them into DataHub as a `save_document` rescue proposal attached to the broken asset. The incident lifecycle completes: detect → blast radius → notify → replace — all recorded in the catalog.

**Every finding is evidence-bound.** No unexplained AI score anywhere: each issue is a named column, a measured percentage, and a declared-vs-observed contract check you can verify against DataHub and against the data itself. In the demo estate, two staging-layer incidents silently reach **100% of the decision layer** — one production churn model and one executive dashboard — and Orrery shows the exact path. Lineage tells you where data came from; metadata tells you who owns it; **Orrery checks whether the data is telling the truth — and files the rescue.**

**Incidents get a price tag.** Orrery estimates business exposure from the data itself: the affected dashboard steers ~€30k/day of net revenue (measured live in DuckDB from the estate's own numbers), the affected model acts on 143 high-churn-risk customers, and a repair estimate (~8.5h ≈ €935) prints its assumptions beside it — framed by the 1-10-100 data-quality cost rule, because Orrery catches incidents at the staging layer, before the 100× zone. The same figures are written into the DataHub profile note, so the catalog carries the cost context too.

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
| 0:00–0:15 | Constellation view (click **Constellation**). Slow pan. | "An orrery is a clockwork model of the solar system — true enough to predict an eclipse. This is an orrery of a data estate: every star is a dataset in DataHub, its color is the *observed* health of the actual data — and two of them are burning." |
| 0:15–0:40 | Click **Fit estate**; fresh page reload so cards profile one by one. | "Orrery reads the lineage graph, schemas, and ownership from DataHub through its MCP server — and then profiles every dataset live, in the browser, with DuckDB-Wasm. Types, nulls, histograms, value frequencies. No warehouse connection, no profiling jobs." |
| 0:40–1:10 | Zoom into `stg_events.event_ts` (red). Hover the row so the tooltip with the message shows. | "Here's why that matters. DataHub declares this column a *timestamp*. The data says 9% of its values are epoch integers — an upstream producer drifted. The catalog's contract and the data's reality disagree, and Orrery is the first place they meet." |
| 1:10–1:50 | Click `stg_customers.email` (the 13% null spike). Propagation beams animate; impact panel opens. Point at blast radius, teams, then the **Estimated business exposure** card. | "Now the aha. This email column lost 13% of its values to a consent-scrubber bug. Click it — and the incident travels along *real* DataHub lineage: through the customer-health feature table, into the production churn model and the executive dashboard. And Orrery prices it: the dashboard downstream steers thirty thousand euros a day of revenue reporting — measured from the data, not invented — and the model acts on a hundred and forty-three at-risk customers. Caught at staging, before the hundred-x zone." |
| 1:50–2:10 | Scroll the panel to **Rescue candidates — Mundaneum cross-catalog**. Hover the Kaggle/Snowflake chips. | "And because detection without a remedy is just bad news: Orrery ranks replacement candidates from Mundaneum, a 40-thousand-dataset directory spanning the Databricks and Snowflake marketplaces, Kaggle, Hugging Face, and commercial vendors — licenses, pricing, and quality included. A lifeboat for the broken dependency." |
| 2:10–2:30 | Expand the `save_document` call preview; click **Write profile to DataHub**. Cut to the DataHub UI: the stg_events schema table with the `orrery-critical` tag **on the event_ts column itself**, then the rescue-proposal Document, then DataHub's lineage explorer showing the chain through to the ML model. | "One click writes it all back through the official DataHub MCP server — a run-marked profile note, severity tags down to the exact column, and the rescue proposal filed as a DataHub document. Open DataHub and it's all just... there — in the schema table, on the lineage graph, next to the model. The next engineer, or the next agent, inherits everything Orrery observed." |
| 2:30–2:50 | Constellation view again; slow zoom out. | "In this estate, two staging incidents silently reached one hundred percent of the decision layer — a production model and an executive dashboard. Lineage tells you where data came from. Metadata tells you who owns it. Orrery checks whether the data is telling the truth — and files the rescue. Built on DataHub, for the Agent Hackathon." |

## Feedback survey answers (opt in on the Devpost form — real friction hit while building)

1. **MCP server transport**: `mcp-server-datahub` is stdio-only. Embedding it in a web backend means spawning `uvx` as a child process per server — a Streamable HTTP transport option (or a documented way to run it as a sidecar service) would make DataHub-MCP usable from any web app or non-Python agent runtime directly.
2. **Programmatic response shapes**: the MCP tools' JSON output shapes (`search` results, `get_lineage` relationships, `list_schema_fields`) are undocumented for programmatic consumers — building a typed client required defensive parsing against several possible shapes. A JSON-schema of each tool's result (not just its input) in the docs would remove the guesswork.
3. **Quickstart port remapping is hard to discover**: `datahub docker quickstart` fails on machines where 8080/3306 are taken (very common on dev laptops — Airflow's default is 8080). The `DATAHUB_MAPPED_*_PORT` env vars solve it but are buried; the CLI should detect the conflict and suggest them (or take a `--port-offset` flag). Also, when a first quickstart attempt fails it exits with a generic "datahub is not running" — surfacing *which* container/port failed would save a lot of debugging.
4. **Image pull weight**: the quickstart pulls ~18 GB of images before anything starts, with no progress indication by default and no "slim" profile. A minimal profile (GMS + frontend + one search backend, no actions/kafka for evaluation scenarios) would drop time-to-first-catalog dramatically for hackathons and evaluations.
5. **`add_tags` rejects unknown tags silently from an agent's perspective**: mutation tools assume tags/terms already exist; a `create_if_missing` option (or a `create_tag` tool) would let write-back agents be self-contained.
6. **Quickstart ignores Docker CLI contexts**: `datahub docker quickstart` talks to whatever owns `/var/run/docker.sock`. On a Mac with both Docker Desktop and OrbStack, it silently deployed to the *other* engine than the one `docker context show` reported — an hour of "where did my 18 GB of images go?" A one-line "deploying to engine X (socket Y)" at startup would eliminate the whole failure class.

## Judge test path (put in "How to test")

1. `git clone https://github.com/zetabytelab/orrery && cd orrery && npm install && npm run dev` → http://localhost:3000 — works with zero configuration (bundled demo estate, write-back shown as dry-run).
2. Watch the 8 datasets profile in-browser; click the flagged `email` column on `stg_customers`, then the flagged `event_ts` on `stg_events`.
3. Optional full live loop: `uvx --from acryl-datahub datahub docker quickstart`, then `cd ingest && DATAHUB_GMS_URL=http://localhost:8080 uv run --with acryl-datahub python ingest_estate.py`, then restart Orrery with `DATAHUB_GMS_URL=http://localhost:8080`. The banner flips to LIVE · DATAHUB MCP and write-back mutates the catalog for real.
