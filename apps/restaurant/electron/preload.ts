import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("restaurantStore", {
  load: () => ipcRenderer.invoke("store:load"),
  save: (data: unknown) => ipcRenderer.invoke("store:save", data)
});
