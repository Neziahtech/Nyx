import { describe, expect, it } from "vitest";

import { EnvValidationError, SUPPORTED_NETWORKS, validateEnv } from "../lib/env";

describe("validateEnv", () => {
  it("accepts the supported networks", () => {
    expect(validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "testnet" })).toEqual({
      network: "testnet",
    });
    expect(validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "mainnet" })).toEqual({
      network: "mainnet",
    });
  });

  it("is case- and whitespace-tolerant", () => {
    expect(validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: " TestNet " })).toEqual({
      network: "testnet",
    });
  });

  it("fails with a clear message when the value is missing", () => {
    expect(() => validateEnv({})).toThrow(EnvValidationError);
    expect(() => validateEnv({})).toThrow(
      /Missing environment variable NEXT_PUBLIC_STELLAR_NETWORK/
    );
  });

  it("fails when the value is empty or whitespace", () => {
    expect(() => validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "" })).toThrow(
      /Missing environment variable/
    );
    expect(() => validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "   " })).toThrow(
      /Missing environment variable/
    );
  });

  it("fails with a clear message for unknown networks", () => {
    expect(() => validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "devnet" })).toThrow(
      EnvValidationError
    );
    expect(() => validateEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "devnet" })).toThrow(
      /Supported networks: testnet, mainnet/
    );
  });

  it("lists the supported networks in the error", () => {
    expect(SUPPORTED_NETWORKS).toEqual(["testnet", "mainnet"]);
  });
});
