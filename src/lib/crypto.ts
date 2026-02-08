import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// Auth tag is usually 16 bytes for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is not set in production');
    }
    // Fallback for development if not provided, but we already added it to .env
    return Buffer.alloc(KEY_LENGTH, 'dev-key-placeholder-must-be-32-bytes');
  }
  
  try {
    const buffer = Buffer.from(key, 'hex');
    if (buffer.length !== KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex characters)`);
    }
    return buffer;
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string');
  }
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: iv:authTag:encryptedPayload
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the above encrypt function.
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encryptedText] = parts;
  
  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(authTagHex!, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText!, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypts an object by converting it to JSON first.
 */
export function encryptJSON(obj: any): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts a string into an object.
 */
export function decryptJSON<T>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted);
}
