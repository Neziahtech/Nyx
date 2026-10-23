# Nyx

A soft, clean Stellar wallet. Nyx starts as a simple wallet — create or
import a key, see balances, send and receive XLM and custom assets, manage
trustlines, and review your transaction history — and is structured so bill
payments and fiat off-ramping (via Stellar anchors) can plug in later without
a rewrite.

Currently targets **Stellar testnet**; switching to mainnet is a one-line
config change.

<!-- screenshot: dashboard -->
<!-- screenshot: send flow -->

## How keys work

Nyx is self-custody and needs no browser extension. On **Create wallet** it
generates a keypair in your browser and shows the secret key exactly once for
backup; **Import wallet** accepts an existing secret key. Either way the key
is encrypted with your password — AES-256-GCM with a PBKDF2-SHA256-derived
key, 600,000 iterations, and a random salt and IV — and only the encrypted
blob is stored, in localStorage. The decrypted key lives in memory while
unlocked and is destroyed after 5 minutes of inactivity, when the tab closes,
when you press **Lock**, and entirely when you **Log out** (which deletes the
stored wallet). Transactions are signed locally, only after you confirm the
review screen. Read more in [docs/security.md](docs/security.md).

> Nyx has not yet had a professional security review. Treat it as
> experimental and use testnet only until one has happened.

## Quick start

Requirements: Node.js 18.17+.

```bash
npm ci
cp .env.example .env.local   # defaults are already in .env; override if needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no wallet stored
yet you'll land on **/create**: generate a keypair (or import a secret key),
save the one-time secret key backup, and set an unlock password.

### Getting test funds

1. Create your wallet as above (testnet is the default network).
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
