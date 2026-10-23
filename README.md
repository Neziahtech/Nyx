# Nyx

A soft, clean Stellar wallet. Nyx starts as a simple wallet — connect, see
balances, send and receive XLM and custom assets, manage trustlines, and
review your transaction history — and is structured so bill payments and
fiat off-ramping (via Stellar anchors) can plug in later without a rewrite.

Currently targets **Stellar testnet**; switching to mainnet is a one-line
config change.

<!-- screenshot: dashboard -->
<!-- screenshot: send flow -->

## Why Freighter?

Nyx never generates or holds secret keys. Signing goes through
[Freighter](https://www.freighter.app/), the Stellar browser extension, so
your key stays inside the extension and this app only ever asks it to sign
transactions you reviewed. An app that holds your secret key is a liability;
an app that asks your wallet to sign is not. Read more in
[docs/security.md](docs/security.md).

## Quick start

Requirements: Node.js 18.17+ and the Freighter extension.

```bash
npm ci
cp .env.example .env.local   # defaults are already in .env; override if needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click
**Connect Freighter**.

### Getting test funds

1. Create a testnet account in Freighter (switch its network to _Testnet_).
2. Copy your public key from Nyx's **Receive** page.
3. Fund it with [Friendbot](https://friendbot.stellar.org/?addr=YOUR_KEY) —
   the dashboard links directly when it detects an unfunded account.

### Switching networks

Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet` (env var at deploy time, or in
`.env.local`). All Horizon URLs, passphrases, and explorer links live in one
file: [`lib/stellar/config.ts`](lib/stellar/config.ts).

## Running the checks

```bash
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck   # strict TypeScript, no emit
npm test            # Vitest unit tests for lib/
npm run build       # production build
```

Pre-commit hooks (Husky + lint-staged) run the same checks on staged files.
CI runs lint, typecheck, tests, `npm audit`, and build on every push and PR.

## Deploying

Any Node host or static export that supports Next.js 14 works — the app is
fully client-side against public Horizon endpoints, so there are no secrets
to configure. Set `NEXT_PUBLIC_STELLAR_NETWORK` as a build/deploy variable.

## Documentation

| Doc                                            | What's inside                               |
| ---------------------------------------------- | ------------------------------------------- |
| [Architecture](docs/architecture.md)           | Layers, data flow, where phases 2–3 plug in |
| [Security](docs/security.md)                   | Key handling, threat model, out of scope    |
| [Testing checklist](docs/testing-checklist.md) | Manual testnet walkthrough                  |
| [Roadmap](docs/roadmap.md)                     | Bill payments and anchor off-ramping        |
| [Contributor backlog](docs/backlog.md)         | Scoped issues ready to pick up              |
| [Contributing](CONTRIBUTING.md)                | Setup, conventions, PR checklist            |
| [Changelog](CHANGELOG.md)                      | Release notes (Keep a Changelog)            |

## License

MIT — see [LICENSE](LICENSE).
