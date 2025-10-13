/**
 * File Transfer IPC Module
 * Handles AES-encrypted file transfers between friends
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function register(ipcMain, deps = {}) {
  const { friends, tcpServer, mainWindow, settings } = deps;

  if (!friends || !tcpServer || !mainWindow) {
    console.error("Deps passed to fileTransfer IPC module:", deps);
    throw new Error("Dependencies not passed correctly to IPC module");
  }

  const receivedFilesStreams = {}; // Temporary storage for incoming chunks

  // ------------------- IPC Handlers -------------------

  // Initiates sending a file to a friend
  ipcMain.handle("files-send-file", async (event, { filePath, friendId }) => {
    console.log(filePath, friendId);
    const friend = friends.getFriend(friendId);
    if (!friend) return;

    const fileName = path.basename(filePath);

    const stats = await fs.promises.stat(filePath);
    const size = stats.size;

    // Compute checksum using a stream (efficient for large files)
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    await new Promise((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const checksum = hash.digest("hex");

    // Store file info without the actual data
    friend._fileToSend = { filePath, fileName, checksum, size };

    const buf = Buffer.from(
      JSON.stringify({ fileName, size, checksum }),
      "utf8"
    );
    tcpServer.sendAES(friend, buf, { type: "AES-REQUEST-FILETRANSFER" });
  });

  // Accepts an incoming file transfer request
  ipcMain.handle("file-accept-fileTransfer", async (event, { data }) => {
    const { friendId, size, fileName, checksum } = data;
    const friend = friends.getFriend(friendId);
    if (!friend) return;

    friend._fileToRecieve = { size, fileName, checksum };
    const buf = Buffer.from(JSON.stringify({}), "utf8");
    tcpServer.sendAES(friend, buf, { type: "AES-ACCEPT-FILETRANSFER" });
  });

  // Rejects an incoming file transfer request
  ipcMain.handle("file-reject-fileTransfer", async (event, { data }) => {
    const { friendId } = data;
    const friend = friends.getFriend(friendId);
    if (!friend) return;

    const buf = Buffer.from(
      JSON.stringify({ status: 10, msg: "File transfer rejected." }),
      "utf8"
    );
    tcpServer.sendAES(friend, buf, { type: "AES-FILE-TRANSFERED" });
  });

  // ------------------- TCP Event Handlers -------------------

  // Handle incoming file transfer request from a friend
  tcpServer.on("AES-REQUEST-FILETRANSFER", (payload, socket, friend) => {
    payload = JSON.parse(payload.toString("utf8"));
    mainWindow.webContents.send("confirm-incoming-fileTransfer", {
      size: payload.size,
      fileName: payload.fileName,
      checksum: payload.checksum,
      friendId: friend.getFriendId(),
      friendName: friend.name,
    });
  });

  // Recieve file transfer confirmation and sends file
  tcpServer.on("AES-ACCEPT-FILETRANSFER", async (payload, socket, friend) => {
    payload = JSON.parse(payload.toString("utf8"));

    const { filePath, fileName, size, checksum } = friend._fileToSend;

    if (!filePath) return; // sanity check

    await sendFile(friend, filePath, fileName, size, checksum);
  });

  // Handles file chunk
  tcpServer.on("AES-FILE-CHUNK", (buffer, socket, friend) => {
    const friendId = friend.friendId;

    const chunkNo = buffer.readUInt32BE(0);
    const chunk = buffer.subarray(4);

    // Open file stream if not already
    if (!receivedFilesStreams[friendId]) {
      const downloadDir =
        settings.getAllSettings().downloadPath || app.getPath("downloads");
      const safeFileName = (friend._fileToRecieve.fileName || "FILE").replace(
        /[<>:"/\\|?*]+/g,
        "_"
      );
      const tempFilePath = path.join(downloadDir, `ft-temp-${safeFileName}`);
      receivedFilesStreams[friendId] = fs.createWriteStream(tempFilePath);
    }

    // Write chunk directly to file
    receivedFilesStreams[friendId].write(chunk);

    mainWindow.webContents.send("files-receive-progress", {
      friendId,
      chunkNo,
    });
  });

  // Handles file end and moves file to destination path
  tcpServer.on("AES-FILE-END", async (payload, socket, friend) => {
    const friendId = friend.friendId;
    const downloadDir =
      settings.getAllSettings().downloadPath || app.getPath("downloads");
    const safeFileName = (friend._fileToRecieve.fileName || "FILE").replace(
      /[<>:"/\\|?*]+/g,
      "_"
    );
    const tempFilePath = path.join(downloadDir, `ft-temp-${safeFileName}`);
    const ws = receivedFilesStreams[friendId];

    if (ws) {
      ws.end(); // close the temporary file stream
      delete receivedFilesStreams[friendId];

      const finalFilePath = path.join(
        downloadDir,
        "ft-" + (friend._fileToRecieve.fileName || "FILE")
      );

      try {
        // Compute checksum of received file
        const hash = crypto.createHash("sha256");
        const fileStream = fs.createReadStream(tempFilePath);
        for await (const chunk of fileStream) hash.update(chunk);
        const receivedChecksum = hash.digest("hex");

        if (receivedChecksum !== friend._fileToRecieve.checksum) {
          throw new Error("Checksum mismatch! File may be corrupted.");
        }

        fs.renameSync(tempFilePath, finalFilePath); // move to final filename

        mainWindow.webContents.send("file-transfer-status", {
          friendId,
          filePath: finalFilePath,
          friendName: friend.name,
          status: "OK",
          fileName: friend._fileToRecieve.fileName,
        });

        const buf = Buffer.from(
          JSON.stringify({ status: 2, msg: "File transfer successful" }),
          "utf8"
        );
        tcpServer.sendAES(friend, buf, { type: "AES-FILE-TRANSFERED" });
      } catch (err) {
        console.error(
          `[AES-FILE-END] Failed to finalize file from friend ${friendId}:`,
          err
        );
        mainWindow.webContents.send("file-transfer-status", {
          friendId,
          filePath: finalFilePath,
          friendName: friend.name,
          status: "ERROR",
          fileName: friend._fileToRecieve.fileName,
        });

        const buf = Buffer.from(
          JSON.stringify({ status: 10, msg: "File transfer failed" }),
          "utf8"
        );
        tcpServer.sendAES(friend, buf, { type: "AES-FILE-TRANSFERED" });
      }
    } else {
      console.warn(
        `[AES-FILE-END] No writable stream found for friend ${friendId}`
      );
    }
  });

  // Confirmation of successfuly transfared file
  tcpServer.on("AES-FILE-TRANSFERED", (payload, socket, friend) => {
    payload = JSON.parse(payload.toString("utf8"));
    mainWindow.webContents.send("file-transfer-ack", {
      status: payload.status,
      msg: payload.msg,
    });
    if (friend._fileToSend) delete friend._fileToSend;
  });

  // ------------------- Helper Functions -------------------
  /**
   *
   * @param {Friend} friend
   * @param {String} filePath
   * @param {String} fileName
   * @param {Number} size
   * @param {String} checksum
   */
  async function sendFile(friend, filePath, fileName, size, checksum) {
    const chunkSize = 64 * 1024; // 64KB
    const stream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
    let chunkNo = 0;
    let sentBytes = 0;

    try {
      for await (const chunk of stream) {
        const chunkNoBuf = Buffer.alloc(4);
        chunkNoBuf.writeUInt32BE(chunkNo, 0);
        const buf = Buffer.concat([chunkNoBuf, chunk]);

        // Wait for the socket to be ready before sending next chunk
        await new Promise((resolve) => {
          const canSend = tcpServer.sendAES(friend, buf, {
            type: "AES-FILE-CHUNK",
          });
          if (canSend) resolve();
          else tcpServer.once("drain", resolve);
        });

        sentBytes += chunk.length;
        mainWindow.webContents.send("files-trans-percent", {
          percent: (sentBytes / size) * 100,
        });

        chunkNo++;
      }

      const meta = Buffer.from(
        JSON.stringify({ fileName, size, checksum }),
        "utf8"
      );
      const endMarker = Buffer.concat([Buffer.alloc(4, 0xff), meta]);
      tcpServer.sendAES(friend, endMarker, { type: "AES-FILE-END" });
    } catch (err) {
      console.error(
        `[sendFile] Error sending file to ${friend.friendId}:`,
        err
      );
      // Optional: notify frontend about failure
      mainWindow.webContents.send("files-trans-error", {
        friendId: friend.friendId,
        message: err.message,
      });
    }
  }
}

module.exports = { register };
