# Changelog

All notable changes to Nyx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/nyx-wallet/nyx/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nyx-wallet/nyx/releases/tag/v0.1.0
