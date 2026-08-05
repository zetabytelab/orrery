import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "node_modules", "@duckdb", "duckdb-wasm", "dist");
const targetRoot = path.join(projectRoot, "public", "duckdb");

await mkdir(targetRoot, { recursive: true });
await Promise.all(
  ["duckdb-mvp.wasm", "duckdb-browser-mvp.worker.js"].map((name) =>
    copyFile(path.join(sourceRoot, name), path.join(targetRoot, name)),
  ),
);

console.log("Copied the pinned DuckDB-Wasm MVP bundle into public/duckdb.");
