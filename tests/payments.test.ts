import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  Operation,
  StrKey,
} from "@stellar/stellar-sdk";

// Mock the Horizon client before importing the module under test, so no
// test ever touches the network.
const { mockCall, mockSubmit, mockTxCall, mockPaymentsBuilder } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mockSubmit: vi.fn(),
  mockTxCall: vi.fn(),
  mockPaymentsBuilder: {} as Record<string, unknown>,
}));
Object.assign(mockPaymentsBuilder, {
  forAccount: vi.fn(() => mockPaymentsBuilder),
  limit: vi.fn(() => mockPaymentsBuilder),
  order: vi.fn(() => mockPaymentsBuilder),
  cursor: vi.fn(() => mockPaymentsBuilder),
  call: mockCall,
});

vi.mock("../lib/stellar/client", () => ({
  horizon: {
    payments: () => mockPaymentsBuilder,
    submitTransaction: mockSubmit,
    transactions: () => ({
      transaction: (hash: string) => ({ call: () => mockTxCall(hash) }),
    }),
  },
  withTimeout: (promise: Promise<unknown>) => promise,
  MIN_REFRESH_INTERVAL_MS: 10_000,
  HORIZON_TIMEOUT_MS: 15_000,
}));

import {
  buildSendTransaction,
  describeSubmitError,
  estimateFeeXlm,
  fetchHistoryPage,
  submitSignedTransaction,
} from "../lib/stellar/payments";

const SOURCE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32));
const DEST = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const ISSUER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));

describe("buildSendTransaction", () => {
  it("builds a valid native payment transaction", () => {
    const tx = buildSendTransaction({
      source: SOURCE,
      sequence: "5",
      destination: DEST,
      assetCode: "native",
      amount: "25.5",
    });

    expect(tx).toBeInstanceOf(Transaction);
    expect(tx.networkPassphrase).toBe(Networks.TESTNET);
    expect(tx.sequence.toString()).toBe("6");
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("payment");
    const op = tx.operations[0] as Extract<
      (typeof tx.operations)[0],
      { type: "payment" }
    >;
    // The SDK canonicalizes amounts to 7 decimal places.
    expect(op.amount).toBe("25.5000000");
    expect(op.destination).toBe(DEST);
  });

  it("builds an issued-asset payment and attaches a text memo", () => {
    const tx = buildSendTransaction({
      source: SOURCE,
      sequence: "1",
      destination: DEST,
      assetCode: "USDC",
      assetIssuer: ISSUER,
      amount: "1.25",
      memo: "rent",
    });
    const op = tx.operations[0] as Extract<
      (typeof tx.operations)[0],
      { type: "payment"; asset: { code?: string; issuer?: string } }
    >;
    expect(op.asset.code).toBe("USDC");
    expect(op.asset.issuer).toBe(ISSUER);
    // stellar-sdk's Memo keeps its fields as _type/_value internally.
    const memo = tx.memo as unknown as { _type: string; _value: string };
    expect(memo._type).toBe("text");
    expect(memo._value).toBe("rent");
  });

  it("rejects an invalid destination address", () => {
    expect(() =>
      buildSendTransaction({
        source: SOURCE,
        sequence: "1",
        destination: "not-an-address",
        assetCode: "native",
        amount: "1",
      })
    ).toThrow(/valid Stellar account/);
  });

  it("rejects zero, negative, and 8-decimal amounts", () => {
    const base = {
      source: SOURCE,
      sequence: "1",
      destination: DEST,
      assetCode: "native",
    };
    expect(() => buildSendTransaction({ ...base, amount: "0" })).toThrow(
      /positive number/
    );
    expect(() => buildSendTransaction({ ...base, amount: "-1" })).toThrow(
      /positive number/
    );
    expect(() => buildSendTransaction({ ...base, amount: "1.12345678" })).toThrow(
      /positive number/
    );
  });

  it("rejects an amount above the spendable balance", () => {
    expect(() =>
      buildSendTransaction({
        source: SOURCE,
        sequence: "1",
        destination: DEST,
        assetCode: "native",
        amount: "10",
        spendable: "9.9999999",
      })
    ).toThrow(/spendable balance/);
  });

  it("rejects a memo over 28 bytes", () => {
    expect(() =>
      buildSendTransaction({
        source: SOURCE,
        sequence: "1",
        destination: DEST,
        assetCode: "native",
        amount: "1",
        memo: "x".repeat(29),
      })
    ).toThrow(/Memo/);
  });
});

