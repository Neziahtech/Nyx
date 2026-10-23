# Manual testing checklist (testnet)

A walkthrough to run against Stellar testnet before each release. You need
the Freighter extension with testnet enabled, and a browser with the Nyx dev
server running (`npm run dev`).

## 1. Setup and funding

- [ ] In Freighter, add/create a testnet account and copy its public key.
- [ ] Open the dashboard → **Connect Freighter** → approve the access prompt.
- [ ] The dashboard shows the unfunded empty state with a
      **Fund this account with Friendbot** link.
- [ ] Click the Friendbot link; it returns account JSON. Refresh Nyx —
      the balance appears (~10,000 XLM).

## 2. Send XLM between two accounts

- [ ] In Freighter, create a **second** testnet account and fund it too.
- [ ] In Nyx: Send → destination = account 2's `G…` address, asset = XLM,
      amount = `25`, memo = `hello nyx` → **Review payment**.
- [ ] Confirm the review screen shows the right destination, amount, memo,
      and a fee of ~0.0000100 XLM.
- [ ] Confirm → approve in Freighter → success screen shows a tx hash and a
      working explorer link.
- [ ] Dashboard activity lists the sent payment in deep neutral with the
      memo; account 2 (after connecting it) shows it received in muted green.
- [ ] Available XLM reflects the reserve note (1 XLM base + 0.5 per
      trustline).

## 3. Negative send checks

- [ ] Destination `g…lowercase` or wrong length → inline validation error,
      button blocked.
- [ ] Amount `1.12345678` (8 decimals) or `0` or `-3` → inline error.
- [ ] Amount above spendable balance → error names the spendable amount.
- [ ] Memo of 29+ characters → byte-length error.
- [ ] At the review step, click **Reject** inside Freighter → Nyx shows
      "Signing was cancelled in Freighter", no error spam, back to review.

## 4. Add a trustline and a custom asset

- [ ] Trustlines page → add a code like `TEST` with an issuer you control
      (create a throwaway asset account via Freighter + Friendbot and issue
      to it, or use a known test asset issuer).
- [ ] Confirm the trustline appears in the list with balance 0 and a
      working **Remove** (zero balance) flow.
- [ ] From the issuer account, send some `TEST` to your main account.
- [ ] Back in Nyx: balance row for `TEST` appears after refresh; Send's
      asset dropdown now offers it, with the issuer shown.
- [ ] Send `TEST` to account 2 **before** it trusts the asset → the network
      rejects; Nyx shows the specific "recipient must add a trustline
      first" message (not a raw XDR error).
- [ ] Account 2 adds the trustline, receive works, history updates.

## 5. Receive

- [ ] Receive page: public key matches Freighter's, copy button gives
      "Copied!", QR scans into a Stellar app as the same key.
- [ ] Send to that address from account 2 → arrives, activity shows the
      received row in green.

## 6. History and pagination

- [ ] With >20 payments, **Load more** appends older rows without
      duplicates and eventually stops.
- [ ] Each row links to the right transaction in the explorer.

## 7. Network/account switching

- [ ] Switch Freighter to a different account → Nyx detects it and re-reads
      balances without a manual reconnect.
- [ ] Switch Freighter's network to **Public** while Nyx runs testnet →
      Nyx shows a network-mismatch error on the next action and tells the
      user to switch back.

## 8. Environment guard

- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=devnet` in `.env.local`, restart →
      app fails immediately with the "Supported networks: testnet, mainnet"
      message.

## 9. Mainnet switch (config only)

- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`, rebuild; Horizon URL,
      passphrase, and explorer links all follow (no Friendbot link on
      mainnet).
