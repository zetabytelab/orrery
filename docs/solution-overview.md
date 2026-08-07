# Orrery — solution overview (solutions-architect view)

## The scenario

A commerce group runs a classic modern stack: raw feeds land in S3, dbt builds staging models, Snowflake holds the marts, and two things consume them — a **churn model** (MLflow, retrained weekly by an Airflow job) and an **executive revenue dashboard** (Looker, reviewed every Monday). DataHub catalogs all of it: schemas, owners, lineage, domain.

## The data estate

| Asset | Platform / layer | Rows | Grain / purpose | Owner |
|---|---|---|---|---|
| `raw_orders` | S3 · raw | 5,000 | One row per order from the commerce API | data-platform |
| `raw_customers` | S3 · raw | 1,200 | CRM customer master (PII: email, consent) | data-platform |
| `raw_events` | S3 · raw | 9,000 | Product telemetry from web/mobile clients | data-platform |
| `stg_orders` | dbt · staging | 4,670 | Completed orders only, net revenue after fees | growth-analytics |
| `stg_customers` | dbt · staging | 1,200 | Consent-scrubbed emails, activity flag | growth-analytics |
| `stg_events` | dbt · staging | 9,000 | Deduplicated events, timestamps normalized to UTC | growth-analytics |
| `fct_revenue_daily` | Snowflake · mart | 124 | Day × channel net revenue → feeds the exec dashboard (~€30k/day measured) | growth-analytics |
| `dim_customer_health` | Snowflake · mart | 1,200 | Health score + churn band per customer → the churn model's feature table (143 high-risk) | ml-platform |
| `churn_model` | MLflow · ML model | — | Weekly-retrained churn classifier; drives retention outreach | ml-platform |
| `exec_revenue_dashboard` | Looker · dashboard | — | C-suite revenue & retention review | growth-analytics |

## The two incidents (chosen because schema checks cannot see them)

1. **`stg_customers.email` — 13.3% silently blanked.** A consent-scrubber regression empties emails that should have survived. Every pipeline stays green — an empty string is a valid `string`. Downstream, `reachable_by_email` flips false in the feature table, churn outreach silently cannot reach the customers most likely to leave, and the dashboard's retention KPIs skew.
2. **`stg_events.event_ts` — 9.3% epoch-millis integers.** An upstream producer drifted from ISO-8601. DataHub still declares `timestamp`; the mixed formats break type inference (observed `VARCHAR`). Every time-based feature and daily aggregate downstream quietly degrades. A contract violation between the catalog and reality — visible only if someone compares the two, which nothing in a standard stack does.

## Architecture: read → measure → correlate → quantify → remediate → record

The DataHub MCP server supplies context (entities, declared schemas, ownership, lineage — including the dataset → Airflow job → ML model path). DuckDB-Wasm profiles every dataset in the browser — no warehouse connection, no profiling infrastructure. Orrery diffs observed reality against the declared contract, propagates violations along real lineage to the decision layer, prices the exposure from the data itself (revenue/day through the affected dashboard, at-risk population under the model, repair-hours heuristic with printed assumptions), ranks replacement candidates from Mundaneum's 40k-dataset cross-catalog directory, and writes everything back through the same MCP server — profile note and € context on the asset, severity tag on the exact column, rescue proposal as a DataHub Document.

## Key value, per stakeholder

- **Data engineer** — blast radius in one glance instead of SQL archaeology; a repair estimate to size the ticket.
- **BI / analytics owner** — trust signals in the schema table, exactly where analysts look before querying.
- **ML platform** — feature-contract violations surfaced before the weekly retrain consumes them, via real ML lineage.
- **CDO / FinOps** — incidents arrive priced (€30k/day steered, ~€935 to fix, caught before the 1-10-100 rule's 100× zone); prioritization becomes arithmetic.
- **Governance** — every finding evidence-bound and recorded in the catalog, so knowledge compounds instead of evaporating in chat threads.

**Thesis:** lineage tells you where data came from, metadata tells you who owns it — Orrery checks whether the data is telling the truth, prices the consequences, and files the rescue where the whole organization inherits it.
