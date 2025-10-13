/**
 * UDP Server Module
 * Provides an event-driven UDP server abstraction.
 */

const dgram = require("dgram");
const EventEmitter = require("events");

class UdpServer extends EventEmitter {
  /**
   * @param {number} port - UDP port to bind the server to
   */
  constructor(port) {
    super();
    this.port = port;
    this.server = dgram.createSocket({ type: "udp4", reuseAddr: true });
  }

  /**
   * Start listening for UDP messages
   */
  start() {
    this.server.on("message", (msg, rinfo) => {
      try {
        const payload = JSON.parse(msg.toString("utf8"));
        const { type, content } = payload;

        console.log(
          `[UDP] Received message: ${type} from ${rinfo.address}:${rinfo.port}`
        );

        // Emit event based on message type
        this.emit(type, content, rinfo);
      } catch (err) {
        console.error("[UDP] Invalid message format:", err);
        // Emit raw message event for debugging
        this.emit("message", msg.toString(), rinfo);
      }
    });

    this.server.on("error", (err) => {
      console.error("[UDP] Server error:", err);
    });

    this.server.bind(this.port, () => {
      console.log(`[UDP] Server listening on port ${this.port}`);
    });
  }

  /**
   * Send a UDP message
   * @param {string} type - Event type / message type
   * @param {Object} content - Payload content
   * @param {string} address - Target IP
   * @param {number} port - Target port
   * @param {Function} [callback] - Optional callback
   */
  send(type, content, address, port, callback) {
    const payload = Buffer.from(JSON.stringify({ type, content }));
    this.server.send(payload, 0, payload.length, port, address, (err) => {
      if (err) {
        console.error(
          `[UDP] Failed to send ${type} to ${address}:${port}`,
          err
        );
      } else {
        console.log(`[UDP] Sent ${type} to ${address}:${port}`);
      }
      if (callback) callback(err);
    });
  }
}

module.exports = UdpServer;
