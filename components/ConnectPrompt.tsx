"use client";

import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { useWallet } from "./WalletProvider";
import { isFreighterInstalled } from "../lib/stellar/wallet";

/**
 * Shown on every page when no wallet is connected: either a connect prompt
 * or Freighter install guidance when the extension is missing.
 */
export function ConnectPrompt() {
  const { status, error, connect } = useWallet();
  const installed = isFreighterInstalled();

  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold text-ink">
        {installed ? "Connect your wallet" : "Freighter not found"}
      </h2>
      <p className="mt-2 text-sm text-dim">
        {installed
          ? "Nyx reads balances and builds transactions, but you approve every payment inside Freighter. Nyx never sees your secret key."
          : "Nyx signs through the Freighter browser extension so your secret key never touches this app. Install Freighter, refresh this page, then connect."}
      </p>
      {!installed && (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-blush-500 hover:text-blush-600"
        >
          Get Freighter →
        </a>
      )}
      {installed && (
        <div className="mt-4">
          <Button onClick={connect} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Connect Freighter"}
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Card>
  );
}
