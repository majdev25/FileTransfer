const crypto = require("crypto");

/**
 * Crypto Utilities
 * Handles AES, RSA, HMAC operations and buffer/object conversions
 */

class CryptoUtils {
  /**
   * Convert a JavaScript object to a UTF-8 Buffer
   * @param {Object} obj
   * @returns {Buffer}
   */
  static objectToBuffer(obj) {
    return Buffer.from(JSON.stringify(obj), "utf8");
  }

  /**
   * Convert a UTF-8 Buffer back to a JavaScript object
   * @param {Buffer} buffer
   * @returns {Object}
   */
  static bufferToObject(buffer) {
    return JSON.parse(buffer.toString("utf8"));
  }

  // ---------------- Random bytes ----------------

  /**
   * Generate cryptographically secure random bytes
   * @param {Number} size Number of bytes
   * @returns {Buffer}
   */
  static randomBytes(size) {
    return crypto.randomBytes(size);
  }

  // ---------------- RSA ----------------

  /**
   * Encrypt a UTF-8 string with an RSA public key
   * @param {String} data
   * @param {String} publicKey
   * @returns {Buffer}
   */
  static rsaEncryptWithPublicKey(data, publicKey) {
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(data, "utf8")
    );
  }

  /**
   * Decrypt a base64-encoded RSA ciphertext with a private key
   * @param {String} dataBase64 Base64 ciphertext
   * @param {String} privateKey
   * @param {String|null} passphrase
   * @returns {String} Decrypted UTF-8 string
   */
  static rsaDecryptWithPrivateKey(dataBase64, privateKey, passphrase = null) {
    const buffer = Buffer.from(dataBase64, "base64");
    return crypto
      .privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
          passphrase,
        },
        buffer
      )
      .toString("utf8");
  }

  // ---------------- AES ----------------

  /**
   * Encrypt a buffer with AES-256-CBC
   * @param {Buffer} buffer
   * @param {Buffer} key 32-byte AES key
   * @param {Buffer|null} iv 16-byte IV (optional, random if not provided)
   * @returns {{iv: string, ciphertext: string, tag: string}}
   */
  static aesEncryptBuffer(buffer, key, iv = null) {
    iv = iv || crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);

    const tag = CryptoUtils.hmac(ciphertext, key);

    return {
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      tag,
    };
  }

  /**
   * Decrypt an AES-encrypted payload
   * @param {{iv: string, ciphertext: string, tag: string}} payload
   * @param {Buffer} key 32-byte AES key
   * @returns {Buffer} Decrypted plaintext buffer
   * @throws {Error} If HMAC verification fails
   */
  static aesDecryptBuffer(payload, key) {
    const { iv, ciphertext, tag } = payload;

    const hmacCheck = CryptoUtils.hmac(Buffer.from(ciphertext, "base64"), key);
    if (hmacCheck !== tag) throw new Error("Invalid HMAC");

    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      key,
      Buffer.from(iv, "base64")
    );
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]);

    return plaintext;
  }

  // ---------------- HMAC ----------------

  /**
   * Compute HMAC-SHA256 of a buffer with a key
   * @param {Buffer} buffer
   * @param {Buffer} key
   * @returns {String} Base64-encoded HMAC
   */
  static hmac(buffer, key) {
    return crypto.createHmac("sha256", key).update(buffer).digest("base64");
  }
}

module.exports = CryptoUtils;
