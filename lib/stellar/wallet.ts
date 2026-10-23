import {
  requestAccess,
  isConnected,
  getNetworkDetails,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

import { stellarConfig } from "./config";
import { isValidAddress } from "./validation";

/**
 * Freighter wallet integration.
 *
 * Nyx never holds secret keys. The user's keys live in the Freighter
 * browser extension; the app only asks Freighter to return the public
 * address and to sign fully-built, unsigned transactions.
 */

/** Thrown when the user cancels signing in the Freighter popup. */
export class UserRejectedError extends Error {
  constructor() {
    super("Signing was cancelled in Freighter.");
    this.name = "UserRejectedError";
  }
}

/** Thrown when Freighter is not installed or not reachable. */
export class FreighterUnavailableError extends Error {
  constructor() {
    super(
      "Freighter was not found in this browser. Install the Freighter " +
        "extension to connect a wallet."
    );
    this.name = "FreighterUnavailableError";
  }
}

/**
 * Quick synchronous check for the extension's injected `window.stellar`
 * object. Used to decide whether to show install guidance.
 */
export function isFreighterInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { stellar?: unknown }).stellar !== "undefined"
  );
}

/**
 * Ask Freighter for access and return the connected public key.
 *
 * @throws {FreighterUnavailableError} If the extension is missing.
 * @throws {UserRejectedError} If the user declines the connection prompt.
 * @throws {Error} With Freighter's message on any other failure.
 */
export async function connectWallet(): Promise<string> {
  if (!isFreighterInstalled()) throw new FreighterUnavailableError();

  const { address, error } = await requestAccess();
  if (error || !address) {
    if (/reject|cancel|denied|allow/i.test(error?.message ?? "")) {
      throw new UserRejectedError();
    }
    throw new Error(error?.message ?? "Freighter did not return an account.");
  }
  if (!isValidAddress(address)) {
    throw new Error("Freighter returned an unexpected account address.");
  }
  return address;
}

/**
 * Check whether a previous connection is still authorized (used on page
 * load to restore the session). Returns the address, or null if not
 * connected.
 */
export async function restoreConnection(): Promise<string | null> {
  if (!isFreighterInstalled()) return null;
  const { isConnected: connected, error: connError } = await isConnected();
  if (connError || !connected) return null;
  const { address, error } = await requestAccess();
  if (error || !address || !isValidAddress(address)) return null;
  return address;
}

/**
 * Verify Freighter's active network matches the network Nyx is configured
 * for. Called on connect, before signing, and by the change watcher.
 *
 * @throws {Error} With guidance to switch Freighter's network on mismatch.
 */
export async function ensureCorrectNetwork(): Promise<void> {
  const details = await getNetworkDetails();
  if (details.error) {
    throw new Error(
      details.error.message ?? "Could not read Freighter's network settings."
    );
  }
  if (details.networkPassphrase !== stellarConfig.networkPassphrase) {
    throw new Error(
      `Freighter is on ${details.network}, but Nyx is configured for ` +
        `"${stellarConfig.name}". Switch networks in Freighter and retry.`
    );
  }
}

/**
 * Hand an unsigned transaction's XDR to Freighter and get back the signed
 * XDR ready for submission.
 *
 * @param transactionXdr Unsigned transaction, built by lib/stellar/* builders.
 * @returns The signed transaction XDR.
 * @throws {UserRejectedError} If the user rejects the signature request.
 * @throws {Error} With Freighter's message on any other failure.
 */
export async function signWithWallet(transactionXdr: string): Promise<string> {
  const { signedTxXdr, error } = await signTransaction(transactionXdr, {
    networkPassphrase: stellarConfig.networkPassphrase,
  });
  if (error || !signedTxXdr) {
    if (/reject|cancel|denied/i.test(error?.message ?? "")) {
      throw new UserRejectedError();
    }
    throw new Error(error?.message ?? "Freighter did not sign the transaction.");
  }
  return signedTxXdr;
}

/**
 * Start watching for the user switching accounts or networks inside
 * Freighter. The callback receives the new address/passphrase whenever a
 * change is detected; Nyx uses it to re-read the account. Polling honors
 * the app's minimum-interval rule (10s).
 *
 * @returns A cleanup function that stops the watcher.
 */
export function watchWalletChanges(
  onChange: (info: { address: string; networkPassphrase: string }) => void
): () => void {
  const watcher = new WatchWalletChanges(10_000);
  const result = watcher.watch((params) => {
    if (!params.error && params.address && params.networkPassphrase) {
      onChange({
        address: params.address,
        networkPassphrase: params.networkPassphrase,
      });
    }
  });
  if (result?.error) {
    // Watching is best-effort; the UI still offers a manual refresh.
    console.error("Freighter change watcher unavailable:", result.error.message);
  }
  return () => watcher.stop();
}
