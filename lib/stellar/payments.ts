import {
  Account,
  Asset,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import { horizon, withTimeout } from "./client";
import { stellarConfig } from "./config";
import {
  isAmountWithinBalance,
  isValidAddress,
  isValidAmount,
  isValidMemo,
  MAX_MEMO_BYTES,
} from "./validation";

/**
 * Building send transactions and reading payment history.
 *
 * Nyx never signs here: builders return an unsigned transaction whose XDR
 * is signed by the unlocked session in `lib/wallet/`, and the signed result
 * is submitted to Horizon.
 */

export interface SendParams {
  /** Public key of the connected (sending) account. */
  source: string;
  /** Sequence number of the source account, as loaded from Horizon. */
  sequence: string;
  /** Destination account address. */
  destination: string;
  /** Asset code, or "native" for XLM. */
  assetCode: string;
  /** Issuer address; ignored for XLM. */
  assetIssuer?: string;
  /** Amount as a decimal string (max 7 places). */
  amount: string;
  /** Optional text memo, max 28 bytes. */
  memo?: string;
  /** Spendable balance for the chosen asset (total minus reserves). */
  spendable?: string;
  /** Network base fee in stroops (defaults to the protocol base fee). */
  baseFee?: string;
}

/** Resolve an asset code/issuer pair into an SDK Asset ("native" = XLM). */
export function parseAsset(assetCode: string, assetIssuer?: string): Asset {
  if (assetCode === "native") return Asset.native();
  if (!assetIssuer) {
    throw new Error(`Asset ${assetCode} is missing an issuer.`);
  }
  return new Asset(assetCode.trim(), assetIssuer.trim());
}

/**
 * Build an unsigned payment transaction.
 *
 * @throws {Error} If the source is not a valid address, the destination is
 *   invalid, the amount fails validation (including exceeding the spendable
 *   balance when supplied), or the memo is too long.
 */
export function buildSendTransaction(params: SendParams): Transaction {
  if (!isValidAddress(params.source)) {
    throw new Error("The connected account address is not valid.");
  }
  if (!isValidAddress(params.destination)) {
    throw new Error("Destination address is not a valid Stellar account.");
  }
  if (!isValidAmount(params.amount)) {
    throw new Error("Amount must be a positive number with at most 7 decimal places.");
  }
  if (params.memo && !isValidMemo(params.memo)) {
    throw new Error(`Memo must be at most ${MAX_MEMO_BYTES} bytes.`);
  }
  if (params.spendable !== undefined) {
    if (!isAmountWithinBalance(params.amount, params.spendable)) {
      throw new Error("Amount exceeds your spendable balance (balance minus reserves).");
    }
  }

  const sourceAccount = new Account(params.source, params.sequence);
  const builder = new TransactionBuilder(sourceAccount, {
    fee: params.baseFee ?? BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase,
  }).addOperation(
    Operation.payment({
      destination: params.destination.trim(),
      asset: parseAsset(params.assetCode, params.assetIssuer),
      amount: params.amount.trim(),
    })
  );

  if (params.memo) {
    builder.addMemo(Memo.text(params.memo));
  }

  return builder
    .setTimeout(30) // seconds until this transaction expires if unsigned
    .build();
}

/** Estimated network fee, in XLM, for an n-operation transaction. */
export function estimateFeeXlm(operations: number, baseFeeStroops: bigint): string {
  const stroops = baseFeeStroops * BigInt(operations);
  return (Number(stroops) / 10_000_000).toFixed(7);
}

/**
 * Fetch the network's current base fee (stroops) so the UI can show an
 * honest fee estimate before confirmation.
 */
export async function fetchBaseFee(): Promise<bigint> {
  const feeStats = await withTimeout(horizon.feeStats());
  return BigInt(feeStats.last_ledger_base_fee ?? BASE_FEE);
}

/**
 * Submit a transaction XDR that has already been signed to Horizon.
 *
 * @param signedXdr Transaction XDR already signed by the user's wallet.
 * @returns The transaction hash on success.
 * @throws {Error} A readable message on failure (see describeSubmitError).
 */
export async function submitSignedTransaction(signedXdr: string): Promise<string> {
  const tx = new Transaction(signedXdr, stellarConfig.networkPassphrase);
  try {
    const result = await withTimeout(horizon.submitTransaction(tx));
    return result.hash;
  } catch (error) {
    throw new Error(describeSubmitError(error));
  }
}

/**
 * Turn a Horizon submission error into a plain-language message.
 *
 * Handles the common cases: missing trustline on the destination, account
 * not funded, and network/timeout failures.
 */
export function describeSubmitError(error: unknown): string {
  const err = error as {
    message?: string;
    extras?: { result_codes?: { operations?: string[] } };
  };
  const ops = err?.extras?.result_codes?.operations ?? [];

  if (ops.includes("op_no_trust_line")) {
    return "The recipient does not have a trustline for this asset. Ask them to add a trustline for it first, then send again.";
  }
  if (ops.includes("op_account_not_found")) {
    return "The destination account does not exist yet. It must be funded (at least 1 XLM) before it can receive assets.";
  }
  if (ops.includes("op_line_not_authorized") || ops.includes("op_no_trust")) {
    return "The asset issuer has not authorized this transfer for the recipient.";
  }
  if (ops.includes("op_underfunded")) {
    return "The account does not have enough of this asset after reserves.";
  }
  return err?.message
    ? `The network rejected the transaction: ${err.message}`
    : "The transaction could not be submitted. Check your connection and try again.";
}

/** A normalized history row for display. */
export interface HistoryEntry {
  id: string;
  hash: string;
  direction: "sent" | "received";
  assetCode: string;
  assetIssuer?: string;
  amount: string;
  counterparty: string;
  createdAt: string;
  memo?: string;
  successful: boolean;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  /** Cursor for the next (older) page; null when there is nothing more. */
  nextCursor: string | null;
}

/** On-wire shape of a payment operation record (subset Nyx displays). */
interface PaymentLike {
  id: string;
  type_contains?: string;
  transaction_hash: string;
  transaction_successful: boolean;
  created_at: string;
  from: string;
  to: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
}

/**
 * Fetch one page of payment operations for `address`, newest first, and
 * enrich each row with its transaction memo (best effort).
 *
 * @param cursor Horizon cursor from a previous page; omit for the newest.
 * @throws {Error} If the Horizon request fails or times out.
 */
export async function fetchHistoryPage(
  address: string,
  cursor?: string
): Promise<HistoryPage> {
  let call = horizon.payments().forAccount(address).limit(20).order("desc");
  if (cursor) call = call.cursor(cursor);

  const page = await withTimeout(call.call());

  const records = (page.records as unknown as PaymentLike[]).filter(
    (p) => p.type_contains === "payment" && p.from && p.to
  );

  // Memos live on the parent transaction: fetch unique hashes in parallel,
  // skipping failures so a bad memo lookup can't blank the whole list.
  const hashes = [...new Set(records.map((r) => r.transaction_hash))];
  const memoByHash = new Map<string, string>();
  await Promise.all(
    hashes.map(async (hash) => {
      try {
        const txRecord = await withTimeout(
          horizon.transactions().transaction(hash).call()
        );
        if (txRecord.memo && txRecord.memo !== "none") {
          memoByHash.set(hash, txRecord.memo);
        }
      } catch {
        // best-effort enrichment
      }
    })
  );

  const entries: HistoryEntry[] = records.map((p) => {
    const direction = p.from === address ? "sent" : "received";
    const counterparty = p.from === address ? p.to : p.from;
    return {
      id: p.id,
      hash: p.transaction_hash,
      direction,
      assetCode: p.asset_type === "native" ? "native" : (p.asset_code ?? "?"),
      assetIssuer: p.asset_issuer,
      amount: p.amount ?? "0",
      counterparty,
      createdAt: p.created_at,
      memo: memoByHash.get(p.transaction_hash),
      successful: p.transaction_successful,
    };
  });

  const nextLink: string | undefined = (
    page as unknown as {
      _links?: { next?: { href?: string } };
    }
  )?._links?.next?.href;
  const cursorMatch = nextLink?.match(/cursor=([^&]+)/);

  return {
    entries,
    nextCursor: cursorMatch ? decodeURIComponent(cursorMatch[1]) : null,
  };
}
