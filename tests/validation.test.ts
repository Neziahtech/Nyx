import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";

import {
  compareAmounts,
  isAmountWithinBalance,
  isValidAddress,
  isValidAmount,
  isValidAssetCode,
  isValidIssuer,
  isValidMemo,
  subtractAmounts,
  toStroops,
  stroopsToAmount,
} from "../lib/stellar/validation";

// A real, checksum-valid ed25519 public key strkey.
const VALID_ADDRESS = StrKey.encodeEd25519PublicKey(Buffer.alloc(32));
// Flip the last character so the base32 checksum no longer matches.
const CORRUPT_ADDRESS =
  VALID_ADDRESS.slice(0, -1) + (VALID_ADDRESS.slice(-1) === "A" ? "B" : "A");

describe("isValidAddress", () => {
  it("accepts a valid G-address", () => {
    expect(isValidAddress(VALID_ADDRESS)).toBe(true);
    expect(isValidAddress(`  ${VALID_ADDRESS}  `)).toBe(true);
  });

  it("rejects an invalid G-address: wrong prefix", () => {
    expect(isValidAddress(`X${VALID_ADDRESS.slice(1)}`)).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidAddress(VALID_ADDRESS.slice(0, 55))).toBe(false);
    expect(isValidAddress(`${VALID_ADDRESS}G`)).toBe(false);
  });

  it("rejects a corrupted checksum", () => {
    expect(isValidAddress(CORRUPT_ADDRESS)).toBe(false);
  });

  it("rejects empty and non-base32 strings", () => {
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress("G".repeat(56))).toBe(false); // not valid base32/checksum
    expect(isValidAddress("hello world")).toBe(false);
  });
});

describe("isValidAmount", () => {
  it("accepts ordinary amounts", () => {
    expect(isValidAmount("1")).toBe(true);
    expect(isValidAmount("0.5")).toBe(true);
    expect(isValidAmount("123456.7890123")).toBe(true);
  });

  it("accepts exactly 7 decimal places and rejects 8", () => {
    expect(isValidAmount("0.1234567")).toBe(true);
    expect(isValidAmount("0.12345678")).toBe(false);
  });

  it("rejects zero", () => {
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("0.0000000")).toBe(false);
  });

  it("rejects negative values", () => {
    expect(isValidAmount("-1")).toBe(false);
    expect(isValidAmount("-0.5")).toBe(false);
  });

  it("rejects junk", () => {
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("1e5")).toBe(false);
    expect(isValidAmount(".5")).toBe(false);
    expect(isValidAmount("1.")).toBe(false);
  });
});

describe("isAmountWithinBalance", () => {
  it("allows an amount equal to the spendable balance", () => {
    expect(isAmountWithinBalance("10", "10")).toBe(true);
  });

  it("rejects an amount above the spendable balance", () => {
    expect(isAmountWithinBalance("10.0000001", "10")).toBe(false);
  });

  it("rejects an invalid amount regardless of balance", () => {
    expect(isAmountWithinBalance("0", "100")).toBe(false);
    expect(isAmountWithinBalance("-5", "100")).toBe(false);
  });
});

describe("isValidMemo", () => {
  it("accepts up to 28 bytes", () => {
    expect(isValidMemo("")).toBe(true);
    expect(isValidMemo("a".repeat(28))).toBe(true);
  });

  it("rejects a memo over 28 bytes", () => {
    expect(isValidMemo("a".repeat(29))).toBe(false);
  });

  it("counts UTF-8 bytes, not characters", () => {
    // 7 four-byte emoji = 28 bytes: fits. 8 = 32 bytes: too long.
    expect(isValidMemo("🌑".repeat(7))).toBe(true);
    expect(isValidMemo("🌑".repeat(8))).toBe(false);
  });
});

describe("isValidAssetCode", () => {
  it("accepts 1-12 alphanumeric characters", () => {
    expect(isValidAssetCode("USDC")).toBe(true);
    expect(isValidAssetCode("A")).toBe(true);
    expect(isValidAssetCode("ABCDEFGHIJKL")).toBe(true);
    expect(isValidAssetCode("abc123")).toBe(true);
  });

  it("rejects empty, too long, or non-alphanumeric codes", () => {
    expect(isValidAssetCode("")).toBe(false);
    expect(isValidAssetCode("ABCDEFGHIJKLM")).toBe(false);
    expect(isValidAssetCode("USD-1")).toBe(false);
    expect(isValidAssetCode("USD_")).toBe(false);
  });
});

describe("isValidIssuer", () => {
  it("accepts a valid account address", () => {
    expect(isValidIssuer(VALID_ADDRESS)).toBe(true);
  });

  it("rejects an empty issuer", () => {
    expect(isValidIssuer("")).toBe(false);
    expect(isValidIssuer("   ")).toBe(false);
  });

  it("rejects a malformed issuer", () => {
    expect(isValidIssuer("not-an-address")).toBe(false);
  });
});

describe("exact decimal helpers", () => {
  it("compareAmounts compares as integers under the hood", () => {
    expect(compareAmounts("1", "1.0000000")).toBe(0);
    expect(compareAmounts("0.9999999", "1")).toBe(-1);
    expect(compareAmounts("1000000", "999999.9999999")).toBe(1);
  });

  it("subtractAmounts floors at zero and stays exact", () => {
    expect(subtractAmounts("10", "0.5")).toBe("9.5");
    expect(subtractAmounts("1", "9")).toBe("0");
    expect(subtractAmounts("1.0000000", "1")).toBe("0");
  });

  it("round-trips stroops", () => {
    expect(toStroops("12.3456789")).toBe(123_456_789n);
    expect(stroopsToAmount(123_456_789n)).toBe("12.3456789");
    expect(stroopsToAmount(10_000_000n)).toBe("1");
    expect(stroopsToAmount(0n)).toBe("0");
  });
});
