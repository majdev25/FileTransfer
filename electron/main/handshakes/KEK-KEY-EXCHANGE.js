// KEK-KEY-EXCHANGE.js
const crypto = require("crypto");
const { generateSymmetricKey, generateChallenge } = require("../keyManager");
const FriendsManager = require("../friendsManager");

/**
 * Initializes AES KEK key exchange handlers on a TCP server
 * @param {Object} tcpServer - The TCP server instance
 * @param {FriendsManager} friends - The friends manager
 * @param {Object} keys - Own key pair { publicKey, privateKey }
 * @returns {Object} Object containing method to start a new AES key exchange
 */
function initKEKKeyExchange(tcpServer, friends, keys) {
  const AES_TIMEOUT = 10000; // Handshake timeout in ms

  /**
   * Send an RSA-encrypted message to a friend
   * @param {string} type - Event type
   * @param {Object} content - Message payload
   * @param {net.Socket} socket - Target socket
   * @param {Buffer|string} publicKey - Friend's public key
   */
  function sendEncrypted(type, content, socket, publicKey) {
    tcpServer.sendRSAEncrypted(type, content, socket, publicKey);
  }

  /**
   * Setup AES handshake timeout for a friend
   * Clears AES state if handshake not completed in time
   * @param {Object} friend
   */
  function setupHandshakeTimeout(friend) {
    friend.setAESHandshakeTimeout(
      setTimeout(() => {
        friend.clearAES();
        const socket = friend.getSocket();
        if (socket) socket.destroy();
        if (friend.AES._kekPromise) {
          friend.AES._kekPromise.reject(new Error("AES handshake timeout"));
        }
      }, AES_TIMEOUT)
    );
  }

  /**
   * Start a new AES KEK key exchange with a friend
   * @param {Object} friend
   * @returns {Promise<Object>} Resolves with friend when handshake succeeds
   */
  async function startNewKEKKeyExchange(friend) {
    return new Promise((resolve, reject) => {
      const AES = generateSymmetricKey();
      const challenge = generateChallenge(16);

      // Store KEK and challenge in friend object
      friend.setKeyEncryptionKey(AES.toString("base64"));
      friend.setAESChallenge(challenge);
      friend.AES._kekPromise = { resolve, reject };

      // Prepare handshake message
      const reply = {
        AES_key: AES.toString("base64"),
        challenge1: challenge,
        friendId: FriendsManager.generateFriendId(keys.publicKey),
      };

      const socket = tcpServer.createSocket(
        friend.getAddress(),
        friend.getPort()
      );
      friend.setSocket(socket);
      setupHandshakeTimeout(friend);

      // Send first handshake message once connected
      socket.on("connect", () =>
        sendEncrypted(
          "KEK-KEY-EXCHANGE-1",
          reply,
          socket,
          friend.getPublicKey()
        )
      );
    });
  }

  /**
   * Verify two challenge buffers in a timing-safe way
   * @param {Buffer} stored
   * @param {Buffer} received
   * @returns {boolean} true if buffers match
   */
  function verifyChallenge(stored, received) {
    return (
      stored.length === received.length &&
      crypto.timingSafeEqual(stored, received)
    );
  }

  // ---------------- Event Handlers ----------------

  // Step 1: Receive AES key from initiating friend
  tcpServer.on("KEK-KEY-EXCHANGE-1", (content, socket) => {
    const friend = friends.getFriend(content.friendId);
    friend.setSocket(socket);

    const challenge = generateChallenge(16);
    friend.setKeyEncryptionKey(content.AES_key);
    friend.setAESChallenge(challenge);
    setupHandshakeTimeout(friend);

    const reply = {
      friendId: FriendsManager.generateFriendId(keys.publicKey),
      challenge1: content.challenge1,
      challenge2: challenge,
    };

    sendEncrypted("KEK-KEY-EXCHANGE-2", reply, socket, friend.getPublicKey());
  });

  // Step 2: Verify first challenge and respond with second challenge
  tcpServer.on("KEK-KEY-EXCHANGE-2", (content, socket) => {
    const friend = friends.getFriend(content.friendId);

    if (
      verifyChallenge(
        Buffer.from(friend.getAESChallenge(), "base64"),
        Buffer.from(content.challenge1, "base64")
      )
    ) {
      const reply = {
        challenge2: content.challenge2,
        friendId: FriendsManager.generateFriendId(keys.publicKey),
      };
      sendEncrypted("KEK-KEY-EXCHANGE-3", reply, socket, friend.getPublicKey());
    } else {
      if (friend.AES._kekPromise) {
        friend.AES._kekPromise.reject(
          new Error("Challenge verification failed")
        );
        friend.AES._kekPromise = null;
      }
    }
  });

  // Step 3: Verify second challenge and send READY
  tcpServer.on("KEK-KEY-EXCHANGE-3", (content, socket) => {
    const friend = friends.getFriend(content.friendId);

    if (
      verifyChallenge(
        Buffer.from(friend.getAESChallenge(), "base64"),
        Buffer.from(content.challenge2, "base64")
      )
    ) {
      const reply = {
        friendId: FriendsManager.generateFriendId(keys.publicKey),
        status: "READY",
      };
      sendEncrypted("KEK-KEY-EXCHANGE-4", reply, socket, friend.getPublicKey());
    }
  });

  // Step 4: Activate AES session when READY received
  tcpServer.on("KEK-KEY-EXCHANGE-4", (content, socket) => {
    const friend = friends.getFriend(content.friendId);
    if (content.status === "READY") {
      friend.setAESActive();
      friend.clearAESHandshakeTimeout();

      const reply = {
        friendId: FriendsManager.generateFriendId(keys.publicKey),
        status: "READY",
      };
      sendEncrypted("KEK-KEY-EXCHANGE-5", reply, socket, friend.getPublicKey());

      if (friend.AES._kekPromise) {
        friend.AES._kekPromise.resolve(friend);
        friend.AES._kekPromise = null;
      }
    }
  });

  // Step 5: Confirm AES handshake completion
  tcpServer.on("KEK-KEY-EXCHANGE-5", (content, socket) => {
    const friend = friends.getFriend(content.friendId);
    if (content.status === "READY") {
      friend.setAESActive();
      friend.clearAESHandshakeTimeout();
      console.log("AES key exchange complete!");
      socket.end(() => {
        console.log("Socket closed after KEK exchange.");
      });
    }
  });

  // Return object exposing method to start a new key exchange
  return { startNewKEKKeyExchange };
}

module.exports = { initKEKKeyExchange };
