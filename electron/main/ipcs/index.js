// main/ipcs/index.js
// Initializes all IPC modules for the Electron app

const addFriendIPC = require("./addFriend");
const fileTransferIPC = require("./fileTransfer");
const appIPC = require("./app");

/**
 * Initialize all IPC modules
 * @param {Electron.IpcMain} ipcMain - The ipcMain instance from Electron
 * @param {Object} deps - Dependencies to pass to IPC modules
 */
function initIPC(ipcMain, deps) {
  if (!ipcMain) throw new Error("ipcMain not passed to initIPC");
  if (!deps) throw new Error("Dependencies not passed to initIPC");

  // Register individual IPC modules
  addFriendIPC.register(ipcMain, deps);
  appIPC.register(ipcMain, deps);
  fileTransferIPC.register(ipcMain, deps);
}

module.exports = { initIPC };
