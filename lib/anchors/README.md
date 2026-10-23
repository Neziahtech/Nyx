# Anchors (planned — not implemented)

This directory will hold Stellar anchor integration: fiat deposit and
withdrawal through anchors speaking **SEP-6** (API-driven) and **SEP-24**
(interactive customer approval), plus **SEP-10** authentication (a challenge
transaction signed by the unlocked local session) and **SEP-12** (KYC data
exchange) where an anchor requires it.

Planned module layout (see [docs/roadmap.md](../../docs/roadmap.md) phase 3):

```
anchors/
  toml.ts       stellar.toml discovery and parsing
  registry.ts   allowlisted anchors, supported assets, endpoints
  auth.ts       SEP-10 challenge building (signing via lib/wallet/session.ts)
  sep24.ts      interactive flow: URL construction, callback handling
  sep6.ts       API flow: customer/transaction endpoints
  status.ts     polled transaction status (≥10s interval rule applies)
```

Rules this module must keep:

- Secret keys stay confined to `lib/wallet/` — signing goes through the
  session exactly like the wallet flows do today.
- Anchor base URLs come from a reviewed allowlist, not user input.
- Anchor status is advisory; anything that moved value on-chain is verified
  against Horizon before shown as complete.

Nothing here is wired into the app yet. If you want to help design the
anchor layer, open a discussion referencing phase 3 of the roadmap.
