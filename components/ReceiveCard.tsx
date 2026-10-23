"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { Card, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { useWallet } from "./WalletProvider";
import { stellarConfig, explorerAccountUrl } from "../lib/stellar/config";
import { BRAND_ROSE, SURFACE_WHITE } from "../lib/theme";

/**
 * Receive screen: public key, copy button, and a QR code in the brand rose
 * on white. Only Stellar-network assets should ever be sent to this address.
 */
export function ReceiveCard() {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!publicKey) return null; // pre-unlock render; the gate routes locked sessions away

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardTitle>Receive on {stellarConfig.name}</CardTitle>
      <div className="mx-auto w-fit rounded-xl border border-blush-200 bg-white p-4">
        <QRCodeSVG
          value={publicKey}
          size={180}
          bgColor={SURFACE_WHITE}
          fgColor={BRAND_ROSE}
          level="M"
        />
      </div>
      <p className="mt-4 break-all font-mono text-xs text-ink">{publicKey}</p>
      <div className="mt-4 flex justify-center gap-3">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? "Copied!" : "Copy address"}
        </Button>
        <a
          href={explorerAccountUrl(publicKey)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center text-sm font-medium text-blush-500 hover:text-blush-600"
        >
          View account →
        </a>
      </div>
      <p className="mt-5 rounded-xl bg-blush-100 px-4 py-3 text-xs text-ink">
        Only send <strong>Stellar assets</strong> to this address. Coins from other
        networks (Bitcoin, Ethereum, …) cannot be recovered — the Stellar network is the
        only thing Nyx can see.
      </p>
    </Card>
  );
}
