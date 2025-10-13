/**
 * Friends IPC Module
 * Handles friend discovery, search, and acceptance via UDP
 */

const dgram = require("dgram");
const { networkInterfaces } = require("os");
const FriendsManager = require("../friendsManager");

/**
 * Get broadcast addresses for all non-internal IPv4 interfaces
 * @returns {string[]} Array of broadcast addresses
 */
function getBroadcastAddresses() {
  const nets = networkInterfaces();
  const addresses = [];

  Object.values(nets).forEach((interfaces) =>
    interfaces.forEach((net) => {
      if (net.family === "IPv4" && !net.internal) {
        const parts = net.address.split(".");
        parts[3] = "255";
        addresses.push(parts.join("."));
      }
    })
  );

  return addresses;
}

/** Remove whitespace from a key string */
const sanitizeKey = (str) => str.replace(/\s+/g, "");

/** Helper: Add friend and set address/port */
function addFriendFromContent(friends, content, rinfo) {
  const friend = friends.addFriend(content.senderKey);
  friend.setAddress(rinfo.address);
  friend.setPort(content.tcpPORT);
  friend.setName(content.name || "Anonymous");
  return friend;
}

/**
 * Broadcast a friend search request over UDP
 * @param {string} friendKey - Friend's public key (without START/END markers)
 * @param {KeyManager} keys - KeyManager instance with user's public key
 * @param {number} udpPort - Local UDP port to send from
 * @param {number} udpPort2 - Target UDP broadcast port
 * @param {number} tcpPort - User's TCP port for later communication
 * @param {SettingsManager} settings - SettingsManager instance with user's name
 */
async function broadcastFriendSearch(
  friendKey,
  keys,
  udpPort,
  udpPort2,
  tcpPort,
  settings
) {
  return new Promise((resolve, reject) => {
    console.log("[UDP] Broadcasting friend search...");
    const client = dgram.createSocket("udp4");

    client.bind(() => {
      client.setBroadcast(true);

      const payload = {
        type: "friends-request-info",
        content: {
          friendKey,
          senderKey: keys.publicKey,
          udpPort,
          tcpPORT: tcpPort,
          name: settings.getAllSettings().name || "Anonymous",
        },
      };

      const msgBuffer = Buffer.from(JSON.stringify(payload));
      const broadcastAddresses = getBroadcastAddresses();
      let sentCount = 0;
      const errors = [];

      broadcastAddresses.forEach((addr) => {
        client.send(msgBuffer, udpPort2, "255.255.255.255", (err) => {
          if (err) errors.push(err);
          sentCount++;
          if (sentCount === broadcastAddresses.length) {
            client.close();
            errors.length
              ? reject(errors)
              : resolve({ status: "sent", broadcastAddresses });
          }
        });
      });

      client.on("error", (err) => {
        client.close();
        reject(err);
      });
    });
  });
}

