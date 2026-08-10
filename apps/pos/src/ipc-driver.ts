import type { Row, SqlDriver, SqlValue } from "@yf/data";

// The on-disk SQLite (better-sqlite3) lives in Electron's main process; this
// SqlDriver forwards each statement over IPC (see electron/preload.ts +
// electron/main.ts). No persistence hook is needed — the .sqlite file *is* the
// storage. Drizzle/repo code above this is identical to the browser build.

export interface SqliteBridge {
  all(sql: string, params?: SqlValue[]): Promise<Row[]>;
  values(sql: string, params?: SqlValue[]): Promise<SqlValue[][]>;
  run(sql: string, params?: SqlValue[]): Promise<{ lastInsertRowid: number }>;
  meta(): Promise<{ fresh: boolean }>;
  reset(): Promise<boolean>;
}

/** On-disk product image library (Electron only). */
export interface ImagesBridge {
  list(): Promise<{ name: string; dataUrl: string }[]>;
  /** Open a file dialog to copy images in; returns the full updated list. */
  import(): Promise<{ name: string; dataUrl: string }[]>;
}

/** Silent printing via the Electron main process. */
export interface PrintingBridge {
  printHtml(html: string): Promise<{ ok: boolean; error?: string }>;
}

/** Outbox mailer in the Electron main process (nodemailer over Gmail SMTP). */
export interface MailerBridge {
  /** Try to send every unsent outbox row now; returns what happened. */
  process(): Promise<{ sent: number; pending: number; lastError: string | null }>;
}

declare global {
  interface Window {
    sqlite?: SqliteBridge;
    images?: ImagesBridge;
    printing?: PrintingBridge;
    mailer?: MailerBridge;
  }
}

export function createIpcDriver(bridge: SqliteBridge): SqlDriver {
  let depth = 0; // reentrant tx: BEGIN only at the outermost level

  const run = (sql: string, params: SqlValue[] = []) => bridge.run(sql, params);

  const tx = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (depth > 0) return fn();
    depth++;
    await run("BEGIN");
    try {
      const result = await fn();
      await run("COMMIT");
      return result;
    } catch (e) {
      await run("ROLLBACK");
      throw e;
    } finally {
      depth--;
    }
  };

  return {
    all: (sql, params = []) => bridge.all(sql, params),
    values: (sql, params = []) => bridge.values(sql, params),
    run,
    tx,
  };
}
