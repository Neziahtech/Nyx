import { StrKey } from "@stellar/stellar-sdk";

import { KEYSTORE_VERSION, type EncryptedKeystore } from "./keystore";

/**
 * Persistence for the encrypted wallet blob.
 *
 * The blob is the *only* thing this app stores about the wallet. The
 * plaintext secret key must never be written here — this module only ever
 * sees the {@link EncryptedKeystore} produced by `keystore.ts`.
 */

/** localStorage key holding the encrypted wallet blob. */
export const KEYSTORE_STORAGE_KEY = "nyx.keystore.v1";

/** Thrown when a stored blob exists but is not readable wallet data. */
export class KeystoreCorruptedError extends Error {
  constructor() {
    super("The stored wallet data is damaged. Restore from your secret key.");
    this.name = "KeystoreCorruptedError";
  }
}

/** Thrown when the browser has no usable localStorage. */
export class StorageUnavailableError extends Error {
  constructor() {
    super("This browser cannot store wallet data. Enable site storage and retry.");
    this.name = "StorageUnavailableError";
  }
}

/** Runtime shape check for parsed blobs, so corrupted data fails early. */
function isKeystoreShape(value: unknown): value is EncryptedKeystore {
  if (typeof value !== "object" || value === null) return false;
  const k = value as Record<string, unknown>;
  if (
    k.version !== KEYSTORE_VERSION ||
    k.kdf !== "PBKDF2-SHA256" ||
    k.cipher !== "AES-GCM" ||
    typeof k.iterations !== "number" ||
    !Number.isInteger(k.iterations) ||
    k.iterations <= 0 ||
    typeof k.salt !== "string" ||
    k.salt.length === 0 ||
    typeof k.iv !== "string" ||
    k.iv.length === 0 ||
    typeof k.ciphertext !== "string" ||
    k.ciphertext.length === 0 ||
    typeof k.publicKey !== "string" ||
    !k.publicKey.startsWith("G")
  ) {
    return false;
  }
  try {
    return StrKey.isValidEd25519PublicKey(k.publicKey);
  } catch {
    // Malformed base32 can surface as a decode error rather than a clean false.
    return false;
  }
}

/** Access localStorage or throw a friendly error if unavailable (private mode, SSR). */
function storage(): Storage {
  if (typeof localStorage === "undefined") throw new StorageUnavailableError();
  return localStorage;
}

/**
 * Persist the encrypted blob, replacing any wallet already stored.
 *
 * @throws {StorageUnavailableError} If localStorage is not available.
 */
export function saveKeystore(keystore: EncryptedKeystore): void {
  if (!isKeystoreShape(keystore)) throw new KeystoreCorruptedError();
  storage().setItem(KEYSTORE_STORAGE_KEY, JSON.stringify(keystore));
}

/**
 * Read the stored blob.
 *
 * @returns The encrypted keystore, or `null` when no wallet is stored.
 * @throws {KeystoreCorruptedError} If a value exists but is not valid wallet data.
 */
export function loadKeystore(): EncryptedKeystore | null {
  const raw = storage().getItem(KEYSTORE_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isKeystoreShape(parsed)) throw new KeystoreCorruptedError();
    return parsed;
  } catch (e) {
    if (e instanceof KeystoreCorruptedError) throw e;
    throw new KeystoreCorruptedError();
  }
}

/** Whether any wallet (locked or unlocked) is stored for this origin. */
export function hasKeystore(): boolean {
  return storage().getItem(KEYSTORE_STORAGE_KEY) !== null;
}

/**
 * Delete the stored blob. Used by the "Log out" flow after the user has
 * confirmed they hold a backup — without one, the wallet is unrecoverable.
 */
export function deleteKeystore(): void {
  storage().removeItem(KEYSTORE_STORAGE_KEY);
}
