# Security

This is the developer-facing security document. The user/reporting-facing
version is [SECURITY.md](../SECURITY.md).

## Key handling

- Nyx is **non-custodial by construction**. No module in `lib/` or
  `components/` can accept, store, or transmit a secret key: signing is
  delegated to the Freighter extension through `lib/stellar/wallet.ts`,
  whose only signing entry point takes an **unsigned transaction XDR** and
  returns a **signed transaction XDR**.
- The app never uses `Keypair.fromSecret` or any seed derivation. (Grep the
  codebase for `fromSecret` — it appears nowhere in app code.)
- Session state holds only the public key, the Horizon `AccountResponse`,
  and built-but-unsigned transactions. None of it is written to
  localStorage or URLs.
- No secret keys, passphrases, or tokens belong in `.env` — the only
  required variable (`NEXT_PUBLIC_STELLAR_NETWORK`) is public and inlined
  at build time.

## Trust model

| Component                  | Trust assumption                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Freighter extension        | Trusted to hold keys and show honest signing prompts (Stellar's standard wallet UX)                                                |
| Horizon (SDF public nodes) | Trusted for reads; transaction outcomes are verifiable via explorer links                                                          |
| Network passphrase         | Bound at build time in `config.ts`; signing on a mismatched network is refused by `ensureCorrectNetwork()` before every submission |
| Assets the user trusts     | The user chooses; UI surfaces the issuer address for every non-native asset so a fake asset with a copied code is visible          |

## Threat review

**1. Transaction tampering between build and sign.**
The unsigned XDR is opaque and complete: operations, destination, amount,
memo, sequence, fee, and time bounds are all fixed before Freighter sees
it. Nyx shows the same values on the review screen that appear in the
operation. The 30-second timeout (`setTimeout(30)`) bounds replay of a
stale build.

**2. Wrong-network signing.** `ensureCorrectNetwork()` compares Freighter's
network passphrase against `stellarConfig` before connecting and before
every signature request; `signWithWallet()` additionally pins
`networkPassphrase` in the Freighter call options.

**3. Overspend / float rounding.** Amount checks use exact integer
(stroop-scale `BigInt`) comparisons in `validation.ts`; spendable balance
is `total − reserve`, never the raw balance.

**4. Memo smuggling.** Memos are validated to ≤28 UTF-8 bytes both in the
UI and again inside `buildSendTransaction`.

**5. Unfunded / no-trustline destinations.** Detected from Horizon result
codes (`describeSubmitError`) and explained specifically rather than shown
as a raw error.

**6. Slow or hostile network responses.** Every Horizon call has a 15s
timeout from `client.ts`. Polling is rate-limited to ≥10s intervals.

**7. XSS.** Next.js escapes rendered content; no `dangerouslySetInnerHTML`;
no user input is ever interpolated into URLs built for the explorer
(values go through `encodeURIComponent`-safe strkey validation first).

**8. Supply chain.** Exact-pinned dependencies, lockfile committed,
`npm audit --audit-level=high` in CI, Dependabot weekly PRs.

## Logging discipline

User-facing errors are plain language. Raw errors are logged with
`console.error` only (ESLint enforces `no-console` with an `error`
exception). No request bodies containing addresses are logged in
production paths; nothing secret exists to log by design.

## Out of scope for this phase

- Server-side components (there are none).
- KYC/anchor interactions — planned for phase 3 (`lib/anchors/` is a stub).
- Soroban smart-contract flows and claimable balances.
- Automation of mainnet operations; Nyx defaults to testnet.

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

- A transaction preview hash so users can cross-check Freighter's prompt.
- Address-book / memo protection against look-alike strkeys.
- Content-Security-Policy header review for the Freighter bridge.
