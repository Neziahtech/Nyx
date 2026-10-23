import { Keypair, StrKey } from "@stellar/stellar-sdk";

/**
 * Self-contained key management for Nyx.
 *
 * This module is the only place in the app that may touch secret key
 * material. A Stellar secret key is encrypted with AES-256-GCM using a key
 * derived from the user's password via PBKDF2-SHA256 (600,000 iterations by
 * default, per OWASP guidance). The salt, IV, iteration count, and ciphertext
 * are stored together as one JSON blob; the plaintext key is never persisted.
 */

/** Production PBKDF2 iteration count. Must stay >= 600,000. */
export const DEFAULT_ITERATIONS = 600_000;

/** Minimum accepted password length, enforced here as well as in the UI. */
export const MIN_PASSWORD_LENGTH = 12;

/** PBKDF2 salt length in bytes. */
export const SALT_BYTES = 16;

/** AES-GCM IV length in bytes. */
export const IV_BYTES = 12;

/** Schema tag identifying the current keystore format. */
export const KEYSTORE_VERSION = 1;

/**
 * The encrypted wallet blob. Everything here is safe to persist: the
 * ciphertext is only recoverable with the user's password. `publicKey` is
 * stored in the clear so the unlock screen can identify the wallet.
 */
export interface EncryptedKeystore {
  /** Schema version of the blob format. */
  version: number;
  /** Key derivation function used, informational only. */
  kdf: "PBKDF2-SHA256";
  /** Cipher used, informational only. */
  cipher: "AES-GCM";
  /** PBKDF2 iteration count that was used for this blob. */
  iterations: number;
  /** Base64 of the random 16-byte PBKDF2 salt. */
  salt: string;
  /** Base64 of the random 12-byte AES-GCM IV. */
  iv: string;
  /** Base64 of the AES-GCM ciphertext (includes the 16-byte auth tag). */
  ciphertext: string;
  /** The account's G-address. Not secret. */
  publicKey: string;
}

/** Thrown when decryption fails for any reason (wrong password or tampered data). */
export class WalletPasswordError extends Error {
  constructor() {
    super("Could not unlock this wallet with that password.");
    this.name = "WalletPasswordError";
  }
}

/** Thrown when a value is not a valid Stellar secret key. */
export class InvalidSecretKeyError extends Error {
  constructor() {
    super("That is not a valid Stellar secret key.");
    this.name = "InvalidSecretKeyError";
  }
}

/** Thrown when a password does not meet the minimum strength requirement. */
export class InvalidPasswordError extends Error {
  constructor() {
    super(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    this.name = "InvalidPasswordError";
  }
}

/** Options for {@link encryptSecretKey}. Tests lower the iteration count for speed. */
export interface EncryptOptions {
  /** PBKDF2 iterations. Defaults to {@link DEFAULT_ITERATIONS}. */
  iterations?: number;
}

/**
 * Create a brand-new random Stellar keypair.
 *
 * The returned `secretKey` is plaintext and must be shown to the user only
 * once (for backup) and otherwise immediately handed to
 * {@link encryptSecretKey}. Never log it or store it unencrypted.
 *
 * @returns The derived G-address and the S-encoded secret key.
 */
export function generateKeyPair(): { publicKey: string; secretKey: string } {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/**
 * Check whether a string is a properly formatted Stellar secret key
 * ("S..." base32, correct length and checksum).
 *
 * @param value Candidate value, may be any runtime type.
 */
export function isValidSecretKey(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("S")) return false;
  try {
    return StrKey.isValidEd25519SecretSeed(value);
  } catch {
    // Malformed base32 can surface as a decode error rather than a clean false.
    return false;
  }
}

/**
 * Basic password policy check used by both the UI and {@link encryptSecretKey}.
 *
 * @param password Candidate password.
 */
export function isValidWalletPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/** Derive the AES-256-GCM key for a password + salt at a given iteration count. */
async function deriveAesKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encode bytes as base64 without depending on Node Buffer (browser-safe). */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode a base64 string produced by {@link toBase64}. Throws on bad input. */
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encrypt a secret key with a password and return the storable blob.
 *
 * A fresh random salt and IV are generated per call, so encrypting the same
 * key twice produces different blobs.
 *
 * @param secretKey A valid Stellar secret key.
 * @param password The user's password, at least {@link MIN_PASSWORD_LENGTH} characters.
 * @param options Optional iteration override (tests only).
 * @throws {InvalidSecretKeyError} If the secret key is malformed.
 * @throws {InvalidPasswordError} If the password is too short.
 */
export async function encryptSecretKey(
  secretKey: string,
  password: string,
  options: EncryptOptions = {}
): Promise<EncryptedKeystore> {
  if (!isValidSecretKey(secretKey)) throw new InvalidSecretKeyError();
  if (!isValidWalletPassword(password)) throw new InvalidPasswordError();

  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(password, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secretKey)
  );

  return {
    version: KEYSTORE_VERSION,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-GCM",
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    publicKey: Keypair.fromSecret(secretKey).publicKey(),
  };
}

/**
 * Decrypt a stored blob back into the plaintext secret key.
 *
 * @param keystore The encrypted blob.
 * @param password The user's password.
 * @throws {WalletPasswordError} If the password is wrong or the blob was tampered with.
 *   The message is deliberately generic: AES-GCM cannot tell the two apart,
 *   and a distinct message would leak that the blob exists-but-is-undamaged.
 */
export async function decryptSecretKey(
  keystore: EncryptedKeystore,
  password: string
): Promise<string> {
  if (keystore.version !== KEYSTORE_VERSION) throw new WalletPasswordError();
  try {
    const key = await deriveAesKey(
      password,
      fromBase64(keystore.salt),
      keystore.iterations
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(keystore.iv) },
      key,
      fromBase64(keystore.ciphertext)
    );
    const secretKey = new TextDecoder().decode(plaintext);
    if (!isValidSecretKey(secretKey)) throw new WalletPasswordError();
    return secretKey;
  } catch (e) {
    if (e instanceof WalletPasswordError) throw e;
    // Any crypto failure (OperationError, bad base64, ...) is indistinguishable
    // and must surface as the same generic error.
    throw new WalletPasswordError();
  }
}
