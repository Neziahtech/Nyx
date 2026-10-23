import {
  Account,
  Asset,
  Operation,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import { stellarConfig } from "./config";
import { isValidAddress, isValidAssetCode, isValidIssuer } from "./validation";

/**
 * Building trustline (change trust) transactions: adding a trustline for a
 * custom asset, and removing one (setting its limit to 0) when its balance
 * is zero.
 */

/** The limit that means "unlimited" in Stellar (int64 max). */
export const UNLIMITED_LIMIT = "9223372036854775807";

export interface TrustlineParams {
  /** Public key of the connected account. */
  source: string;
  /** Sequence number of the source account, as loaded from Horizon. */
  sequence: string;
  /** Asset code to trust, e.g. "USDC". */
  assetCode: string;
  /** Issuer address of the asset to trust. */
  assetIssuer: string;
  /** Network base fee in stroops. */
  baseFee?: string;
}

/**
 * Build an unsigned changeTrust transaction that adds a trustline with an
 * unlimited limit.
 *
 * @throws {Error} If the source, asset code, or issuer fails validation.
 */
export function buildAddTrustlineTransaction(params: TrustlineParams): Transaction {
  const { source, assetCode, assetIssuer } = params;
  if (!isValidAddress(source)) {
    throw new Error("The connected account address is not valid.");
  }
  if (!isValidAssetCode(assetCode)) {
    throw new Error("Asset code must be 1-12 alphanumeric characters.");
  }
  if (!isValidIssuer(assetIssuer)) {
    throw new Error("Issuer must be a valid Stellar account address (G...).");
  }

  return new TransactionBuilder(new Account(source, params.sequence), {
    fee: params.baseFee ?? BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(assetCode.trim(), assetIssuer.trim()),
        limit: UNLIMITED_LIMIT,
      })
    )
    .setTimeout(30)
    .build();
}

/**
 * Build an unsigned changeTrust transaction that removes a trustline by
 * setting its limit to 0.
 *
 * @throws {Error} If validation fails, or if `balance` is not zero (Stellar
 *   rejects removing a trustline that still holds the asset).
 */
export function buildRemoveTrustlineTransaction(
  params: TrustlineParams & { balance: string }
): Transaction {
  if (!isValidAssetCode(params.assetCode) || !isValidIssuer(params.assetIssuer)) {
    throw new Error("Asset code and issuer must be valid.");
  }
  if (params.balance !== "0" && Number(params.balance) !== 0) {
    throw new Error(
      "You can only remove a trustline when its balance is zero. Send or swap the remaining balance first."
    );
  }
  return new TransactionBuilder(new Account(params.source, params.sequence), {
    fee: params.baseFee ?? BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(params.assetCode.trim(), params.assetIssuer.trim()),
        limit: "0",
      })
    )
    .setTimeout(30)
    .build();
}
