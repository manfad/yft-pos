import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

// On-disk SQLite lives in the main process (native module stays out of the
// sandboxed renderer). The renderer talks to it over IPC via the bridge in
// preload.ts and the SqlDriver in src/ipc-driver.ts — so all the Drizzle query
// code is reused unchanged; only the driver differs from the browser build.

let db: Database.Database;
let dbPath = "";
let fresh = false;

function openDb(): Database.Database {
  const d = new Database(dbPath);
  d.pragma("journal_mode = WAL"); // durable + low-memory on modest hardware
  d.pragma("foreign_keys = ON");
  return d;
}

// better-sqlite3 forbids transaction-control statements in prepare(); run them
// through exec() instead. The renderer drives BEGIN/COMMIT via SqlDriver.tx().
const TX_RE = /^\s*(?:begin|commit|rollback|savepoint|release)\b/i;

ipcMain.handle("db:all", (_e, sql: string, params: unknown[] = []) =>
  db.prepare(sql).all(...params),
);
ipcMain.handle("db:values", (_e, sql: string, params: unknown[] = []) =>
  db.prepare(sql).raw().all(...params),
);
ipcMain.handle("db:run", (_e, sql: string, params: unknown[] = []) => {
  if (TX_RE.test(sql)) {
    db.exec(sql);
    return { lastInsertRowid: 0 };
  }
  const info = db.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid) };
});
ipcMain.handle("db:meta", () => ({ fresh }));
ipcMain.handle("db:reset", () => {
  db.close();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* file may not exist */
    }
  }
  db = openDb();
  fresh = true;
  return true;
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#f3ece0",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  dbPath = path.join(app.getPath("userData"), "yft-pos.sqlite");
  fresh = !fs.existsSync(dbPath);
  db = openDb();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
