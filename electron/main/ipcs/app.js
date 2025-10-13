const { clipboard, dialog, shell } = require("electron");

/**
 * App Utilities IPC Module
 */

function register(ipcMain, deps) {
  const { mainWindow, settings, enterApp } = deps;

  // Copies a given value to the system clipboard
  ipcMain.handle("app-copy-to-clipboard", async (event, { value }) => {
    clipboard.writeText(value);
  });

  // Opens a dialog to select a directory and returns its path
  ipcMain.handle("app-select-path", async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Show file in folder
  ipcMain.handle("app-show-file", async (event, { filePath }) => {
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch (err) {
      console.error("[app-show-file] Failed to show file:", err);
      return false;
    }
  });

  // Opens a dialog to select a single file and returns its path
  ipcMain.handle("app-select-file", async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"], // allow selecting a single file
      // optional: filter file types
      filters: [
        { name: "All Files", extensions: ["*"] },
        // { name: "Text Files", extensions: ["txt"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null; // user canceled
    }

    return result.filePaths[0]; // return the selected file path
  });

  // Returns all stored application settings
  ipcMain.handle("app-get-settings", async (event, {}) => {
    return settings.getAllSettings();
  });

  // Updates application settings and notifies renderer
  ipcMain.handle("app-save-settings", async (event, { newSettings }) => {
    console.log(newSettings);
    settings.setDownloadPath(newSettings.downloadPath);
    settings.setName(newSettings.name || "Anonymous");

    mainWindow.webContents.send("app-settings-updated", {});
  });
}

module.exports = { register };
