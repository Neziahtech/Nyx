# Bills (planned — not implemented)

This directory will hold the bill-pay module from roadmap phase 2: payees,
recurring payment plans, and a "due" queue that produces ordinary Nyx
payments for user approval.

Planned module layout (see [docs/roadmap.md](../../docs/roadmap.md) phase 2):

```
bills/
  plans.ts    PaymentPlan type + due-date computation (pure, tested)
  store.ts    local persistence interface (indexedDB adapter, JSON export)
  due.ts      resolves which plans are due for the current session
  match.ts    reconciles sent payments against plans to mark them paid
```

Design commitments:

- A `PaymentPlan` compiles to the existing `SendParams` in
  `lib/stellar/payments.ts` — bill pay is a scheduler around the same send
  path, not a second transaction pipeline.
- Execution is always user-approved: each due bill is confirmed on a review
  card and signed locally only after that. Nyx never signs
  unattended, even for "auto-pay": the due queue batches review cards.
- All schedule data stays on-device; no backend, no telemetry.
- Timezone-safe cadence math (monthly-on-the-31st, DST weeks) lives in
  `plans.ts` with exhaustive unit tests before any UI exists.

Nothing here is wired into the app yet. The backlog item "Address book"
(#6 in docs/backlog.md) is a deliberate first stepping stone — same storage
interface, smaller surface.
