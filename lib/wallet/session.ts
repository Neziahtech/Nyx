import { Keypair, Transaction } from "@stellar/stellar-sdk";

import { stellarConfig } from "../stellar/config";
import { InvalidSecretKeyError, isValidSecretKey } from "./keystore";

/**
 * The unlocked-session holder.
 *
 * After the password is verified, the decrypted keypair lives here — in
 * module memory only. It is not written to any store, and it is destroyed on
 * {@link lockSession}, on the 5-minute inactivity timeout, and when the tab
 * closes (memory simply goes away; a `beforeunload` hook clears it eagerly
 * too). Only this module and `keystore.ts` may touch key material.
 */

/** Auto-lock after this much inactivity while unlocked. */
export const INACTIVITY_TIMEOUT_MS = 5 * 60_000;

/** Thrown when a signing request arrives while the wallet is locked. */
export class WalletLockedError extends Error {
  constructor() {
    super("The wallet is locked. Enter your password to continue.");
    this.name = "WalletLockedError";
  }
}

let keypair: Keypair | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let watchersAttached = false;

/** Listener fired whenever the locked/unlocked state changes. */
export type SessionListener = () => void;

const listeners = new Set<SessionListener>();

/**
 * Subscribe to lock/unlock transitions (including the inactivity auto-lock).
 *
 * @returns A function that removes the subscription.
 */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      // A faulty listener must not break locking or other subscribers.
      console.error(e);
    }
  }
}

/** Whether the decrypted key is currently held in memory. */
export function isUnlocked(): boolean {
  return keypair !== null;
}

/** The wallet's G-address while unlocked, or `null` when locked. Not secret. */
export function getPublicKey(): string | null {
  return keypair ? keypair.publicKey() : null;
}

/**
 * Take ownership of a decrypted secret key for this session.
 *
 * @param secretKey A valid Stellar secret key, just decrypted by the caller.
 * @throws {InvalidSecretKeyError} If the key is malformed.
 */
export function unlockSession(secretKey: string): void {
  if (!isValidSecretKey(secretKey)) throw new InvalidSecretKeyError();
  keypair = Keypair.fromSecret(secretKey);
  touchSession();
  notify();
}

/**
 * Destroy the in-memory key and stop the inactivity timer. Safe to call when
 * already locked.
 */
export function lockSession(): void {
  const wasUnlocked = keypair !== null;
  keypair = null;
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (wasUnlocked) notify();
}

/**
 * Restart the inactivity countdown. Called on unlock and on user activity
 * while unlocked; a no-op when locked (the key is already gone).
 */
export function touchSession(): void {
  if (keypair === null) return;
  if (inactivityTimer !== null) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    lockSession();
  }, INACTIVITY_TIMEOUT_MS);
}

/**
 * Sign an unsigned transaction XDR with the in-memory key and return the
 * signed XDR, ready for Horizon submission.
 *
 * @param xDR Output of `Transaction.toXDR()` built for this network.
 * @throws {WalletLockedError} If the session is locked (the UI should route
 *   the user to /unlock instead).
 */
export function signTransactionXdr(xDR: string): string {
  if (keypair === null) throw new WalletLockedError();
  const tx = new Transaction(xDR, stellarConfig.networkPassphrase);
  tx.sign(keypair);
  return tx.toXDR();
}

/** Events treated as user activity for the inactivity timer. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "visibilitychange"] as const;

function onActivity(): void {
  touchSession();
}

function onTabClosing(): void {
  lockSession();
}

/**
 * Attach the inactivity + tab-close watchers. Call once from the wallet
 * provider on mount; returns a cleanup function that detaches them and locks.
 *
 * SSR-safe: a no-op outside the browser.
 */
export function startSessionWatchers(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!watchersAttached) {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity);
    }
    window.addEventListener("beforeunload", onTabClosing);
    watchersAttached = true;
  }
  return () => {
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity);
    }
    window.removeEventListener("beforeunload", onTabClosing);
    watchersAttached = false;
    lockSession();
  };
}
