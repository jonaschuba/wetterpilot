const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wp", {
  // Companion
  press: (args) => ipcRenderer.invoke("companion:press", args),
  ping: (args) => ipcRenderer.invoke("companion:ping", args),
  // Updates
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdate: (cb) => ipcRenderer.on("update:status", (_e, d) => cb(d)),
  version: () => ipcRenderer.invoke("app:version"),
  // im Standardbrowser öffnen
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
});
