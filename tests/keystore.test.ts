import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import {
  DEFAULT_ITERATIONS,
  IV_BYTES,
  InvalidPasswordError,
  InvalidSecretKeyError,
  KEYSTORE_VERSION,
  MIN_PASSWORD_LENGTH,
  SALT_BYTES,
  WalletPasswordError,
  decryptSecretKey,
  encryptSecretKey,
  fromBase64,
  generateKeyPair,
  isValidSecretKey,
  isValidWalletPassword,
  toBase64,
  type EncryptedKeystore,
} from "../lib/wallet/keystore";
import {
  KEYSTORE_STORAGE_KEY,
  KeystoreCorruptedError,
  deleteKeystore,
  hasKeystore,
  loadKeystore,
  saveKeystore,
} from "../lib/wallet/storage";

// Low iteration count keeps the suite fast; the iteration count is stored in
// the blob, so this exercises the same code path production uses.
const FAST = { iterations: 1_000 };
const PASSWORD = "correct horse battery staple";

const { publicKey, secretKey } = generateKeyPair();

describe("generateKeyPair", () => {
  it("returns a matching, well-formed keypair", () => {
    expect(isValidSecretKey(secretKey)).toBe(true);
    expect(secretKey.startsWith("S")).toBe(true);
    expect(publicKey.startsWith("G")).toBe(true);
    expect(Keypair.fromSecret(secretKey).publicKey()).toBe(publicKey);
  });

  it("produces a different key each call", () => {
    expect(generateKeyPair().secretKey).not.toBe(secretKey);
  });
});

describe("isValidSecretKey", () => {
  it("accepts a genuine secret key", () => {
    expect(isValidSecretKey(secretKey)).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["a public key", publicKey],
    ["a truncated secret", secretKey.slice(0, 30)],
    ["an invalid character", `S${"1".repeat(30)}!=`],
    ["a tampered checksum", `${secretKey.slice(0, 34)}A`],
    ["non-string value", "S"],
  ])("rejects %s", (_label, value) => {
    expect(isValidSecretKey(value)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidSecretKey(undefined)).toBe(false);
    expect(isValidSecretKey(123)).toBe(false);
  });
});

describe("isValidWalletPassword", () => {
  it("requires the minimum length", () => {
    expect(isValidWalletPassword("x".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidWalletPassword("x".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });
});

describe("encryptSecretKey / decryptSecretKey", () => {
  it("uses a production-grade default iteration count", () => {
    expect(DEFAULT_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("round-trips the secret key through password-based encryption", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    await expect(decryptSecretKey(keystore, PASSWORD)).resolves.toBe(secretKey);
  });

  it("records salt, iv, iterations, and schema in the blob", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    expect(keystore.version).toBe(KEYSTORE_VERSION);
    expect(keystore.kdf).toBe("PBKDF2-SHA256");
    expect(keystore.cipher).toBe("AES-GCM");
    expect(keystore.iterations).toBe(FAST.iterations);
    expect(fromBase64(keystore.salt)).toHaveLength(SALT_BYTES);
    expect(fromBase64(keystore.iv)).toHaveLength(IV_BYTES);
    expect(keystore.publicKey).toBe(publicKey);
  });

  it("uses a fresh random salt and IV per encryption", async () => {
    const a = await encryptSecretKey(secretKey, PASSWORD, FAST);
    const b = await encryptSecretKey(secretKey, PASSWORD, FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects a wrong password", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    await expect(
      decryptSecretKey(keystore, "wrong password here!!")
    ).rejects.toBeInstanceOf(WalletPasswordError);
  });

  it("surfaces one generic message for wrong passwords and tampering alike", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    const tampered = { ...keystore, ciphertext: flipLastBit(keystore.ciphertext) };
    await expect(decryptSecretKey(keystore, "definitely wrong")).rejects.toThrow(
      "Could not unlock this wallet with that password."
    );
    await expect(decryptSecretKey(tampered, PASSWORD)).rejects.toThrow(
      "Could not unlock this wallet with that password."
    );
  });

  it("rejects tampered ciphertext", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    const tampered: EncryptedKeystore = {
      ...keystore,
      ciphertext: flipLastBit(keystore.ciphertext),
    };
    await expect(decryptSecretKey(tampered, PASSWORD)).rejects.toBeInstanceOf(
      WalletPasswordError
    );
  });

  it("rejects a tampered salt or IV", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    await expect(
      decryptSecretKey({ ...keystore, salt: flipLastBit(keystore.salt) }, PASSWORD)
    ).rejects.toBeInstanceOf(WalletPasswordError);
    await expect(
      decryptSecretKey({ ...keystore, iv: flipLastBit(keystore.iv) }, PASSWORD)
    ).rejects.toBeInstanceOf(WalletPasswordError);
  });

  it("never places the plaintext secret in the stored blob", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    const serialized = JSON.stringify(keystore);
    expect(serialized).not.toContain(secretKey);
    expect(serialized).not.toContain(PASSWORD);
    expect(keystore.ciphertext).not.toBe(secretKey);
    // The public key is expected to be present; the secret must not be.
    expect(serialized).toContain(publicKey);
  });

  it("rejects malformed secret keys and weak passwords", async () => {
    await expect(encryptSecretKey(publicKey, PASSWORD, FAST)).rejects.toBeInstanceOf(
      InvalidSecretKeyError
    );
    await expect(encryptSecretKey("", PASSWORD, FAST)).rejects.toBeInstanceOf(
      InvalidSecretKeyError
    );
    await expect(encryptSecretKey(secretKey, "short", FAST)).rejects.toBeInstanceOf(
      InvalidPasswordError
    );
  });

  it("rejects a blob whose version is unknown", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    await expect(
      decryptSecretKey({ ...keystore, version: 99 }, PASSWORD)
    ).rejects.toBeInstanceOf(WalletPasswordError);
  });
});

