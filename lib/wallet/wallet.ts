import {
  InvalidSecretKeyError,
  decryptSecretKey,
  encryptSecretKey,
  generateKeyPair,
  isValidSecretKey,
} from "./keystore";
import { deleteKeystore, hasKeystore, loadKeystore, saveKeystore } from "./storage";
import { lockSession, unlockSession } from "./session";

/**
 * High-level wallet lifecycle used by the screens: create, import, unlock,
 * and log out. Part of `lib/wallet/`, so key material stays inside this
 * directory's modules. The plaintext secret key crosses into a screen only
 * once, by design: `createWallet` returns it so the UI can show it for
 * backup, and `finalizeWallet` accepts it back. The UI must not persist it
 * anywhere or log it.
 */

/** A freshly generated wallet, returned once for the user to back up. */
export interface CreatedWallet {
  /** The G-address other people send funds to. */
  publicKey: string;
  /** The plaintext S-key. Shown exactly once; never stored unencrypted. */
  secretKey: string;
}

/** Thrown when an unlock or sign is attempted with no wallet stored. */
export class KeystoreMissingError extends Error {
  constructor() {
    super("No wallet is stored in this browser yet.");
    this.name = "KeystoreMissingError";
  }
}

/**
 * Generate a new keypair without saving it, so the create screen can show
 * the secret key for backup before the user sets a password. Pair with
 * {@link finalizeWallet}.
 */
export function createWallet(): CreatedWallet {
  return generateKeyPair();
}

/**
 * Encrypt a secret key with the user's password, persist the blob, and open
 * an unlocked session. Used to finalize a new wallet and to import an
 * existing secret key. The PBKDF2 derivation takes roughly a second.
 *
 * @param secretKey A valid Stellar secret key.
 * @param password The user's chosen password (at least 12 characters).
 * @returns The wallet's G-address.
 * @throws {InvalidSecretKeyError} If the secret key is malformed.
 * @throws {InvalidPasswordError} If the password is too short.
 * @throws {StorageUnavailableError} If the browser cannot persist the blob.
 */
export async function finalizeWallet(
  secretKey: string,
  password: string
): Promise<string> {
  const keystore = await encryptSecretKey(secretKey, password);
  saveKeystore(keystore);
  unlockSession(secretKey);
  return keystore.publicKey;
}

/**
 * Unlock the stored wallet with the user's password, opening a session.
 *
 * @param password The user's password.
 * @returns The wallet's G-address once unlocked.
 * @throws {KeystoreMissingError} If no wallet is stored.
 * @throws {WalletPasswordError} On a wrong password or damaged blob.
 * @throws {KeystoreCorruptedError} If the stored data is not valid wallet JSON.
 */
export async function unlockWithPassword(password: string): Promise<string> {
  const keystore = loadKeystore();
  if (!keystore) throw new KeystoreMissingError();
  const secretKey = await decryptSecretKey(keystore, password);
  unlockSession(secretKey);
  return keystore.publicKey;
}

/**
 * The G-address of the stored wallet, or `null` when none exists. Lets the
 * unlock screen identify the wallet before any decryption happens.
 *
 * @throws {KeystoreCorruptedError} If stored data exists but is unreadable.
 */
export function storedPublicKey(): string | null {
  return loadKeystore()?.publicKey ?? null;
}

/** Whether this browser holds a wallet at all (locked or unlocked). */
export function walletStored(): boolean {
  return hasKeystore();
}

/**
 * Log out: erase the stored blob and destroy the session. Irreversible —
 * the UI must first confirm the user holds their secret key backup.
 */
export function logoutWallet(): void {
  deleteKeystore();
  lockSession();
}

/** Re-exported so screens can validate an imported key without touching keystore internals. */
export { isValidSecretKey, InvalidSecretKeyError };
