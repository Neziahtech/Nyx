import { StrKey } from "@stellar/stellar-sdk";

/**
 * Input validation for every user-supplied value in Nyx. The UI calls these,
 * and the transaction builders call them again before touching the network —
 * validation must never live only in components.
 */

/** Maximum memo length in bytes, per the Stellar protocol. */
export const MAX_MEMO_BYTES = 28;

/** Maximum number of digits after the decimal point for Stroop-denominated assets. */
export const MAX_AMOUNT_DECIMALS = 7;

/**
 * Check a Stellar account address (unmuxed G-address).
 *
 * @returns true if `address` is a valid ed25519 public key strkey.
 */
export function isValidAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed.startsWith("G") || trimmed.length !== 56) return false;
  try {
    return StrKey.isValidEd25519PublicKey(trimmed);
  } catch {
    return false;
  }
}

/**
 * Check an asset code: 1-12 alphanumeric characters (the Stellar limit).
 */
export function isValidAssetCode(code: string): boolean {
  return /^[A-Za-z0-9]{1,12}$/.test(code.trim());
}

/**
 * Check an asset issuer: must be a valid account address. An empty string
 * is explicitly invalid.
 */
export function isValidIssuer(issuer: string): boolean {
  return issuer.trim() !== "" && isValidAddress(issuer);
}

/**
 * Check memo text: at most 28 UTF-8 bytes. An empty memo is allowed
 * (callers omit the memo in that case).
 *
 * @throws never; returns false for invalid input.
 */
export function isValidMemo(memo: string): boolean {
  const byteLength = new TextEncoder().encode(memo).length;
  return byteLength <= MAX_MEMO_BYTES;
}

/** Format check only: positive decimal with at most 7 decimal places. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/;

/**
 * Check that `amount` is a syntactically valid, strictly positive Stellar
 * amount (at most 7 decimal places). Does not consider balances.
 */
export function isValidAmount(amount: string): boolean {
  const trimmed = amount.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return false;
  // Pattern rejects negatives; exact compare rejects 0 and 0.000.
  return compareAmounts(trimmed, "0") > 0;
}

/**
 * Check that `amount` is valid and does not exceed `spendable` (the balance
 * left after reserves). Comparisons are exact (integer-scaled), not floating
 * point.
 */
export function isAmountWithinBalance(amount: string, spendable: string): boolean {
  if (!isValidAmount(amount)) return false;
  return compareAmounts(amount.trim(), spendable) <= 0;
}

/**
 * Compare two decimal amount strings exactly.
 *
 * @returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareAmounts(a: string, b: string): number {
  const scale = (value: string): bigint => {
    const [whole, frac = ""] = value.split(".");
    const padded = (frac + "0".repeat(MAX_AMOUNT_DECIMALS)).slice(0, MAX_AMOUNT_DECIMALS);
    return (
      BigInt(whole || "0") * 10n ** BigInt(MAX_AMOUNT_DECIMALS) + BigInt(padded || "0")
    );
  };
  const left = scale(a);
  const right = scale(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Subtract two decimal amount strings exactly: returns `a - b` as a string
 * with at most 7 decimals, floored at zero.
 */
export function subtractAmounts(a: string, b: string): string {
  const stroops = toStroops(a) - toStroops(b);
  return stroopsToAmount(stroops > 0n ? stroops : 0n);
}

/** Convert a decimal amount string to stroops (1 XLM = 10,000,000 stroops). */
export function toStroops(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const padded = (frac + "0".repeat(7)).slice(0, 7);
  return BigInt(whole || "0") * 10_000_000n + BigInt(padded || "0");
}

/** Convert stroops back to a trimmed decimal amount string. */
export function stroopsToAmount(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
