import crypto from 'crypto';
import { config } from '../config';

const KEY_BUFFER = Buffer.from(config.aes.key, 'utf8').subarray(0, 32); // AES-256
const ALGORITHM   = 'aes-256-gcm';
const IV_LENGTH   = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64url-encoded string: <IV>:<ciphertext>:<authTag>
 */
export function encrypt(plaintext: string): string {
  const iv         = crypto.randomBytes(IV_LENGTH);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join(':');
}

/**
 * Decrypts a base64url-encoded AES-256-GCM string.
 */
export function decrypt(encoded: string): string {
  const [ivB64, encB64, tagB64] = encoded.split(':');
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Invalid cipher format');
  const iv         = Buffer.from(ivB64,  'base64url');
  const encrypted  = Buffer.from(encB64, 'base64url');
  const authTag    = Buffer.from(tagB64, 'base64url');
  const decipher   = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Returns a SHA-256 hex digest of the input (for one-way hashing: NID, etc.)
 */
export function sha256Hash(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute HMAC-SHA256 signature.
 */
export function hmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
