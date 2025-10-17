const EventEmitter = require("events");
const net = require("net");
const crypto = require("crypto");
const FriendsManager = require("./friendsManager");
const CryptoUtils = require("./cryptoUtils");

const SOCKET_VALID_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * TCP Server Module
 * Handles RSA and AES encrypted TCP communication with friends
 */
class TcpServer extends EventEmitter {
  /**
   * @param {number} port - TCP port for the RSA server
   * @param {string} privateKey - PEM private key for RSA decryption
   * @param {object} keys - Object containing public/private key pair
   * @param {string|null} passphrase - Passphrase for private key, if encrypted
   */
  constructor(port, privateKey, keys, passphrase = null) {
    super();
    this.port = port;
    this.keys = keys;
    this.privateKey = privateKey;
    this.passphrase = passphrase;
    this.friends = null; // Will hold reference to FriendsManager
  }

  // ---------------- JSON Stream Handler ----------------

  /**
   * Attach a JSON stream parser to a socket.
   * Buffers incoming data until newline, then parses JSON.
   * @param {net.Socket} socket
   * @param {Function} onMessage - Callback invoked with parsed object
   */
  attachJSONStreamHandler(socket, onMessage) {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop();

      for (const part of parts) {
        if (!part.trim()) continue;
        try {
          const message = JSON.parse(part);
          onMessage(message, socket, (err) => {
            if (err) console.error("[TCP] Message handler error:", err);
          });
        } catch (err) {
          console.error("[TCP] Failed to parse JSON:", err, "Raw:", part);
        }
      }
    });

    // Helper method to send JSON objects over the socket
    socket.sendJSON = (obj) => socket.write(JSON.stringify(obj) + "\n");
  }

  // ---------------- Server Startup ----------------

  /**
   * Start both RSA and AES servers and bind to ports.
   * @param {FriendsManager} friends
   */
  start(friends) {
    this.friends = friends;

    // --- RSA Server ---
    this.serverRSA = net.createServer((socket) =>
      this.handleRSAConnection(socket)
    );
    this.serverRSA.listen(this.port, () =>
      console.log(`[TCP] RSA server listening on port ${this.port}`)
    );

    // --- AES Server ---
    this.serverAES = net.createServer((socket) =>
      this.attachAESSocketHandlers(socket)
    );
    this.serverAES.listen(this.port + 1, () =>
      console.log(`[TCP] AES server listening on port ${this.port + 1}`)
    );
  }

  // ---------------- RSA Methods ----------------

  /**
   * Handle incoming RSA-encrypted socket connection.
   * Decrypts messages using server private key.
   * @param {net.Socket} socket
   */
  handleRSAConnection(socket) {
    socket.on("data", (data) => {
      try {
        const decrypted = this.decryptWithPrivateKey(data.toString());
        const payload = JSON.parse(decrypted);
        this.emit(payload.type, payload.content, socket);
      } catch (err) {
        console.error("[TCP] Invalid encrypted TCP message:", err);
      }
    });

    socket.on("error", (err) => console.error("[TCP] Socket error:", err));
    socket.on("end", () => console.log("[TCP] Socket disconnected"));
  }

  /**
   * Encrypt data using a friend's public key and send over socket.
   */
  sendRSAEncrypted(type, content, socket, clientPublicKey) {
    const payload = JSON.stringify({ type, content });
    const encrypted = crypto.publicEncrypt(
      {
        key: clientPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(payload, "utf8")
    );
    socket.write(encrypted.toString("base64"));
  }

  /**
   * Decrypt incoming RSA-encrypted message using server private key.
   */
  decryptWithPrivateKey(encryptedBase64) {
    const buffer = Buffer.from(encryptedBase64, "base64");
    return crypto
      .privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
          passphrase: this.passphrase,
        },
        buffer
      )
      .toString("utf8");
  }

  /**
   * Create a new TCP socket and attach RSA handlers.
   */
  createSocket(host, port) {
    const socket = net.createConnection(port, host);
    this.handleRSAConnection(socket);
    return socket;
  }

  // ---------------- AES Methods ----------------

  /**
   * Attach AES encrypted message handlers to a socket.
   * @param {net.Socket} socket
   */
  attachAESSocketHandlers(socket) {
    this.attachJSONStreamHandler(socket, (message, sock) => {
      //console.log("[AES] Encrypted message received:", message.type);
      try {
        const friend = this.friends.getFriend(message.friendId);
        if (!friend) return;

        // --- Handle valid AES message ---
        switch (message.type) {
          case "NEW-AES-EX":
            this.handleAESHandshake(message, friend, socket);
            break;

          default:
            // --- Check AES connection validity ---
            const con = friend.AES?.con;
            if (!con || !con.active) {
              console.warn(
                "[AES] Inactive AES connection for friend:",
                message.friendId
              );
              return;
            }

            // Check if AES session expired
            if (Date.now() > con.valid_until) {
              console.warn(
                "[AES] AES session expired for friend:",
                message.friendId
              );
              return;
            }

            // Decrypt payload and emit event
            const decrypted = this.decryptAESPayload(message.payload, con.key);
            this.emit(message.type, decrypted, socket, friend);
        }
      } catch (err) {
        console.error("[AES] Data decryption failed:", err);
      }
    });
  }

  /**
   * Handle incoming AES handshake message and establish session key.
   */
  handleAESHandshake(message, friend, socket) {
    const { ivKEK, payload, tag } = message;
    const kek = Buffer.from(friend.AES.keyEncryptionKey, "base64");

    // Decrypt handshake payload using KEK
    const decrypted = CryptoUtils.aesDecryptBuffer(
      { iv: ivKEK, ciphertext: payload, tag },
      kek
    );

    const handshakePayload = CryptoUtils.bufferToObject(decrypted);

    friend.AES.con = {
      key: Buffer.from(handshakePayload.key, "base64"),
      active: true,
      valid_until: Date.now() + SOCKET_VALID_TIME,
      socket,
    };

    console.log("[AES] New socket recieved");

    this.emit("aes-handshake", handshakePayload, friend, socket);
  }

  /**
   * Create a new AES socket to a friend and initiate handshake.
   */
  async createAESSocket(friend, port) {
    const socket = net.createConnection(port, friend.address);

    // Generate session AES key
    const aesKey = crypto.randomBytes(32);
    friend.AES.con = {
      key: aesKey,
      active: true,
      socket,
      valid_until: Date.now() + SOCKET_VALID_TIME,
    };

    // Handshake payload
    const handshakePayload = {
      key: aesKey.toString("base64"),
      nonce: crypto.randomBytes(16).toString("base64"),
      timestamp: Date.now(),
    };

    const kek = Buffer.from(friend.AES.keyEncryptionKey, "base64");

    // Encrypt handshake payload
    const encryptedPayload = CryptoUtils.aesEncryptBuffer(
      CryptoUtils.objectToBuffer(handshakePayload),
      kek
    );

    // Send handshake message
    socket.write(
      JSON.stringify({
        type: "NEW-AES-EX",
        friendId: FriendsManager.generateFriendId(this.keys.publicKey),
        ivKEK: encryptedPayload.iv,
        payload: encryptedPayload.ciphertext,
        tag: encryptedPayload.tag,
      }) + "\n"
    );

    // Handle socket lifecycle events
    socket.on("close", () => {
      this.destroySocket(friend);
    });
    socket.on("end", () => {
      this.destroySocket(friend);
    });
    socket.on("error", (err) => {
      console.error("[TCP] Socket error:", err);
      this.destroySocket(friend);
    });

    console.log("[AES] New AES socket created, handshake NEW-AES-EX sent .");
    this.attachAESSocketHandlers(socket);
    return socket;
  }

  destroySocket(friend) {
    console.log("[AES] Socket closed for friend", friend.getFriendId());
    friend.AES.con.active = false;
    friend.AES.con.socket = null;
    friend.AES.con.date_activated = null;
    this.emit("aes-disconnected", friend);
  }

  /**
   * Decrypt AES payload using session key
   */
  decryptAESPayload(payload, aesKey) {
    return CryptoUtils.aesDecryptBuffer(payload, aesKey);
  }

  /**
   * Encrypt and send data over AES socket to friend
   * @param {Friend} friend
   * @param {Buffer} buffer - Data to send
   * @param {object} opts - Options { type: string, meta?: object }
   */
  async sendAES(friend, buffer, opts = {}) {
    if (!friend.AES.con?.active || Date.now() > friend.AES.con.valid_until) {
      console.log("[AES] Socket not valid, creating new");
      await this.createAESSocket(friend, friend.getPort() + 1);

      // Wait 1 second to ensure handshake completes
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array))
      throw new Error("Buffer must be Buffer or Uint8Array");

    const payload = CryptoUtils.aesEncryptBuffer(buffer, friend.AES.con.key);

    const dataToSend =
      JSON.stringify({
        type: opts.type,
        friendId: FriendsManager.generateFriendId(this.keys.publicKey),
        payload: { ...payload, ...(opts.meta || {}) },
      }) + "\n";

    //console.log("[TCP] Sent encrypted message: " + opts.type);
    const canWrite = friend.AES.con.socket.write(dataToSend);

    // Prevent ENOBUF error by listening for drain
    if (!canWrite) {
      if (!friend.AES.con.socket._waitingDrain) {
        friend.AES.con.socket._waitingDrain = true;
        friend.AES.con.socket.once("drain", () => {
          friend.AES.con.socket._waitingDrain = false;
          this.emit("drain", friend);
        });
      }
    }

    return canWrite; // true if write succeeded, false if buffered
  }
}

module.exports = TcpServer;
