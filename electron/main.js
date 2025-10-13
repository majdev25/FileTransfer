// ============================================================
// main.js — Main entry point for the Electron application
// ============================================================

const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");

// --- Core Modules ---
const { initIPC } = require("./main/ipcs/index.js");
const { ensureKeys } = require("./main/keyManager.js");
const FriendsManager = require("./main/friendsManager.js");
const TcpServer = require("./main/tcpServer.js");
const UdpServer = require("./main/udpServer.js");
const { initKEKKeyExchange } = require("./main/handshakes/KEK-KEY-EXCHANGE.js");
const Settings = require("./main/settingsManager.js");

// ============================================================
// Global Variables & Configuration
// ============================================================

let mainWindow;
let keys;
let friends;
let settings;
let udpServer;
let tcpServer;

// Ports (configurable via environment variables)
const UDP_PORT = process.env.UDP_PORT || 41234;
const UDP_PORT_2 = process.env.UDP_PORT2 || 41234;
const TCP_PORT = parseInt(process.env.TCP_PORT, 10) || 41235;

// App data dir
const USER_DATA_DIR = path.join(
  app.getPath("userData"),
  "FileTransferData" + process.env.INSTANCE
);

// ============================================================
// Window Creation
// ============================================================

/**
 * Creates the main Electron application window.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "./preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../vue/dist/index.html"));
  }
}

/**
 * Handles password submission from renderer.
 * Validates or generates key pair and starts the app.
 */
ipcMain.handle("app-enter-password", async (event, { password }) => {
  console.log("[IPC] Received password attempt.");
  const keysObj = ensureKeys(password, USER_DATA_DIR);

  if (!keysObj) {
    console.warn("[IPC] Invalid passphrase or key decryption failed.");
    return false;
  }

  keys = keysObj;
  enterApp();
  return true;
});

/**
 * IPC handler to delete all user data.
 */
ipcMain.handle("app-delete-user-data", async () => {
  try {
    console.log("[IPC] Deleting all user data...");

    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      console.log("[IPC] User data deleted successfully.");
    }

    return { success: true };
  } catch (err) {
    console.error("[IPC] Failed to delete user data:", err);
    return { success: false, error: err.message };
  }
});

/**
 * Initializes the app logic after successful password entry.
 */
function enterApp() {
  console.log("[App] Entering main application...");

  // Initialize core managers
  friends = new FriendsManager(keys.passphrase, USER_DATA_DIR);
  settings = new Settings(keys.passphrase, USER_DATA_DIR);

  // Start servers
  udpServer = new UdpServer(UDP_PORT);
  udpServer.start();

  tcpServer = new TcpServer(TCP_PORT, keys.privateKey, keys, keys.passphrase);
  tcpServer.start(friends);

  // Setup IPC dependencies
  const dependencies = {
    keys,
    friends,
    tcpServer,
    udpServer,
    settings,
    mainWindow,
    UDP_PORT,
    UDP_PORT_2,
    TCP_PORT,
    USER_DATA_DIR,
    initKEKKeyExchange,
    enterApp,
  };

  initIPC(ipcMain, dependencies);

  // Notify renderer that app initialization is complete
  mainWindow.webContents.send("app-enter-app", {});
  console.log("[App] Application initialized successfully.");
}

// ============================================================
// Electron App Lifecycle
// ============================================================

app.whenReady().then(() => {
  createMainWindow();

  // On macOS, re-create a window when the dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * Quit the app when all windows are closed.
 */
app.on("window-all-closed", () => {
  app.quit();
});
