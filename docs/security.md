# Security

This is the developer-facing security document. The user/reporting-facing
version is [SECURITY.md](../SECURITY.md).

> Status: Nyx holds user keys (encrypted) and has **not** had a professional
> security review. It is testnet-only until one has happened.

## Key handling

- Nyx is **self-custody**: the keypair is generated in the user's browser
  (`Keypair.random()`) or imported from a secret key the user pastes, and is
  encrypted before it ever touches storage. All key material is confined to
  `lib/wallet/` — `keystore.ts` (crypto), `storage.ts` (encrypted blob only),
  `session.ts` (in-memory unlocked key), and `wallet.ts` (lifecycle). No
  other module accepts, stores, or transmits a secret key.
- **Encryption:** AES-256-GCM with a key derived from the user's password via
  PBKDF2-SHA256 at 600,000 iterations, a random 16-byte salt and random
  12-byte IV per encryption. The stored blob (`nyx.keystore.v1` in
  localStorage) contains version, KDF/cipher names, iteration count, salt,
  IV, ciphertext, and the public key (non-secret, so the unlock screen can
  identify the wallet). The plaintext key is never persisted anywhere, never
  logged, never placed in a URL, and never sent to any server — the app has
  no backend and Horizon never sees the key, only the signed transaction.
- **GCM authentication** means a wrong password and a tampered blob fail
  identically, and the UI deliberately shows one generic message; there is
  no oracle distinguishing "correct blob, wrong password" from "damaged
  data".
- **Session:** after unlock, the keypair lives only in a module variable. It
  is cleared on **Lock**, by the 5-minute inactivity auto-lock, on tab close
  (memory disappears; a `beforeunload` hook clears it eagerly), and on
  **Log out**, which additionally deletes the stored blob.
- **One-time exposure by design:** the create screen displays the secret key
  exactly once for backup, held only in component state, and requires an
  explicit "I've saved my secret key" confirmation before the password step.
- No secret keys, passphrases, or tokens belong in `.env` — the only
  required variable (`NEXT_PUBLIC_STELLAR_NETWORK`) is public and inlined
  at build time.

## Trust model

| Component                  | Trust assumption                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The user's device          | Trusted for OS/browser integrity. A compromised device (keylogger, malicious extension, XSS) can capture the password or an unlocked session               |
| The user's password        | The sole secret protecting the stored key; there is no recovery path other than the secret key backup                                                      |
| Horizon (SDF public nodes) | Trusted for reads; transaction outcomes are verifiable via explorer links                                                                                  |
| Network passphrase         | Bound at build time in `config.ts`; `signTransactionXdr` parses the XDR under that passphrase, so a transaction built for another network cannot be signed |
| Assets the user trusts     | The user chooses; UI surfaces the issuer address for every non-native asset so a fake asset with a copied code is visible                                  |

## Threat review

**1. Transaction tampering between build and sign.**
The unsigned XDR is opaque and complete: operations, destination, amount,
memo, sequence, fee, and time bounds are all fixed before signing. Nyx shows
those same values on the review screen and signs only after the user
confirms. The 30-second timeout (`setTimeout(30)`) bounds replay of a stale
build.

**2. Wrong-network signing.** The transaction is parsed from XDR against
`stellarConfig.networkPassphrase` inside `signTransactionXdr` before the key
signs it, so a blob built for another network fails there rather than being
signed.

**3. Stolen stored blob.** The localStorage blob is AES-GCM-encrypted with a
PBKDF2-hardened password; offline cracking requires 600,000 SHA-256
derivations per guess. Weak passwords remain the practical risk — the UI
requires ≥12 characters and shows a strength meter. A leaked blob plus a
weak password is equivalent to a leaked key.

**4. Live-session abuse.** While unlocked, any script running in the page or
anyone at the screen can sign. Mitigations: the short inactivity lock,
signing only behind an explicit confirmation step, and CSP (see **7**).
Locking eagerly on tab close bounds drive-by timing.

**5. Overspend / float rounding.** Amount checks use exact integer
(stroop-scale `BigInt`) comparisons in `validation.ts`; spendable balance
is `total − reserve`, never the raw balance.

**6. Memo smuggling.** Memos are validated to ≤28 UTF-8 bytes both in the
UI and again inside `buildSendTransaction`.

**7. XSS.** Next.js escapes rendered content; no `dangerouslySetInnerHTML`
anywhere. A strict Content-Security-Policy ships in production
(`next.config.mjs`): `default-src 'self'`, no remote or eval scripts, no
frames, no foreign form targets, and `connect-src` limited to same-origin
plus the Horizon/Friendbot hosts. XSS remains the main theoretical path to
session abuse and is the highest-priority item for external review.

**8. Supply chain.** Exact-pinned dependencies, lockfile committed,
`npm audit --audit-level=high` in CI, Dependabot weekly PRs.

## If the user's device is compromised

Advise users (and remember when testing):

1. **From another clean device**, create a fresh wallet and send all assets
   to it immediately — assume the exposed password or unlocked session can
   move funds at any time.
2. Treat the old secret key as burned even after a password change; the
   password only protects the stored blob, it does not rotate the key.
3. Do not log out on the compromised device first if that would hide
   activity; recovering funds takes priority.
4. After moving funds, use **Log out** (which deletes the blob) only on
   devices you control.

## Logging discipline

User-facing errors are plain language. Raw errors are logged with
`console.error` only (ESLint enforces `no-console` with an `error`
exception). No key material ever exists in logs by design: `lib/wallet/`
never logs secrets, and screens scrub the plaintext key and password from
component state as soon as encryption completes.

## Out of scope for this phase

- Server-side components (there are none).
- KYC/anchor interactions — planned for phase 3 (`lib/anchors/` is a stub).
- Soroban smart-contract flows and claimable balances.
- Automation of mainnet operations; Nyx defaults to testnet.
- Hardware-signer and multisetup support; the encrypted blob is the only
  key-protection primitive.

## Reviewed advisories (2026-10-23)

`npm audit` currently reports advisories that cannot be fixed without majors
beyond the approved dependency set. Each was reviewed rather than ignored:

| Advisory (pkg)                                                                 | Severity      | Assessment                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Image Optimizer DoS via `remotePatterns` (`next` 14.2.35)                      | critical      | Not applicable — Nyx uses no `next/image` remote patterns and configures no `remotePatterns`; fixed upstream when Next 15 lands via Dependabot |
| `toml` prototype pollution / recursion (transitive via `@stellar/stellar-sdk`) | high          | Not applicable on used paths — Nyx never calls federation/stellar.toml parsing; only Horizon reads and tx submission                           |
| Vitest UI server / Vite dev-server / tinypool / glob CLI issues                | high–critical | Dev-only; Vitest UI is never started in CI or by users; upgrade to vitest 3 tracked by Dependabot                                              |
| PostCSS stringify XSS                                                          | high          | Dev-only build dependency; no untrusted CSS is processed                                                                                       |

CI runs `npm audit --audit-level=high` as a **non-blocking advisory** step
until the Dependabot majors are merged, per the decision recorded in
CHANGELOG. The gate should be re-locked after each upgrade lands.

## Open considerations (good contributions)

- A transaction preview hash so users can cross-check what they sign.
- Address-book / memo protection against look-alike strkeys.
- A professional review of `lib/wallet/` before any mainnet use.
- Optional WebAuthn/passkey wrapping of the keystore password.
