import { app, BrowserWindow, dialog, ipcMain } from "electron";
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
let mainWindow: BrowserWindow | null = null;

// User-added product photos live here (copied in from e.g. a USB drive). Served
// to the renderer as data URLs so they need no custom protocol.
let imagesDir = "";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function listImages(): { name: string; dataUrl: string }[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch {
    return [];
  }
  return files
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .map((name) => {
      const ext = path.extname(name).toLowerCase().slice(1);
      const mime = ext === "jpg" ? "jpeg" : ext;
      const b64 = fs.readFileSync(path.join(imagesDir, name)).toString("base64");
      return { name, dataUrl: `data:image/${mime};base64,${b64}` };
    });
}

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

ipcMain.handle("images:list", () => listImages());
ipcMain.handle("images:import", async () => {
  const res = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: "Add product images",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (!res.canceled) {
    for (const src of res.filePaths) {
      const ext = path.extname(src);
      const stem = path.basename(src, ext);
      let name = `${stem}${ext}`;
      let i = 1;
      while (fs.existsSync(path.join(imagesDir, name))) name = `${stem}-${i++}${ext}`;
      fs.copyFileSync(src, path.join(imagesDir, name));
    }
  }
  return listImages();
});
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
  const win = (mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#f3ece0",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }));
  win.on("closed", () => {
    mainWindow = null;
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  dbPath = path.join(app.getPath("userData"), "yft-pos.sqlite");
  fresh = !fs.existsSync(dbPath);
  db = openDb();
  imagesDir = path.join(app.getPath("userData"), "images");
  fs.mkdirSync(imagesDir, { recursive: true });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
