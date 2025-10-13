const { createPrivateKey, generateKeyPairSync } = require("crypto");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const instanceId = process.env.INSTANCE || "default";
const keyDir = path.join(app.getPath("userData"), `keys_${instanceId}`);
const privateKeyPath = path.join(keyDir, "private.pem");
const publicKeyPath = path.join(keyDir, "public.pem");
var passphrase = "";

/**
 * Ensure RSA key pair exists and validate passphrase
 * @param {string} password
 * @returns {Object|null} Keys if passphrase correct, null otherwise
 */
function ensureKeys(password) {
  passphrase = password;
  console.log("Using passphrase:", passphrase);

  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    try {
      // Read the private key as a Buffer (not utf-8 string!)
      const privateKeyBuf = fs.readFileSync(privateKeyPath);
      const publicKeyPem = fs.readFileSync(publicKeyPath, "utf-8");

      // Try to decrypt with the passphrase
      const privateKeyObj = createPrivateKey({
        key: privateKeyBuf,
        format: "pem",
        passphrase,
      });

      // Success → extract the PEM string again
      const privateKeyPem = privateKeyObj.export({
        format: "pem",
        type: "pkcs8",
        cipher: "aes-256-cbc",
        passphrase,
      });

      const rawPublicKey = publicKeyPem
        .split("\n")
        .filter((line) => !line.includes("PUBLIC KEY") && line.trim() !== "")
        .join("");

      const rawPrivateKey = privateKeyPem
        .split("\n")
        .filter((line) => !line.includes("PRIVATE KEY") && line.trim() !== "")
        .join("");

      return {
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        rawPublicKey,
        rawPrivateKey,
        passphrase,
      };
    } catch (err) {
      console.error(
        "Invalid passphrase or corrupted private key!",
        err.message
      );
      return null;
    }
  }

  console.log("Generating new key pair...");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase,
    },
  });

  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);

  const rawPublicKey = publicKey
    .split("\n")
    .filter((line) => !line.includes("PUBLIC KEY") && line.trim() !== "")
    .join("");

  const rawPrivateKey = privateKey
    .split("\n")
    .filter((line) => !line.includes("PRIVATE KEY") && line.trim() !== "")
    .join("");

  return { privateKey, publicKey, rawPublicKey, rawPrivateKey, passphrase };
}

/**
 * Generate a random 256-bit symmetric key
 * @returns {Buffer}
 */
function generateSymmetricKey() {
  return crypto.randomBytes(32);
}

/**
 * Generate a base64 challenge
 * @param {number} len Length in bytes
 * @returns {string}
 */
function generateChallenge(len) {
  return crypto.randomBytes(len).toString("base64");
}

/**
 * Encrypt a key for storage with a password using AES-GCM
 * @param {Buffer} originalKey
 * @param {string} password
 * @returns {Buffer}
 */
function encryptKEY(originalKey, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(originalKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypt a key previously encrypted with encryptKEY
 * @param {Buffer} encBuffer
 * @param {string} password
 * @returns {Buffer}
 */
function decryptKEY(encBuffer, password) {
  const salt = encBuffer.slice(0, 16);
  const iv = encBuffer.slice(16, 28);
  const tag = encBuffer.slice(28, 44);
  const encrypted = encBuffer.slice(44);

  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = {
  ensureKeys,
  generateSymmetricKey,
  generateChallenge,
  encryptKEY,
  decryptKEY,
};
