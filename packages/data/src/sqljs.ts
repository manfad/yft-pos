import type { Row, SqlDriver, SqlValue } from "./driver.js";

// Minimal structural view of a sql.js Database — avoids a hard dep on sql.js
// here (the app owns wasm loading and passes the Database in).
export interface SqlJsStatement {
  bind(params?: SqlValue[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, SqlValue>;
  free(): void;
}
export interface SqlJsDatabase {
  run(sql: string, params?: SqlValue[]): unknown;
  prepare(sql: string): SqlJsStatement;
  exec(sql: string): Array<{ columns: string[]; values: SqlValue[][] }>;
  export(): Uint8Array;
}

export interface SqlJsDriverOptions {
  /** Called after every committed write — wire this to IndexedDB persistence. */
  afterWrite?: () => void;
}

/** Wrap a sql.js Database (synchronous) as the async SqlDriver. */
export function createSqlJsDriver(
  db: SqlJsDatabase,
  opts: SqlJsDriverOptions = {},
): SqlDriver {
  let depth = 0; // reentrant tx: BEGIN only at the outermost level

  const all = async (sql: string, params: SqlValue[] = []): Promise<Row[]> => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  };

  const run = async (sql: string, params: SqlValue[] = []) => {
    db.run(sql, params);
    const res = db.exec("SELECT last_insert_rowid() AS id");
    const lastInsertRowid = Number(res[0]?.values[0]?.[0] ?? 0);
    if (depth === 0) opts.afterWrite?.();
    return { lastInsertRowid };
  };

  const tx = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (depth > 0) return fn(); // already inside a transaction
    depth++;
    db.run("BEGIN");
    try {
      const result = await fn();
      db.run("COMMIT");
      opts.afterWrite?.();
      return result;
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    } finally {
      depth--;
    }
  };

  return { all, run, tx };
}
