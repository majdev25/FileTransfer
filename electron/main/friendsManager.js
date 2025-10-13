const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const crypto = require("crypto");
const EventEmitter = require("events");

/**
 * Represents a friend with encryption state, socket, and metadata
 */

class Friend extends EventEmitter {
  /**
   * @param {string} publicKey RSA public key
   * @param {string} name Friend's name
   */
  constructor(publicKey, name = "") {
    super();
    this.publicKey = publicKey;
    this.address = null;
    this.port = null;
    this.socket = null;
    this.name = name;
    this.AES = {
      keyEncryptionKey: null,
      key: null,
      challenge: null,
      active: false,
      valid_time: null,
      handshakeTimeout: null,
      _kekPromise: null,
      con: {},
    };
    this.lastSeen = Date.now();
    this.friendId = Friend.generateFriendId(publicKey);
    this.friendAccepted = false;
  }

  // --- Utility ---
  /**
   * Generate a unique friend ID from a public key
   * @param {string} publicKey
   * @returns {string} 16-character base64 ID
   */
  static generateFriendId(publicKey) {
    return crypto
      .createHash("sha256")
      .update(publicKey)
      .digest("base64")
      .slice(0, 16);
  }

  // --- Getters ---
  getPublicKey() {
    return this.publicKey;
  }
  getFriendId() {
    return this.friendId;
  }
  getAESKey() {
    return this.AES.key;
  }
  getAESChallenge() {
    return this.AES.challenge;
  }
  getHandshakeTimeout() {
    return this.AES.handshakeTimeout;
  }
  getSocket() {
    return this.socket;
  }
  getAddress() {
    return this.address;
  }
  getPort() {
    return this.port;
  }

  // --- Setters with emits ---
  setAESKey(key) {
    this.AES.key = key;
    this.emitChange("AESKey", key);
  }
  setKeyEncryptionKey(key) {
    this.AES.keyEncryptionKey = key;
    this.emitChange("AESKeyEncryptionKey", key);
  }
  setAESChallenge(challenge) {
    this.AES.challenge = challenge;
    this.emitChange("AESChallenge", challenge);
  }
  setAESActive() {
    this.AES.active = true;
    this.AES.date_activated = new Date();
    this.emitChange("AESActive", true);
  }
  setAESHandshakeTimeout(timeout) {
    this.AES.handshakeTimeout = timeout;
    this.emitChange("AESHandshakeTimeout", timeout);
  }
  setSocket(socket) {
    this.socket = socket;
    this.emitChange("socket", socket);
  }
  setAddress(address) {
    this.address = address;
    this.emitChange("address", address);
  }
  setPort(port) {
    this.port = port;
    this.emitChange("port", port);
  }
  updateLastSeen() {
    this.lastSeen = Date.now();
    this.emitChange("lastSeen", this.lastSeen);
  }
  setFriendAccepted(val) {
    this.friendAccepted = val;
    this.emitChange("friendAccepted", val);
  }
  setName(name) {
    this.name = name;
    this.emitChange("name", name);
  }

  clearAESHandshakeTimeout() {
    clearTimeout(this.getHandshakeTimeout());
    this.setAESHandshakeTimeout(null);
  }

  clearAES() {
    this.AES.key = null;
    this.AES.challenge = null;
    this.AES.active = false;
    this.AES.date_activated = null;
    this.AES.handshakeTimeout = null;
    this.emitChange("AESCleared", null);
  }

  /**
   * Emit a generic change event
   * @param {string} type
   * @param {any} value
   */
  emitChange(type, value) {
    this.emit("change", { type, friendId: this.friendId, value });
  }

