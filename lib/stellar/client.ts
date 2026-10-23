import { Horizon } from "@stellar/stellar-sdk";

import { stellarConfig } from "./config";

/**
 * A single Horizon server instance for the configured network, plus the
 * request policy every Horizon call must use: an explicit timeout so a
 * slow network can never leave the UI hanging.
 */

/** Timeout applied to every Horizon request, in milliseconds. */
export const HORIZON_TIMEOUT_MS = 15_000;

/** Minimum interval between automatic refreshes, per the app's polling rule. */
export const MIN_REFRESH_INTERVAL_MS = 10_000;

/** Shared Horizon `Server` instance (testnet or mainnet per config). */
export const horizon = new Horizon.Server(stellarConfig.horizonUrl, {
  allowHttp: false,
});

/** Error thrown when a Horizon request exceeds the app's timeout budget. */
export class HorizonTimeoutError extends Error {
  constructor() {
    super(
      `The Stellar network took too long to respond (over ${Math.round(
        HORIZON_TIMEOUT_MS / 1000
      )}s). Check your connection and try again.`
    );
    this.name = "HorizonTimeoutError";
  }
}

/**
 * Race any Horizon promise against the app-wide timeout. The underlying
 * request may finish in the background; the caller is guaranteed an answer
 * (data or error) within the budget, so no UI state can hang.
 *
 * @param promise The Horizon request promise.
 * @param ms Timeout budget; defaults to HORIZON_TIMEOUT_MS.
 * @throws {HorizonTimeoutError} When the budget elapses first.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = HORIZON_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new HorizonTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