describe("estimateFeeXlm", () => {
  it("multiplies base fee by operation count", () => {
    expect(estimateFeeXlm(1, 100n)).toBe("0.0000100");
    expect(estimateFeeXlm(3, 100n)).toBe("0.0000300");
  });
});

describe("submitSignedTransaction (mocked Horizon)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits a signed transaction and returns the hash", async () => {
    const keypair = Keypair.random();
    const account = new Account(
      StrKey.encodeEd25519PublicKey(keypair.rawPublicKey()),
      "1"
    );
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    mockSubmit.mockResolvedValue({ hash: "ABC123" });

    const hash = await submitSignedTransaction(tx.toXDR());
    expect(hash).toBe("ABC123");
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("turns a no-trustline rejection into a readable error", async () => {
    mockSubmit.mockRejectedValue({
      message: "Transaction failed",
      extras: { result_codes: { operations: ["op_no_trust_line"] } },
    });

    // Build any valid signed tx so submission is actually attempted.
    const keypair = Keypair.random();
    const account = new Account(
      StrKey.encodeEd25519PublicKey(keypair.rawPublicKey()),
      "2"
    );
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();
    tx.sign(keypair);
    await expect(submitSignedTransaction(tx.toXDR())).rejects.toThrow(
      /does not have a trustline/
    );
  });
});

describe("describeSubmitError", () => {
  it("explains a missing trustline on the destination", () => {
    expect(
      describeSubmitError({
        extras: { result_codes: { operations: ["op_no_trust_line"] } },
      })
    ).toMatch(/recipient does not have a trustline/);
  });

  it("explains an unfunded destination", () => {
    expect(
      describeSubmitError({
        extras: { result_codes: { operations: ["op_account_not_found"] } },
      })
    ).toMatch(/does not exist yet/);
  });

  it("falls back to a generic message", () => {
    expect(describeSubmitError({ message: "timeout" })).toMatch(/timeout/);
    expect(describeSubmitError(null)).toMatch(/could not be submitted/);
  });
});

describe("fetchHistoryPage (mocked Horizon)", () => {
  const pageFixture = {
    records: [
      {
        id: "1",
        paging_token: "1",
        type_contains: "payment",
        transaction_hash: "HASH1",
        transaction_successful: true,
        created_at: "2026-01-01T00:00:00Z",
        from: SOURCE,
        to: DEST,
        asset_type: "native",
        amount: "10.0000000",
      },
      {
        id: "2",
        paging_token: "2",
        type_contains: "payment",
        transaction_hash: "HASH2",
        transaction_successful: false,
        created_at: "2026-01-02T00:00:00Z",
        from: DEST,
        to: SOURCE,
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        amount: "5.0000000",
      },
      {
        id: "3",
        paging_token: "3",
        type_contains: "manage_data",
        transaction_hash: "HASH3",
        transaction_successful: true,
        created_at: "2026-01-03T00:00:00Z",
      },
    ],
    _links: {
      next: {
        href: "https://horizon-testnet.stellar.org/accounts/.../payments?cursor=abc123&order=desc",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Memos come from the transactions endpoint, keyed by tx hash:
    // HASH1 carries "hi"; everything else reports "none" (no memo).
    mockTxCall.mockImplementation(async (hash: unknown) =>
      hash === "HASH1" ? { memo: "hi" } : { memo: "none" }
    );
  });

  it("maps sent and received payments and skips non-payment ops", async () => {
    mockCall.mockResolvedValue(pageFixture);

    const page = await fetchHistoryPage(SOURCE);

    expect(page.entries).toHaveLength(2);
    const [sent, received] = page.entries;
    expect(sent.direction).toBe("sent");
    expect(sent.counterparty).toBe(DEST);
    expect(sent.memo).toBe("hi");
    expect(sent.assetCode).toBe("native");
    expect(received.direction).toBe("received");
    expect(received.counterparty).toBe(DEST);
    expect(received.assetCode).toBe("USDC");
    expect(received.successful).toBe(false);
    expect(received.memo).toBeUndefined();
  });

  it("extracts the cursor for the next page", async () => {
    mockCall.mockResolvedValue(pageFixture);
    const page = await fetchHistoryPage(SOURCE);
    expect(page.nextCursor).toBe("abc123");
  });

  it("passes a cursor through when loading older pages", async () => {
    mockCall.mockResolvedValue({ records: [], _links: {} });
    const page = await fetchHistoryPage(SOURCE, "cur-999");
    expect(mockPaymentsBuilder.cursor).toHaveBeenCalledWith("cur-999");
    expect(page.nextCursor).toBeNull();
  });
});
