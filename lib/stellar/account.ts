import { Horizon } from "@stellar/stellar-sdk";

import { horizon, withTimeout } from "./client";

/**
 * Loading accounts, balances, and reserve information from Horizon.
 */

/** The raw Horizon account record (what `.accounts().accountId().call()` returns). */
export type AccountRecord = Horizon.ServerApi.AccountRecord;

/** Thrown when the account does not exist on-chain yet. */
export class AccountNotFundedError extends Error {
  constructor(publicKey: string) {
    super(
      `This account (${publicKey.slice(0, 8)}…${publicKey.slice(-4)}) does not ` +
        "exist on the network yet. On testnet, fund it with Friendbot to get started."
    );
    this.name = "AccountNotFundedError";
  }
}

/**
 * Load an account from Horizon.
 *
 * @throws {AccountNotFundedError} If the account does not exist on this network.
 * @throws {Error} If the Horizon request fails or times out.
 */
export async function loadAccount(publicKey: string): Promise<AccountRecord> {
  try {
    return await withTimeout(horizon.accounts().accountId(publicKey).call());
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) throw new AccountNotFundedError(publicKey);
    throw new Error(
      "Could not reach the Stellar network. Check your connection and try again."
    );
  }
}

/** A display-ready balance row. */
export interface Balance {
  /** "native" for XLM, otherwise the asset code (e.g. "USDC"). */
  assetCode: string;
  /** Issuer address for issued assets; undefined for XLM. */
  assetIssuer?: string;
  /** Total balance held, as a decimal string. */
  total: string;
  /** Trustline limit, as a decimal string; undefined for XLM. */
  limit?: string;
}

/** Shape shared by the native and issued-asset members of Horizon's balance union. */
interface RawBalanceLine {
  asset_type: string;
  balance: string;
  limit?: string;
  asset_code?: string;
  asset_issuer?: string;
}

/**
 * Extract XLM and issued-asset balances from a loaded account.
 * Liquidity-pool share entries are skipped (Nyx does not trade pools yet).
 */
export function getBalances(account: AccountRecord): Balance[] {
  // The generated union types differ slightly across SDK versions; the
  // on-wire shape is stable, so we read it through the documented fields.
  const lines = account.balances as unknown as RawBalanceLine[];
  return lines
    .filter((b) => b.asset_type !== "liquidity_pool")
    .map((b) => {
      if (b.asset_type === "native") {
        return { assetCode: "native", total: b.balance };
      }
      return {
        assetCode: b.asset_code ?? "?",
        assetIssuer: b.asset_issuer,
        total: b.balance,
        limit: b.limit,
      };
    });
}

/**
 * Compute the XLM locked up in reserves.
 *
 * On the network Nyx targets, holding an account costs a 1 XLM base reserve
 * plus 0.5 XLM per sub-entry (trustline, offer, or signer), so spendable XLM
 * is lower than the total. The dashboard shows this so users understand the
 * difference.
 */
export interface ReserveInfo {
  /** Flat reserve for the account itself, in XLM. */
  baseReserveXlm: string;
  /** Reserve added per trustline/sub-entry, in XLM. */
  perEntryReserveXlm: string;
  /** Number of sub-entries (trustlines, offers, signers) on the account. */
  subentryCount: number;
  /** Total XLM locked in reserves, as a decimal string. */
  totalReserved: string;
}

/** Base account reserve, in XLM. */
export const BASE_RESERVE_XLM = 1;
/** Reserve per trustline/sub-entry, in XLM. */
export const PER_ENTRY_RESERVE_XLM = 0.5;

/**
 * Compute the account's reserved XLM: 1 XLM base + 0.5 XLM per sub-entry.
 * Pure function of the loaded account; cannot throw.
 */
export function getReserveInfo(account: AccountRecord): ReserveInfo {
  const subentryCount = Number(account.subentry_count ?? 0);
  const total = BASE_RESERVE_XLM + PER_ENTRY_RESERVE_XLM * subentryCount;
  return {
    baseReserveXlm: String(BASE_RESERVE_XLM),
    perEntryReserveXlm: String(PER_ENTRY_RESERVE_XLM),
    subentryCount,
    totalReserved: total.toFixed(7),
  };
}
