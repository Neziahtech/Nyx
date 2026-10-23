# Architecture

Nyx is deliberately layered: a thin Next.js UI on top of pure TypeScript
Stellar logic. Everything that understands Stellar lives in `lib/stellar/`
and is unit-testable without a browser; everything that understands pixels
lives in `app/` and `components/` and holds no business logic.

## Layers

```
┌────────────────────────────────────────────────────┐
│ app/            Next.js routes (page shells only)  │
│ components/     feature components + ui/ tokens    │
├────────────────────────────────────────────────────┤
│ WalletProvider  shared session: connect, balances, │
│                 sign-and-submit, change watching   │
├────────────────────────────────────────────────────┤
│ lib/stellar/    pure Stellar logic (no React)      │
│   config.ts     network/env selection              │
│   client.ts     Horizon server + request policy    │
│   account.ts    load account, balances, reserves   │
│   payments.ts   send-tx building, history paging   │
│   trustlines.ts changeTrust building               │
│   validation.ts input checks, exact decimals       │
│   wallet.ts     Freighter bridge (connect/sign)    │
├────────────────────────────────────────────────────┤
│ lib/env.ts      startup schema validation          │
│ @stellar/stellar-sdk · @stellar/freighter-api      │
└────────────────────────────────────────────────────┘
```

## Data flow (send, as the representative case)

1. `WalletProvider` holds the connected public key (from Freighter) and the
   `AccountResponse` loaded via `account.ts` → `client.ts` → Horizon.
2. `SendForm` collects input and calls `validation.ts` for immediate
   feedback. It never builds XDR itself.
3. On "Review", `payments.fetchBaseFee()` + `estimateFeeXlm()` produce the
   fee estimate shown to the user.
4. On "Confirm", `payments.buildSendTransaction()` re-validates everything
   (destination, amount vs. spendable, memo bytes), builds an **unsigned**
   transaction bound to the network passphrase from `config.ts`.
5. `wallet.signWithWallet()` passes the XDR to Freighter; the user approves
   in the extension. Nyx receives signed XDR only — never a secret key.
6. `payments.submitSignedTransaction()` posts to Horizon; success returns
   the tx hash (linked to the explorer), failures are translated by
   `describeSubmitError()` into actionable plain language — e.g. the
   recipient must add a trustline first.
7. The dashboard refreshes (rate-limited to ≥10s between polls) and the
   history list re-fetches the first page.

## Key invariants

- **UI never talks to Horizon or Freighter directly.** All network and
  wallet access goes through `lib/stellar/`, so behavior is testable and
  the same logic will serve later phases.
- **Validation is centralized** in `validation.ts` and re-applied inside
  transaction builders — the UI cannot bypass it.
- **Every Horizon call** carries an explicit timeout (`client.ts`), so a
  slow network produces an error state instead of a frozen screen.
- **Amounts are compared in integer stroop-scale** (`BigInt`), never floats.
- **One network config file.** `NEXT_PUBLIC_STELLAR_NETWORK` selects
  testnet/mainnet; env validation fails fast on unknown values.
- **Design tokens are the only palette.** Components use blush tokens and
  `components/ui/` primitives; colors for non-CSS contexts (the QR SVG)
  come from `lib/theme.ts`.

## Where phases 2 and 3 plug in

- **Bill payments (`lib/bills/`)**: a pure module that consumes the same
  `payments.ts` primitives (amount validation, tx building) and adds
  templates/recurrence on top. UI becomes a `app/bills/` route with its own
  feature component; `WalletProvider` is unchanged.
- **Anchor off-ramping (`lib/anchors/`)**: SEP-24/SEP-6 clients are new
  `lib/` modules talking to anchor HTTP APIs (not Horizon), reusing
  `client.ts`'s timeout policy and `env.ts`'s schema style. Auth flows
  (SEP-10) live in `wallet.ts`-adjacent code since they use Freighter
  signing.
- Neither phase should require touching `validation.ts`, `account.ts`, or
  the `ui/` primitives — that is the signal the seams are right.

## Testing strategy

Unit tests mock the `client.ts` Horizon instance, so `payments.ts` tests
build real XDR against the test network passphrase without ever touching
the network. `validation.ts` and `env.ts` are pure and exhaustively
covered. Manual testnet steps live in `docs/testing-checklist.md`.
