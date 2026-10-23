# Contributing to Nyx

Thanks for your interest! Nyx is built in the open and the
[contributor backlog](docs/backlog.md) exists specifically so outside
contributors can start quickly.

## Local setup

1. Node.js 18.17+ and npm 9+.
2. `npm ci` (dependencies are pinned to exact versions).
3. `npm run dev` — the app runs against public testnet Horizon; no API keys
   needed.
4. Install [Freighter](https://www.freighter.app/) if you want to exercise
   the signing flows, and fund a testnet account with
   [Friendbot](https://friendbot.stellar.org).

## Before opening a PR

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four must pass; CI runs the same set (plus `npm audit`). Pre-commit
hooks auto-format staged files with Prettier and run ESLint fixes.

## Conventions

- **Branches:** `main` is always working. Feature branches:
  `feat/<short-name>`, fixes: `fix/<short-name>`, docs: `docs/<short-name>`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Small,
  focused commits; one logical change each.
- **Scope:** one issue per PR where possible. If a PR touches several,
  explain why in the description.
- **Stellar logic** lives in `lib/stellar/` and stays UI-free and unit
  tested. Components only consume it.
- **Design tokens:** styling uses the blush tokens in
  `tailwind.config.ts` and shared `components/ui/` primitives — no
  hardcoded hex values or one-off colors.
- **Types:** strict TypeScript. No `any` without a comment explaining why.
- **No new dependencies** without discussing it in the issue first.

## Picking up an issue

Look for [`good first issue`](https://github.com/nyx-wallet/nyx/labels/good%20first%20issue)
labels, or work items from [docs/backlog.md](docs/backlog.md). Comment on
the issue to claim it. Each backlog item lists the files it touches and
acceptance criteria so you can scope your work before starting.

## Pull requests

Use the template. Include: what changed, how you verified it (tests / manual
testnet steps), and screenshots for UI changes. Respond to review feedback
within a few days if you can; someone will pick the PR up if you get
stuck or disappear.

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
