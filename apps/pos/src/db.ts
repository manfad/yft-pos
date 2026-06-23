// Pin the classic UMD build: sql.js 1.14's "browser" export
// (sql-wasm-browser.js) has a different API and no ESM default export.
import initSqlJs from "sql.js/dist/sql-wasm.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { get, set } from "idb-keyval";
import { createSqlJsDriver, initRepo, type SqlPosRepo } from "@yf/data";

// Browser data layer: sql.js (SQLite-in-wasm) persisted to IndexedDB. When the
// app is wrapped for desktop, swap this module's driver for tauri-plugin-sql /
// node:sqlite — nothing above it (repo, stores, UI) changes.

const DB_KEY = "yf-pos-db";

let repoPromise: Promise<SqlPosRepo> | null = null;

export function getRepo(): Promise<SqlPosRepo> {
  repoPromise ??= boot();
  return repoPromise;
}

async function boot(): Promise<SqlPosRepo> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await get<Uint8Array>(DB_KEY);
  const db = saved ? new SQL.Database(saved) : new SQL.Database();

  // Debounced persistence — export the whole DB after writes settle.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void set(DB_KEY, db.export()), 200);
  };

  const driver = createSqlJsDriver(db as never, { afterWrite: persist });
  // Seed demo orders only on a fresh DB so the Sales report isn't empty.
  return initRepo(driver, { seedDemoOrders: !saved });
}

/** Wipe the local DB (used by the admin "reset demo data" action). */
export async function resetDb(): Promise<void> {
  await set(DB_KEY, undefined as unknown as Uint8Array);
  repoPromise = null;
}
