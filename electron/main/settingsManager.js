const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { app } = require("electron");

class Settings {
  constructor(passphrase, USER_DATA_DIR) {
    if (!passphrase)
      throw new Error("Passphrase is required for encrypted settings.");

    this.passphrase = passphrase;

    // Path to store settings file
    const userDataPath = USER_DATA_DIR;
    this.filePath = path.join(
      userDataPath,
      `settings_${process.env.INSTANCE || "default"}.json`
    );

    // Default settings
    this.settings = {
      downloadPath: null,
    };

    // Load settings from disk if available
    this.load();
  }

  // --- Encryption Helpers ---
  encryptData(data) {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash("sha256").update(this.passphrase).digest();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, "utf8"),
      cipher.final(),
    ]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  }

  decryptData(encryptedText) {
    const [ivHex, encryptedHex] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = crypto.createHash("sha256").update(this.passphrase).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  // --- File Operations ---
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const encrypted = fs.readFileSync(this.filePath, "utf-8");
        const raw = this.decryptData(encrypted);
        const data = JSON.parse(raw);
        this.settings = { ...this.settings, ...data };
      } else {
        // Set default download path if not set
        const downloadPath =
          path.join(os.homedir(), "Downloads") || os.homedir();
        if (!fs.existsSync(downloadPath))
          fs.mkdirSync(downloadPath, { recursive: true });
        this.settings.downloadPath = downloadPath;
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  save() {
    try {
      const json = JSON.stringify(this.settings, null, 2);
      const encrypted = this.encryptData(json);
      fs.writeFileSync(this.filePath, encrypted, "utf-8");
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  // --- Getters & Setters ---
  setDownloadPath(path) {
    this.settings.downloadPath = path;
    this.save();
  }

  setName(name) {
    this.settings.name = name;
    this.save();
  }

  getAllSettings() {
    return this.settings;
  }

  set(key, value) {
    this.settings[key] = value;
    this.save();
  }
}

module.exports = Settings;