  // --- Persistence ---
  /**
   * Serialize friend to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      publicKey: this.publicKey,
      name: this.name,
      friendId: this.friendId,
      lastSeen: this.lastSeen,
      friendAccepted: this.friendAccepted,
      address: this.address,
      port: this.port,
      AES: {
        keyEncryptionKey: this.AES.keyEncryptionKey,
        key: this.AES.key,
        challenge: this.AES.challenge,
        active: this.AES.active,
        date_activated: this.AES.date_activated,
      },
    };
  }

  /**
   * Create a Friend instance from JSON data
   * @param {Object} data
   * @returns {Friend}
   */
  static fromJSON(data) {
    const friend = new Friend(data.publicKey, data.name || "");
    friend.lastSeen = data.lastSeen || Date.now();
    friend.friendAccepted = data.friendAccepted || false;
    friend.address = data.address || null;
    friend.port = data.port || null;
    if (data.AES) friend.AES = { ...friend.AES, ...data.AES };
    return friend;
  }
}

/**
 * Manages a collection of friends and persists them
 */
class FriendsManager extends EventEmitter {
  constructor(passphrase) {
    super();
    this.passphrase = passphrase;
    const userDataPath = app.getPath("userData");
    this.filePath = path.join(
      userDataPath,
      `friends_${process.env.INSTANCE || "default"}.json`
    );
    this.friends = new Map();
    this.load();
  }

  /**
   * Add a friend or update existing
   * @param {string} publicKey
   * @param {string} name
   * @returns {Friend}
   */
  addFriend(publicKey, name = "") {
    const friendId = Friend.generateFriendId(publicKey);

    if (this.friends.has(friendId)) {
      const oldFriend = this.friends.get(friendId);
      if (oldFriend.socket) oldFriend.socket.destroy();
      oldFriend.removeAllListeners();
      this.friends.delete(friendId);
      this.emit("friendRemoved", { friendId });
    }

    if (!this.friends.has(friendId)) {
      const friend = new Friend(publicKey, name);

      friend.on("change", (evt) => {
        this.emit("friendChange", evt);
        this.emit(`friend:${friendId}`, evt);
        this.save();
      });

      this.friends.set(friendId, friend);
      this.emit("friendAdded", { friendId, friend });
    }
    this.save();
    return this.friends.get(friendId);
  }

  /**
   * Get a friend by ID
   * @param {string} friendId
   * @returns {Friend|undefined}
   */
  getFriend(friendId) {
    return this.friends.get(friendId);
  }

  /**
   * Remove a friend by ID
   * @param {string} friendId
   */
  removeFriend(friendId) {
    const friend = this.friends.get(friendId);
    if (friend) {
      if (friend.socket) friend.socket.destroy();
      this.friends.delete(friendId);
      this.emit("friendRemoved", { friendId });
      this.save();
    }
  }

  /**
   * Get all friends
   * @returns {Friend[]}
   */
  getAllFriends() {
    return Array.from(this.friends.values());
  }

  /** Encrypt text with AES-256-CBC using passphrase */
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

  /** Decrypt text with AES-256-CBC using passphrase */
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

  /** Persist friends to disk (encrypted) */
  save() {
    try {
      const arr = Array.from(this.friends.values()).map((f) => f.toJSON());
      const json = JSON.stringify(arr, null, 2);
      const encrypted = this.encryptData(json);
      fs.writeFileSync(this.filePath, encrypted, "utf-8");
    } catch (err) {
      console.error("Failed to save friends:", err);
    }
  }

  /** Load friends from disk (decrypting first) */
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const encrypted = fs.readFileSync(this.filePath, "utf-8");
        const raw = this.decryptData(encrypted);
        const arr = JSON.parse(raw);
        arr.forEach((obj) => {
          const friend = Friend.fromJSON(obj);

          friend.on("change", (evt) => {
            this.emit("friendChange", evt);
            this.emit(`friend:${friend.friendId}`, evt);
            this.save();
          });

          this.friends.set(friend.friendId, friend);
        });
      }
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }

  /**
   * Generate friend ID from public key (proxy)
   * @param {string} publicKey
   * @returns {string}
   */
  static generateFriendId(publicKey) {
    return Friend.generateFriendId(publicKey);
  }
}

module.exports = FriendsManager;
