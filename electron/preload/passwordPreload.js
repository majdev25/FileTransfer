const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("passwordAPI", {
  submitPassword: (password) =>
    ipcRenderer.send("password-submitted", password),
});
