# Security Policy

## Reporting a vulnerability

If you find a security issue in Nyx, please **do not open a public issue**.
Email **security@nyx-wallet.example** (maintainers publish the real address
in the README security badge once the repo is live) with:

- A description of the issue and the affected version/commit.
- Steps or proof-of-concept code to reproduce it.
- Potential impact.

We aim to acknowledge private reports within **72 hours** and will work
with you on disclosure timing. Fixed reports may be credited in
CHANGELOG.md unless you ask not to be.

## How Nyx handles keys

- Nyx is non-custodial: it never generates, requests, stores, or transmits
  secret keys. Signing happens entirely inside the Freighter browser
  extension.
- The app only ever sends Freighter a fully-built, unsigned transaction
  XDR for review, after showing you the destination, asset, amount, memo,
  and estimated fee.
- Network reads use public Horizon endpoints over HTTPS. Nothing sensitive
  is sent to any server the project runs — there is no Nyx backend.

## Threat model in plain terms

| Threat                                   | Mitigation                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Malicious site code stealing keys        | Keys never enter the app; Freighter shows the raw transaction before approving       |
| XSRF/transaction injection via URL state | No secrets or state in URLs; all wallet actions require explicit Freighter approval  |
| Trusting a fake asset                    | Trustline UI shows the full issuer address; balances list issuer with explorer links |
| Stuck UI on slow network                 | Every Horizon call has a 15s timeout and readable error states                       |
| Dependency supply chain                  | Exact pinned versions, `npm audit` in CI, Dependabot weekly checks                   |

## Out of scope (for now)

- Mainnet incidents involving assets not yet supported by Nyx.
- Vulnerabilities in Freighter itself — report those to the Freighter team.
- Physical access to the user's device or browser profile.
- Features marked planned in [docs/roadmap.md](docs/roadmap.md) (anchors,
  bill pay, off-ramps) do not exist yet and cannot be audited.

## Supported versions

| Version         | Supported |
| --------------- | --------- |
| 0.1.x (testnet) | ✅        |
