"use client";

import * as duckdb from "@duckdb/duckdb-wasm";

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const worker = new Worker("/duckdb/duckdb-browser-mvp.worker.js");
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      await db.instantiate("/duckdb/duckdb-mvp.wasm");
      return db;
    })();
  }
  return dbPromise;
}
