// Generates the synthetic demo estate: nine CSVs forming a lineage DAG
// raw_orders, raw_customers, raw_events  ->  stg_orders, stg_customers, stg_events
//   -> fct_revenue_daily, dim_customer_health  ->  (churn_model, exec_dashboard read them)
//
// Two quality incidents are seeded deliberately so the canvas has a story:
//   1. stg_customers.email — a 14% null spike (upstream consent scrubber bug)
//   2. stg_events.event_ts — type drift: ~9% of rows carry epoch-millis integers instead of ISO timestamps
// Everything is synthetic; the RNG is seeded so output is deterministic.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "estate");
await mkdir(outDir, { recursive: true });

let seed = 20260805;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pad = (n, w = 2) => String(n).padStart(w, "0");

const COUNTRIES = ["ES", "FR", "GR", "PT", "IT", "DE"];
const CHANNELS = ["web", "mobile", "partner", "store"];
const EVENT_TYPES = ["page_view", "add_to_cart", "checkout", "refund_request", "support_ticket"];
const SEGMENTS = ["smb", "mid_market", "enterprise", "consumer"];

const N_CUSTOMERS = 1200;
const N_ORDERS = 5000;
const N_EVENTS = 9000;

const iso = (day, spread = 0) => {
  const d = new Date(Date.UTC(2026, 6, 1 + day, Math.floor(rand() * 24), Math.floor(rand() * 60), Math.floor(rand() * 60)));
  return d.toISOString().replace(".000Z", "Z");
};

// --- raw_customers ---
const customers = Array.from({ length: N_CUSTOMERS }, (_, i) => {
  const id = `C${pad(i + 1, 5)}`;
  return {
    customer_id: id,
    signup_date: `2025-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
    country: pick(COUNTRIES),
    segment: pick(SEGMENTS),
    email: `user${i + 1}@example.com`,
    marketing_consent: rand() > 0.3 ? "true" : "false",
  };
});

// --- raw_orders ---
const orders = Array.from({ length: N_ORDERS }, (_, i) => {
  const day = Math.floor(rand() * 31);
  return {
    order_id: `O${pad(i + 1, 6)}`,
    customer_id: pick(customers).customer_id,
    order_ts: iso(day),
    channel: pick(CHANNELS),
    amount_eur: (5 + rand() * 495).toFixed(2),
    items: 1 + Math.floor(rand() * 6),
    status: rand() > 0.06 ? "completed" : "refunded",
  };
});

// --- raw_events ---
const events = Array.from({ length: N_EVENTS }, (_, i) => {
  const day = Math.floor(rand() * 31);
  return {
    event_id: `E${pad(i + 1, 7)}`,
    customer_id: pick(customers).customer_id,
    event_type: pick(EVENT_TYPES),
    event_ts: iso(day),
    session_minutes: (rand() * 42).toFixed(1),
    device: pick(["ios", "android", "desktop", "tablet"]),
  };
});

// --- staging: cleaned copies with the two seeded incidents ---
const stgCustomers = customers.map((c) => ({
  ...c,
  // incident 1: consent scrubber bug nulls out ~14% of emails
  email: rand() < 0.14 ? "" : c.email,
  is_active: rand() > 0.2 ? "true" : "false",
}));

const stgOrders = orders
  .filter((o) => o.status === "completed")
  .map((o) => ({ ...o, amount_eur_net: (Number(o.amount_eur) * 0.79).toFixed(2) }));

const stgEvents = events.map((e) => ({
  ...e,
  // incident 2: an upstream producer started emitting epoch millis for ~9% of rows
  event_ts: rand() < 0.09 ? String(Date.parse(e.event_ts)) : e.event_ts,
}));

// --- marts ---
const revenueByDay = new Map();
for (const o of stgOrders) {
  const day = o.order_ts.slice(0, 10);
  const key = `${day}|${o.channel}`;
  const row = revenueByDay.get(key) ?? { order_date: day, channel: o.channel, orders: 0, revenue_eur: 0, items: 0 };
  row.orders += 1;
  row.revenue_eur += Number(o.amount_eur_net);
  row.items += Number(o.items);
  revenueByDay.set(key, row);
}
const fctRevenue = [...revenueByDay.values()]
  .sort((a, b) => (a.order_date + a.channel).localeCompare(b.order_date + b.channel))
  .map((r) => ({ ...r, revenue_eur: r.revenue_eur.toFixed(2) }));

const orderCount = new Map();
for (const o of stgOrders) orderCount.set(o.customer_id, (orderCount.get(o.customer_id) ?? 0) + 1);
const ticketCount = new Map();
for (const e of stgEvents) if (e.event_type === "support_ticket") ticketCount.set(e.customer_id, (ticketCount.get(e.customer_id) ?? 0) + 1);

const dimCustomerHealth = stgCustomers.map((c) => {
  const ordersN = orderCount.get(c.customer_id) ?? 0;
  const tickets = ticketCount.get(c.customer_id) ?? 0;
  const score = Math.max(0, Math.min(100, 40 + ordersN * 9 - tickets * 12 + (c.is_active === "true" ? 10 : -15)));
  return {
    customer_id: c.customer_id,
    segment: c.segment,
    country: c.country,
    orders_30d: ordersN,
    support_tickets_30d: tickets,
    reachable_by_email: c.email === "" ? "false" : "true",
    health_score: score,
    churn_risk_band: score < 30 ? "high" : score < 60 ? "medium" : "low",
  };
});

const toCsv = (rows) => {
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => r[c]).join(","))].join("\n") + "\n";
};

const files = {
  "raw_orders.csv": orders,
  "raw_customers.csv": customers,
  "raw_events.csv": events,
  "stg_orders.csv": stgOrders,
  "stg_customers.csv": stgCustomers,
  "stg_events.csv": stgEvents,
  "fct_revenue_daily.csv": fctRevenue,
  "dim_customer_health.csv": dimCustomerHealth,
};
await Promise.all(Object.entries(files).map(([name, rows]) => writeFile(path.join(outDir, name), toCsv(rows))));
console.log(`Wrote ${Object.keys(files).length} synthetic estate CSVs to data/csv (${N_CUSTOMERS} customers, ${N_ORDERS} orders, ${N_EVENTS} events).`);
