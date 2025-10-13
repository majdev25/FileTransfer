const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload loaded");
});
contextBridge.exposeInMainWorld("api", {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data), // request/response
  send: (channel, data) => ipcRenderer.send(channel, data), // fire-and-forget
  on: (channel, callback) =>
    ipcRenderer.on(channel, (event, data) => callback(data)), // event listener
});
