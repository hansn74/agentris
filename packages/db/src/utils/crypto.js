"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto_1 = require("crypto");
const util_1 = require("util");
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
class CryptoService {
    static async deriveKey(password, salt) {
        return (await scryptAsync(password, salt, 32));
    }
    static async encrypt(text) {
        const salt = (0, crypto_1.randomBytes)(SALT_LENGTH);
        const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
        const key = await this.deriveKey(ENCRYPTION_KEY, salt);
        const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        const combined = Buffer.concat([salt, iv, tag, encrypted]);
        return combined.toString('base64');
    }
    static async decrypt(encryptedText) {
        const combined = Buffer.from(encryptedText, 'base64');
        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const key = await this.deriveKey(ENCRYPTION_KEY, salt);
        const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
    static async encryptObject(obj) {
        return this.encrypt(JSON.stringify(obj));
    }
    static async decryptObject(encryptedText) {
        const decrypted = await this.decrypt(encryptedText);
        return JSON.parse(decrypted);
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=crypto.js.map