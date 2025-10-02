import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export class CryptoService {
  private static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(password, salt, 32)) as Buffer;
  }

  public static async encrypt(text: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = await this.deriveKey(ENCRYPTION_KEY, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([salt, iv, tag, encrypted]);

    return combined.toString('base64');
  }

  public static async decrypt(encryptedText: string): Promise<string> {
    const combined = Buffer.from(encryptedText, 'base64');

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = await this.deriveKey(ENCRYPTION_KEY, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }

  public static async encryptObject<T extends Record<string, unknown>>(obj: T): Promise<string> {
    return this.encrypt(JSON.stringify(obj));
  }

  public static async decryptObject<T extends Record<string, unknown>>(
    encryptedText: string
  ): Promise<T> {
    const decrypted = await this.decrypt(encryptedText);
    return JSON.parse(decrypted);
  }
}
