import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, Networks, StrKey, Transaction } from "@stellar/stellar-sdk";

import { buildSendTransaction } from "../lib/stellar/payments";
import {
  INACTIVITY_TIMEOUT_MS,
  WalletLockedError,
  getPublicKey,
  isUnlocked,
  lockSession,
  signTransactionXdr,
  subscribeSession,
  touchSession,
  unlockSession,
} from "../lib/wallet/session";
import { InvalidSecretKeyError } from "../lib/wallet/keystore";

const SOURCE_KEYS = Keypair.random();
const DEST = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));

/** Build an unsigned XDR for the source account, as the send flow would. */
function unsignedXdr(): string {
  return buildSendTransaction({
    source: SOURCE_KEYS.publicKey(),
    sequence: "5",
    destination: DEST,
    assetCode: "native",
    amount: "10",
  }).toXDR();
}

describe("unlockSession / lockSession", () => {
  afterEach(() => {
    lockSession();
    vi.useRealTimers();
  });

  it("holds the key while unlocked and reports the public address", () => {
    expect(isUnlocked()).toBe(false);
    unlockSession(SOURCE_KEYS.secret());
    expect(isUnlocked()).toBe(true);
    expect(getPublicKey()).toBe(SOURCE_KEYS.publicKey());
  });

  it("rejects a malformed secret key", () => {
    expect(() => unlockSession("not-a-secret")).toThrow(InvalidSecretKeyError);
    expect(isUnlocked()).toBe(false);
  });

  it("clears the key on lock", () => {
    unlockSession(SOURCE_KEYS.secret());
    lockSession();
    expect(isUnlocked()).toBe(false);
    expect(getPublicKey()).toBeNull();
  });

  it("is safe to lock when already locked", () => {
    expect(() => lockSession()).not.toThrow();
  });

  it("can be unlocked again after locking", () => {
    unlockSession(SOURCE_KEYS.secret());
    lockSession();
    unlockSession(SOURCE_KEYS.secret());
    expect(isUnlocked()).toBe(true);
    expect(getPublicKey()).toBe(SOURCE_KEYS.publicKey());
  });
});

describe("inactivity auto-lock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    lockSession();
    vi.useRealTimers();
  });

  it("locks after five minutes without activity", () => {
    unlockSession(SOURCE_KEYS.secret());
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
    expect(isUnlocked()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isUnlocked()).toBe(false);
    expect(getPublicKey()).toBeNull();
  });

  it("postpones the lock when activity refreshes the session", () => {
    unlockSession(SOURCE_KEYS.secret());
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 60_000);
    touchSession();
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
    expect(isUnlocked()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isUnlocked()).toBe(false);
  });

  it("touch is a no-op while locked", () => {
    unlockSession(SOURCE_KEYS.secret());
    lockSession();
    expect(() => touchSession()).not.toThrow();
    expect(isUnlocked()).toBe(false);
  });
});

describe("subscribeSession", () => {
  afterEach(() => {
    lockSession();
    vi.useRealTimers();
  });

  it("notifies on unlock and on lock", () => {
    const calls: boolean[] = [];
    const stop = subscribeSession(() => calls.push(isUnlocked()));
    unlockSession(SOURCE_KEYS.secret());
    lockSession();
    expect(calls).toEqual([true, false]);
    stop();
    unlockSession(SOURCE_KEYS.secret());
    expect(calls).toEqual([true, false]);
  });

  it("notifies when the inactivity timer locks the session", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const stop = subscribeSession(listener);
    unlockSession(SOURCE_KEYS.secret());
    listener.mockClear(); // ignore the unlock notification
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isUnlocked()).toBe(false);
    stop();
  });

  it("keeps locking even when a listener throws", () => {
    const stop = subscribeSession(() => {
      throw new Error("bad listener");
    });
    unlockSession(SOURCE_KEYS.secret());
    expect(() => lockSession()).not.toThrow();
    expect(isUnlocked()).toBe(false);
    stop();
  });
});

describe("signTransactionXdr", () => {
  afterEach(() => {
    lockSession();
    vi.useRealTimers();
  });

  it("throws a lock error when the wallet is not unlocked", () => {
    expect(() => signTransactionXdr(unsignedXdr())).toThrow(WalletLockedError);
  });

  it("signs with the in-memory key and returns a verifiable transaction", () => {
    unlockSession(SOURCE_KEYS.secret());
    const signed = signTransactionXdr(unsignedXdr());
    const tx = new Transaction(signed, Networks.TESTNET);
    expect(tx.signatures.length).toBe(1);
    const signature = tx.signatures[0]!.signature();
    expect(SOURCE_KEYS.verify(tx.hash(), signature)).toBe(true);
  });

  it("produces a signature another key cannot verify", () => {
    unlockSession(SOURCE_KEYS.secret());
    const signed = signTransactionXdr(unsignedXdr());
    const tx = new Transaction(signed, Networks.TESTNET);
    const signature = tx.signatures[0]!.signature();
    const other = Keypair.random();
    expect(other.verify(tx.hash(), signature)).toBe(false);
  });
});
