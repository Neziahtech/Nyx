# Manual testing checklist (testnet)

A walkthrough to run against Stellar testnet before each release. You need a
browser with the Nyx dev server running (`npm run dev`) — no extensions.
Nyx is self-custody: it creates its own keys, encrypts them with a password
you choose, and signs locally.

## 1. Create a wallet and fund it

- [ ] Open the dashboard with no wallet stored → you are redirected to
      **/create**.
- [ ] **Create a new wallet** → the screen shows the public key and the
      secret key exactly once, with the backup warning.
- [ ] The **Continue** button stays disabled until "I've saved my secret
      key" is ticked. Save the key somewhere safe for step 9.
- [ ] Choose a password: short (<12 char) input is rejected; the strength
      meter responds; mismatched confirmation blocks the button.
- [ ] **Create wallet** shows "Encrypting your wallet…" for a second or
      two, then lands on the dashboard with the address in the header.
- [ ] The dashboard shows the unfunded empty state with a
      **Fund this account with Friendbot** link; after clicking it and
      refreshing, the balance appears (~10,000 XLM).
- [ ] Check DevTools → Application → localStorage: only `nyx.keystore.v1`
      exists, and its JSON contains no `S…` secret key.

## 2. Lock and unlock

- [ ] Click **Lock** → immediately routed to **/unlock**, which shows the
      stored account's short address.
- [ ] Wrong password → generic "Could not unlock this wallet with that
      password." message; no detail about why.
- [ ] Correct password → back on the dashboard, balances reload.
- [ ] Reload the page (F5) → routed to /unlock again (the key is
      memory-only).
- [ ] Leave the tab idle for 5+ minutes → auto-lock routes to /unlock.

## 3. Send XLM between two accounts

- [ ] Open a second browser profile (or log out and import a second key —
      see step 9) and fund it too.
- [ ] In Nyx: Send → destination = account 2's `G…` address, asset = XLM,
      amount = `25`, memo = `hello nyx` → **Review payment**.
- [ ] Confirm the review screen shows the right destination, amount, memo,
      and a fee of ~0.0000100 XLM. Nothing is signed until you confirm.
- [ ] **Confirm and send** → success screen shows a tx hash and a working
      explorer link.
- [ ] Dashboard activity lists the sent payment in deep neutral with the
      memo; account 2 shows it received in muted green.
- [ ] Available XLM reflects the reserve note (1 XLM base + 0.5 per
      trustline).

## 4. Negative send checks

- [ ] Destination `g…lowercase` or wrong length → inline validation error,
      button blocked.
- [ ] Amount `1.12345678` (8 decimals) or `0` or `-3` → inline error.
- [ ] Amount above spendable balance → error names the spendable amount.
- [ ] Memo of 29+ characters → byte-length error.
- [ ] Lock the wallet (5-minute idle) while the send form is open → routed
      to /unlock; after unlocking, nothing was signed and the form is
      intact.

## 5. Add a trustline and a custom asset

- [ ] Trustlines page → add a code like `TEST` with an issuer you control
      (create a throwaway asset account with Nyx in another profile +
      Friendbot and issue to it, or use a known test asset issuer).
- [ ] Confirm the trustline appears in the list with balance 0 and a
      working **Remove** (zero balance) flow.
- [ ] From the issuer account, send some `TEST` to your main account.
- [ ] Back in Nyx: balance row for `TEST` appears after refresh; Send's
      asset dropdown now offers it, with the issuer shown.
- [ ] Send `TEST` to account 2 **before** it trusts the asset → the network
      rejects; Nyx shows the specific "recipient must add a trustline
      first" message (not a raw XDR error).
- [ ] Account 2 adds the trustline, receive works, history updates.

## 6. Receive

- [ ] Receive page: public key matches the header and the one shown at
      creation; copy button gives "Copied!"; QR scans into a Stellar app as
      the same key.
- [ ] Send to that address from account 2 → arrives, activity shows the
      received row in green.

## 7. History and pagination

- [ ] With >20 payments, **Load more** appends older rows without
      duplicates and eventually stops.
- [ ] Each row links to the right transaction in the explorer.

## 8. Log out and import (backup round-trip)

- [ ] Click **Log out** → confirmation dialog warns the wallet will be
      deleted; the danger button stays disabled until "I have saved my
      secret key" is ticked.
- [ ] Confirm → routed to /create and localStorage no longer has
      `nyx.keystore.v1`.
- [ ] **Import an existing secret key** with the key saved in step 1 and a
      new password → the same address reappears with its balances intact.
- [ ] Import with a malformed key (wrong prefix/length) → inline error,
      nothing stored.

## 9. Environment guard

- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=devnet` in `.env.local`, restart →
      app fails immediately with the "Supported networks: testnet, mainnet"
      message.

## 10. Mainnet switch (config only)

- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`, rebuild; Horizon URL,
      passphrase, and explorer links all follow (no Friendbot link on
      mainnet). The stored keystore blob is network-independent — the same
      wallet unlocks on either network.

## 11. Content Security Policy

- [ ] With a production build (`npm run build && npm start`), check
      DevTools → Network → document response headers: the
      `Content-Security-Policy` header is present and the app works with it
      (no console CSP violations on any page).
