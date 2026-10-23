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

- Nyx is **self-custody** and runs entirely in your browser. It generates
  your keypair locally (or imports one you provide) and shows the secret key
  exactly once so you can back it up.
- The secret key is encrypted with your password (AES-256-GCM, PBKDF2-SHA256
  with 600,000 iterations and a random salt and IV). Only the encrypted blob
  is stored, in your browser's localStorage. The plaintext key is never
  logged, never appears in URLs, and is never sent to any server — there is
  no Nyx backend, and Horizon only ever sees a signed transaction.
- While unlocked, the key lives in memory only. It is destroyed on Lock, on
  Log out (which also deletes the stored wallet), after 5 minutes of
  inactivity, and when the tab closes.
- Transactions are shown to you in full — destination, asset, amount, memo,
  estimated fee — and are signed locally only after you confirm.

## Threat model in plain terms

| Threat                                   | Mitigation                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen stored wallet file                | The blob is AES-GCM-encrypted under a hardened password; the key never leaves `lib/wallet/`                                                               |
| Someone guesses your password            | Minimum 12 characters with a strength meter; 600k PBKDF2 iterations make online/offline guessing slow; there is no account reset — back up the secret key |
| Someone uses the page while you're away  | Auto-lock after 5 minutes idle; lock on tab close; a manual **Lock** button; signing needs an explicit confirmation step                                  |
| Malicious script in the page             | Strict production Content-Security-Policy; no `dangerouslySetInnerHTML`; Next.js output escaping                                                          |
| XSRF/transaction injection via URL state | No secrets or state in URLs; all wallet actions require explicit in-app confirmation                                                                      |
| Trusting a fake asset                    | Trustline UI shows the full issuer address; balances list issuer with explorer links                                                                      |
| Stuck UI on slow network                 | Every Horizon call has a 15s timeout and readable error states                                                                                            |
| Dependency supply chain                  | Exact pinned versions, `npm audit` in CI, Dependabot weekly checks                                                                                        |

## If your device is compromised

Treat the wallet as exposed the moment you suspect the device or browser is
not yours. From a **clean device**, create a fresh Nyx wallet (or use
another Stellar wallet) and send all assets to the new address immediately.
Changing the password does not rotate the key. Then, on devices you control,
use **Log out** to delete the stored blob.

## Out of scope (for now)

- Mainnet incidents involving assets not yet supported by Nyx.
- Nyx has not had a professional security review; treat it as experimental
  and keep it on testnet.
- Physical access to the user's device or browser profile.
- Lost passwords: recovery is only possible from the secret key backup.
- Features marked planned in [docs/roadmap.md](docs/roadmap.md) (anchors,
  bill pay, off-ramps) do not exist yet and cannot be audited.

## Supported versions

| Version         | Supported |
| --------------- | --------- |
| 0.1.x (testnet) | ✅        |
