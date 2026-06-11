const { app, BrowserWindow, ipcMain, Notification, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const http = require("http");
const https = require("https");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d0f12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();
  // check for updates a few seconds after launch (silent if none)
  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch (_) {} }, 4000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------- Companion HTTP/HTTPS (from main process → no CORS) ----------
function companionGet({ ip, port, https: useHttps, path: reqPath }) {
  return new Promise((resolve) => {
    const mod = useHttps ? https : http;
    const options = {
      host: ip,
      port: port || (useHttps ? 443 : 80),
      path: reqPath,
      rejectUnauthorized: false, // accept self-signed / internal certificates
    };
    const req = mod.get(options, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
    });
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(2500, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
  });
}

ipcMain.handle("companion:press", async (_e, a) =>
  companionGet({ ...a, path: `/press/bank/${a.page}/${a.bank}` }));

ipcMain.handle("companion:ping", async (_e, a) =>
  companionGet({ ...a, path: "/" }));

// ---------- Auto-update ----------
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendStatus(data) {
  if (win && !win.isDestroyed()) win.webContents.send("update:status", data);
}

autoUpdater.on("checking-for-update", () => sendStatus({ state: "checking" }));
autoUpdater.on("update-available", (i) => sendStatus({ state: "available", version: i.version }));
autoUpdater.on("update-not-available", () => sendStatus({ state: "none" }));
autoUpdater.on("error", (err) => sendStatus({ state: "error", message: String(err && err.message || err) }));
autoUpdater.on("download-progress", (p) => sendStatus({ state: "downloading", percent: Math.round(p.percent) }));
autoUpdater.on("update-downloaded", (i) => {
  sendStatus({ state: "downloaded", version: i.version });
  if (Notification.isSupported()) {
    new Notification({
      title: "WetterPilot – Update bereit",
      body: `Version ${i.version} wurde geladen. In WetterPilot auf „Neu starten & aktualisieren“ klicken.`,
    }).show();
  }
});

ipcMain.handle("update:check", () => { try { autoUpdater.checkForUpdates(); } catch (e) { sendStatus({ state: "error", message: String(e) }); } });
ipcMain.handle("update:install", () => { autoUpdater.quitAndInstall(); });
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:openExternal", (_e, url) => { try { return shell.openExternal(url); } catch (e) { return false; } });