describe("storage", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  afterEach(() => {
    uninstallFakeLocalStorage();
  });

  it("round-trips the encrypted blob and reports presence", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    expect(hasKeystore()).toBe(false);
    saveKeystore(keystore);
    expect(hasKeystore()).toBe(true);
    expect(loadKeystore()).toEqual(keystore);
    deleteKeystore();
    expect(hasKeystore()).toBe(false);
    expect(loadKeystore()).toBeNull();
  });

  it("stores only the blob under a single key", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    saveKeystore(keystore);
    const stored = rawStored(KEYSTORE_STORAGE_KEY) ?? "";
    expect(stored).toContain("ciphertext");
    expect(stored).not.toContain(secretKey);
  });

  it("refuses to save a malformed blob", () => {
    expect(() => saveKeystore({ ...brokenKeystore(), publicKey: "not-G" })).toThrow(
      KeystoreCorruptedError
    );
  });

  it("throws a friendly error when stored data is not valid wallet JSON", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    saveKeystore(keystore);
    setRaw(KEYSTORE_STORAGE_KEY, "{not json");
    expect(() => loadKeystore()).toThrow(KeystoreCorruptedError);
    setRaw(KEYSTORE_STORAGE_KEY, JSON.stringify({ hello: "world" }));
    expect(() => loadKeystore()).toThrow(KeystoreCorruptedError);
  });

  it("refuses to load a blob with a malformed public key", async () => {
    const keystore = await encryptSecretKey(secretKey, PASSWORD, FAST);
    setRaw(KEYSTORE_STORAGE_KEY, JSON.stringify({ ...keystore, publicKey: "Ginvalid" }));
    expect(() => loadKeystore()).toThrow(KeystoreCorruptedError);
    expect(() => saveKeystore({ ...keystore, publicKey: "Ginvalid" })).toThrow(
      KeystoreCorruptedError
    );
  });
});

/**
 * A minimal Storage replacement for the node test environment.
 * (The project deliberately avoids a jsdom dependency.)
 */
function installFakeLocalStorage(): void {
  const map = new Map<string, string>();
  const fake = {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: fake,
    configurable: true,
    writable: true,
  });
}

function uninstallFakeLocalStorage(): void {
  Reflect.deleteProperty(globalThis, "localStorage");
}

function rawStored(key: string): string | null {
  return localStorage.getItem(key);
}

function setRaw(key: string, value: string): void {
  localStorage.setItem(key, value);
}

/** Flip the final data bit of a base64 string, guaranteeing a different payload. */
function flipLastBit(base64: string): string {
  const bytes = fromBase64(base64);
  bytes[bytes.length - 1] ^= 0x01;
  return toBase64(bytes);
}

function brokenKeystore(): EncryptedKeystore {
  return {
    version: KEYSTORE_VERSION,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-GCM",
    iterations: 1_000,
    salt: "c2FsdA==",
    iv: "aXZpdmk=",
    ciphertext: "ZGF0YQ==",
    publicKey,
  };
}
