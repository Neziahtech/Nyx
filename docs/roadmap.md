# Roadmap

Nyx is being built in three phases. Phase 1 (now) is the wallet foundation;
phases 2 and 3 extend it without rewrites, which is why the architecture
keeps Stellar logic in `lib/` behind small, testable modules.

## Phase 1 — Wallet foundation (this release)

Non-custodial Stellar wallet on testnet: Freighter connection, balances
with reserve clarity, XLM and custom-asset sends with a review step,
receive with QR, trustline management, and paginated history.

## Phase 2 — Bill payments (`lib/bills/`)

Recurring and one-off bill payments from the same balance, with payees,
templates, and a schedule view.

Planned approach:

- **Data model first, on-device.** Payees and schedules are stored locally
  (indexedDB wrapper behind a `lib/bills/store.ts` interface); nothing
  leaves the browser. A `PaymentPlan` is `{payee, asset, amount, cadence,
memo}` — deliberately close to the existing `SendParams` shape so
  `payments.buildSendTransaction()` is reused unchanged.
- **Execution is still user-approved.** Nyx proposes transactions; each
  due bill produces a review card that goes through the same Freighter
  sign flow. No unattended signing, ever.
- **Scheduling** runs when the app is open (a "bills due" banner on the
  dashboard), not as a server — keeping the no-backend property intact.
- **Trustline awareness**: adding a payee who is paid in a non-native asset
  checks whether the user already trusts it and links to the trustline flow
  when missing.
- Expected new surfaces: `app/bills/` route, `components/BillsView.tsx`,
  `lib/bills/{plans.ts,store.ts,due.ts}` with unit tests mirroring the
  `payments.test.ts` pattern.

## Phase 3 — Fiat off-ramp via anchors (`lib/anchors/`)

Withdraw local currency through Stellar **anchors** (SEP-6/SEP-24), and
deposit later.

Planned approach:

- **Anchor registry**: read `stellar.toml` of known anchors (an allowlist
  shipped in config, community-editable) to discover `withdraw`/`deposit`
  endpoints, supported assets, and KYC requirements. New module
  `lib/anchors/toml.ts` + `lib/anchors/registry.ts`.
- **SEP-24 interactive flow**: open the anchor's hosted deposit/withdraw
  form in a redirect with a SEP-10 auth challenge signed by Freighter
  (`lib/anchors/auth.ts` — the only new signing path, reusing
  `wallet.signWithWallet()`'s bridge). Nyx stores the resulting transaction
  id and shows anchor status by polling `/transaction` (respecting the
  10s minimum-interval rule).
- **SEP-6 API flow** for anchors without interactive UIs, with typed
  client in `lib/anchors/sep6.ts`.
- **Local state**: off-ramp transactions surface in the existing history
  list via a `statusSource: "anchor"` extension of `HistoryEntry`, kept
  separate from on-chain rows so the explorer link semantics stay honest.
- Out of scope until a regulated anchor partner is chosen: holding fiat,
  running an anchor, custody of any kind. Nyx remains a client.

## Cross-phase guardrails

- Every phase keeps: no secret keys in the app, UI-free logic in `lib/`,
  exact-pinned deps with CI audit, blush-token design, and unit tests for
  every new `lib/` function.
- Mainnet readiness stays a config change (`NEXT_PUBLIC_STELLAR_NETWORK`),
  with env validation expanded for anchor allowlists in phase 3.
