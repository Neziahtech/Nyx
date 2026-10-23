# Contributor backlog

Scoped, independent work items ready to pick up. Claim one by commenting on
its GitHub issue (see [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and
conventions). Difficulty labels: 🟢 good first issue · 🟡 intermediate ·
🔴 advanced.

---

## 1. Copy-to-clipboard toast 🟢

**Description:** Copy actions (receive address, tx hash) currently change a
button label for 2 seconds. Add a small app-wide toast that confirms
"Copied" (and warns on failure), reusable for future actions.
**Files:** `components/ui/Toast.tsx` (new), `components/ReceiveCard.tsx`,
`components/SendForm.tsx`.
**Acceptance criteria:** toast appears bottom-center, auto-dismisses ~2.5s,
uses blush-100/success tokens, no new dependencies, aria-live polite.

## 2. Transaction detail view 🟡

**Description:** Clicking a history row should open an in-app detail panel
(full addresses, operation type, fee, ledger, memo, timestamp, explorer
link) instead of only linking out.
**Files:** `components/HistoryList.tsx`, `lib/stellar/payments.ts` (fetch
single tx via `horizon.transactions().transaction(hash)`), new
`components/TransactionDetail.tsx`.
**Acceptance criteria:** detail loads with loading/error states, timeout
policy respected, back navigation restores scroll position, rows stay
keyboard-operable.

## 3. Empty state for history 🟢

**Description:** When a funded account has no payments yet, show a friendly
illustrated empty state ("Your activity will appear here") instead of the
current plain sentence.
**Files:** `components/HistoryList.tsx`, optional `components/ui/EmptyState.tsx`.
**Acceptance criteria:** uses only design tokens, distinct from the
unfunded-account state, unit-testable copy component.

## 4. Trustline removal confirmation improvement 🟢

**Description:** Removal currently asks "Remove for good?" inline. Move it
to a dialog that names the asset and issuer, explains the reserve refund,
and requires an explicit confirm.
**Files:** `components/TrustlineManager.tsx`, new `components/ui/Dialog.tsx`.
**Acceptance criteria:** focus trap, Esc closes without action, confirm
button uses `danger` variant, no wallet call until confirmed.

## 5. Dark-mode-safe palette variant 🟡

**Description:** Design and implement a `dark:` token set that keeps WCAG
contrast on deep backgrounds; wire it behind a light/dark/system toggle
persisted in localStorage.
**Files:** `tailwind.config.ts`, `app/globals.css`, new
`components/ThemeToggle.tsx`, all `components/ui/*`.
**Acceptance criteria:** default stays light, no hardcoded hex in
components, contrast checkers pass 4.5:1 for text on all surfaces.

## 6. Address book (local, non-custodial) 🟡

**Description:** Let users save nicknames for frequently used G-addresses;
send form autocompletes names. Storage must stay local (localStorage behind
an interface) and be exported/imported as JSON.
**Files:** `lib/contacts.ts` (new) + `tests/contacts.test.ts`,
`components/SendForm.tsx`, new `components/AddressBook.tsx`.
**Acceptance criteria:** invalid entries rejected via existing
validation.ts, duplicate addresses refused, unit tests for store logic.

## 7. Reserve explainer tooltip 🟢

**Description:** The reserve footnote on the dashboard is dense. Add a
tooltip/popover on "reserved" showing the per-trustline breakdown for the
connected account.
**Files:** `components/BalanceList.tsx`, `components/ui/Tooltip.tsx` (new).
**Acceptance criteria:** keyboard accessible, numbers come from
`getReserveInfo`, no new dependency.

## 8. Fee-aware send ("max" button) 🟡

**Description:** Send amounts must leave the reserve untouched. Add a "Max"
action that computes spendable minus fee headroom, and clamp input to it.
**Files:** `components/SendForm.tsx`, `lib/stellar/validation.ts`
(new `spendableAfterFee` helper) + tests.
**Acceptance criteria:** exact BigInt math (no floats), re-enabled if fee
estimate fails, tests cover boundary cases.

## 9. History filters 🟢

**Description:** Filter activity by direction (sent/received/all) and
asset. Pure UI-state filtering over loaded pages is enough for v1.
**Files:** `components/HistoryList.tsx`, `tests/history-filter.test.ts`.
**Acceptance criteria:** filter chips use Badge tokens, filters persist
across "Load more", empty-result message.

## 10. Memo byte counter 🟢

**Description:** Show live `n/28 bytes` under the memo field, turning
`danger` near the limit, counting UTF-8 bytes not characters.
**Files:** `components/SendForm.tsx` (or a `MemoInput` subcomponent).
**Acceptance criteria:** emoji counted correctly (reuse
`isValidMemo`'s encoder), no layout shift.

## 11. Network badge links to config source 🟢

**Description:** The header's network pill should open a small popover
showing Horizon URL, passphrase, explorer, and a link to
`lib/stellar/config.ts` in the repo — helping contributors understand
switching.
**Files:** `components/Header.tsx`, `lib/stellar/config.ts` (export a
read-only summary helper).
**Acceptance criteria:** popover closes on outside click, no secrets shown.

## 12. E2E smoke test with Playwright 🟡

**Description:** Add a CI job that boots `npm run build && npm start` and
verifies: page loads, the `/create` redirect appears for a fresh browser,
env-validation failure path, mocked Horizon balance render. The wallet
can be stubbed by seeding `localStorage` with an encrypted keystore and
unlocking it in the test.
**Files:** `e2e/smoke.spec.ts` (new), `.github/workflows/ci.yml`,
`package.json` (devDep approval needed in the issue thread first).
**Acceptance criteria:** runs headless, deterministic, skipped on forks
without secrets.

## 13. Soroban-ready asset selector 🔴

**Description:** Research spike + implementation for listing wrapped/Soroban
assets in the send dropdown without breaking current trustline semantics;
document findings in an ADR under `docs/`.
**Files:** `lib/stellar/account.ts`, `components/SendForm.tsx`, `docs/adr/`.
**Acceptance criteria:** written ADR with tradeoffs, behind a feature flag,
zero regressions for classic assets.

## 14. Accessibility audit of the dashboard 🔴

**Description:** Run axe/manual audit: tab order, focus rings on all
controls, color-contrast of dim text on blush-50, live regions for loading
states. Fix what's found and add `jest-axe`-style checks to component
tests.
**Files:** all `components/*`, `app/page.tsx`, new `tests/a11y.test.tsx`.
**Acceptance criteria:** no axe violations at "serious"+, documented
waivers where intentional.

## 15. Explorer deep-links for assets and issuers 🟢

**Description:** Balance and trustline rows should link the issuer address
to its explorer account page, and asset code+issuer to the asset page.
**Files:** `lib/stellar/config.ts` (add `explorerAssetUrl`),
`components/BalanceList.tsx`, `components/TrustlineManager.tsx`, tests.
**Acceptance criteria:** correct URL shapes for both networks, links
`rel="noreferrer"`, target rows covered by small unit tests.

---

**Picking up:** choose any item whose dependencies (none — they're
designed independent) don't block you; two contributors can work on
different items in parallel safely.
