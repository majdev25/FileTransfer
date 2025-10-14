const { clipboard, dialog, shell, app } = require("electron");
const fs = require("fs");
const path = require("path");

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
      if (fs.existsSync(filePath)) {
        const result = shell.showItemInFolder(filePath);
        if (!result) {
          // fallback: open folder itself
          await shell.openPath(path.dirname(filePath));
        }
        return true;
      } else {
        console.error("File does not exist:", filePath);
        return false;
      }
    } catch (err) {
      console.error("[app-show-file] Failed:", err);
      await shell.openPath(path.dirname(filePath)); // fallback
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

  ipcMain.handle("app-get-version", async (event, {}) => {
    try {
      const packagePath = path.join(app.getAppPath(), "../package.json");
      const data = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      return data.version || app.getVersion();
    } catch (err) {
      console.error("Failed to read version:", err);
      return app.getVersion();
    }
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
