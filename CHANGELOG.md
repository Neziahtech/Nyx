# Changelog

All notable changes to Nyx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Upgraded vitest to 3.2.7** (from 2.1.9). Config and APIs needed no
  changes; the suite (86 tests), lint, typecheck, and the production build
  all pass on it, and CI's Node 20 stays supported. This clears the old
  Vitest-UI / Vite / tinypool advisories; the freshly reviewed advisory
  table is in docs/security.md. ESLint stays on 8.57.1: `eslint-config-next`
  for Next 14 does not accept ESLint 9, so the ESLint/Next majors move
  together.

## [0.2.0] - 2026-10-23

## [0.2.0] - 2026-10-23

Self-custody: Nyx now creates and holds its own keys, so no browser
extension is needed. Everything else — balances, sends, receive,
trustlines, history, the network config — keeps working unchanged.

### Added

- **`lib/wallet/`** — the only code that touches key material:
  `keystore.ts` generates or imports a keypair and encrypts the secret
  key with Web Crypto (AES-256-GCM, PBKDF2-SHA256 with 600,000
  iterations, fresh 16-byte salt and 12-byte IV per encryption);
  `storage.ts` persists only that encrypted blob in `localStorage`;
  `session.ts` keeps the decrypted key in memory alone, auto-locks after
  5 minutes of inactivity and when the tab closes, and signs built
  transactions re-parsed against the configured network passphrase.
- **`/create` screen**: generate a new wallet or import an existing
  secret key, with the keypair shown once and a mandatory backup tick
  before a password of at least 12 characters (strength meter)
  encrypts it.
- **`/unlock` screen**: wrong passwords get one generic message — no
  hint oracle. Protected routes redirect to `/unlock` (wallet stored,
  locked) or `/create` (none).
- **Local signing flow**: send reviews destination/asset/amount/fee,
  unlocks on demand, and signs with the in-memory key only after
  explicit confirmation. Header gains **Lock** and **Log out**; logging
  out deletes the encrypted wallet behind a backup warning.
- **Strict Content Security Policy** (`next.config.mjs`): `connect-src`
  is limited to Horizon/Friendbot hosts, `object-src`/`frame-*` are
  closed; the secret key is never logged, never in a URL, never sent to
  any server, and never written to storage in plain text.
- Unit tests for keystore round-trips, wrong-password and tampered-
  ciphertext handling, no plaintext in the stored blob, and session
  lock/auto-lock/signature behavior (86 tests total).

### Changed

- **Removed Freighter.** `@stellar/freighter-api`, the connect prompt,
  and the Freighter bridge (`lib/stellar/wallet.ts`) are gone; signing
  goes through `lib/wallet/session.ts` instead.

Until `lib/wallet/` has had a professional security review, Nyx is for
testnet use only — see [docs/security.md](docs/security.md).

## [0.1.0] - 2026-10-23

Initial open-source release: the Nyx foundation — a non-custodial Stellar
wallet for testnet, ready to grow into bill payments and fiat off-ramping.

### Added

- **Wallet connection** via the Freighter browser extension, with install
  guidance, network mismatch detection, and automatic re-read when the user
  switches accounts or networks in Freighter.
- **Balances dashboard** for XLM and issued assets, including the minimum
  reserve breakdown (1 XLM base + 0.5 XLM per trustline) and an empty state
  with a Friendbot funding link for unfunded testnet accounts.
- **Send** for XLM and trusted custom assets: address, amount, and memo
  validation, spendable-balance checks, a review step with an estimated
  network fee, Freighter signing, and a result screen with an explorer link.
  Missing-trustline rejections get a specific, actionable error.
- **Receive** screen with the public key, copy button, and a QR code in the
  brand rose color, plus a "Stellar assets only" warning.
- **Trustlines**: add a trustline by asset code and issuer, list existing
  trustlines, and remove ones with a zero balance.
- **Transaction history** with direction, asset, amount, counterparty, date,
  memo, and status; cursor-based pagination; per-row explorer links.
- **One-file network config** (`lib/stellar/config.ts`) driven by
  `NEXT_PUBLIC_STELLAR_NETWORK`; switching to mainnet is a deploy setting.
- **Environment validation** at startup with plain-language failure messages.
- Unit tests (Vitest) for validation, transaction building, history parsing,
  and environment handling, with Horizon mocked.
- Quality tooling: ESLint (`next/core-web-vitals`), Prettier, Husky +
  lint-staged pre-commit checks, GitHub Actions CI, and Dependabot. The
  CI `npm audit` step is advisory-only until pending major upgrades
  (Next 15, Vitest 3) land via Dependabot; the review of each advisory is
  in docs/security.md.
- Contributor-facing docs: architecture, security/threat model, manual
  testnet testing checklist, roadmap, and a scoped issue backlog for
  outside contributors.

[unreleased]: https://github.com/Neziahtech/Nyx/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Neziahtech/Nyx/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Neziahtech/Nyx/releases/tag/v0.1.0