/** Register all friend-related IPC handlers */
function register(ipcMain, deps = {}) {
  const {
    keys,
    friends,
    udpServer,
    mainWindow,
    tcpServer,
    UDP_PORT,
    UDP_PORT_2,
    TCP_PORT,
    initKEKKeyExchange,
    settings,
  } = deps;

  // ------------------- IPC Handlers -------------------

  // Returns raw public key
  ipcMain.handle("keys-get-public-key", async () => keys.rawPublicKey);

  // Returns all stored friends
  ipcMain.handle("friends-get-all-friends", async (event, {}) => {
    return JSON.stringify(friends.getAllFriends());
  });

  // Initiates udp broadcast to find a friend
  ipcMain.handle("friends-search", async (event, { message }) => {
    try {
      console.log("[UDP] Broadcasting friend search...");
      return await broadcastFriendSearch(
        message,
        keys,
        UDP_PORT,
        UDP_PORT_2,
        TCP_PORT,
        settings
      );
    } catch (err) {
      console.error("[IPC] Error broadcasting friend search:", err);
      throw err;
    }
  });

  // Asks user to confirm friend's public key and send back confirmation
  ipcMain.handle(
    "friends-accept-incoming-public-key",
    (event, { friendId, address, port }) => {
      const friend = friends.getFriend(friendId);
      if (!friend) return console.error("Friend not found for ID:", friendId);

      AcceptFriend(friend, address, port);
    }
  );

  function AcceptFriend(friend, address, port) {
    // Mark friend as accepted
    friend.setFriendAccepted(true);

    // Send UDP message
    udpServer.send(
      "friends-respond-info",
      {
        senderKey: keys.publicKey,
        tcpPORT: TCP_PORT,
        name: settings.getAllSettings().name || "Anonymous",
      },
      address,
      port,
      (err) => {
        if (err) console.error("[UDP] Send error:", err);
      }
    );
  }

  /**
   * Checks if friend is reachable.
   * Sends a TCP AES message and waits for a reply, using a timeout fallback via UDP broadcast
   */
  ipcMain.handle("friends-test-connection", async (event, { friendId }) => {
    const friend = friends.getFriend(friendId);
    if (!friend) return;

    console.log("[TCP] Testing connection to friend", friendId);

    // TCP test
    const buf = Buffer.from(JSON.stringify({ msg: "hello" }), "utf8");
    tcpServer.sendAES(friend, buf, { type: "AES-TEST-CONNECTION" });

    if (friend._testConStatus == 0) return;
    // Store a promise with timeout
    friend._testConStatus = 0; // 0 = pending, 1 = success

    setTimeout(async () => {
      try {
        if (friend._testConStatus === 1) return;
        const result = await broadcastFriendSearch(
          friend
            .getPublicKey()
            .split("\n")
            .filter(
              (line) => !line.includes("PUBLIC KEY") && line.trim() !== ""
            )
            .join(""),
          keys,
          UDP_PORT,
          UDP_PORT_2,
          TCP_PORT,
          settings
        );
      } catch (err) {
        console.log(err);
        delete friend._testConStatus;
      } finally {
        delete friend._testConStatus;
      }
    }, 3000);

    return true;
  });

  // ------------------- UDP Event Handlers -------------------

  // Accept friend search request
  udpServer.on("friends-request-info", (content, rinfo) => {
    console.log("[UDP] Received friends-request-info", content);
    if (keys.publicKey === content.senderKey) return;

    if (sanitizeKey(keys.rawPublicKey) === sanitizeKey(content.friendKey)) {
      // Find if friend alredy exists
      var oldFriend = friends.getFriend(
        FriendsManager.generateFriendId(content.senderKey)
      );
      const friend = addFriendFromContent(friends, content, rinfo);

      // Skip accept request if name maches
      if (
        oldFriend &&
        friend.name &&
        oldFriend.name == friend.name &&
        oldFriend.friendAccepted
      ) {
        AcceptFriend(friend, rinfo.address, UDP_PORT_2);
      } else {
        mainWindow.webContents.send("confirm-incoming-friend", {
          senderKey: content.senderKey,
          address: rinfo.address,
          port: UDP_PORT_2,
          name: content.name || "Anonymous",
          friendId: friend.getFriendId(),
          oldFriend: oldFriend?.name || null,
        });
      }
    }
  });

  // Prepares function for execution of KEK Key Exchange
  const { startNewKEKKeyExchange } = initKEKKeyExchange(
    tcpServer,
    friends,
    keys
  );

  // Friend response on friend search
  udpServer.on("friends-respond-info", async (content, rinfo) => {
    const friend = addFriendFromContent(friends, content, rinfo);
    friend.setFriendAccepted(true);

    mainWindow.webContents.send("friends-friend-found-and-accepted", {});

    try {
      await startNewKEKKeyExchange(friend);
      mainWindow.webContents.send("friends-friend-KEK-created", {});
    } catch (err) {
      mainWindow.webContents.send("friends-friend-KEK-failed", {});
      console.error("[KEK] Key exchange failed:", err);
    }
  });

  // ------------------- FRIEND TEST PROTOCOL -------------------

  tcpServer.on("AES-TEST-CONNECTION", (payload, socket, friend) => {
    payload = JSON.parse(payload.toString("utf8"));
    if (payload.msg !== "hello") return;

    const buf = Buffer.from(JSON.stringify({ msg: "hello2" }), "utf8");
    tcpServer.sendAES(friend, buf, { type: "AES-TEST-CONNECTION-REPLY" });
  });

  tcpServer.on("AES-TEST-CONNECTION-REPLY", (payload, socket, friend) => {
    payload = JSON.parse(payload.toString("utf8"));
    if (payload.msg !== "hello2") return;

    mainWindow.webContents.send("files-test-connection-OK", {
      status: 1,
    });

    friend._testConStatus = 1;
  });
}

module.exports = { register };
