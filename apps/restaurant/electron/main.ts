import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import Database from "better-sqlite3";

let mainWindow: BrowserWindow | null = null;
let database: Database.Database;

ipcMain.handle("store:load", () => {
  const row = database.prepare("SELECT value FROM app_state WHERE id = 1").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
});
ipcMain.handle("store:save", (_event, data: unknown) => {
  database.prepare("INSERT INTO app_state (id, value, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(JSON.stringify(data));
  return true;
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    kiosk: app.isPackaged,
    autoHideMenuBar: true,
    backgroundColor: "#f1e9db",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setMenu(null);
  mainWindow.on("closed", () => { mainWindow = null; });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
app.whenReady().then(() => {
  database = new Database(path.join(app.getPath("userData"), "datuk-yap-restaurant.sqlite"));
  database.pragma("journal_mode = WAL");
  database.prepare("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
