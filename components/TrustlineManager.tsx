"use client";

import { useState } from "react";

import { Card, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { useWallet } from "./WalletProvider";
import { ConnectPrompt } from "./ConnectPrompt";
import {
  buildAddTrustlineTransaction,
  buildRemoveTrustlineTransaction,
} from "../lib/stellar/trustlines";
import { isValidAssetCode, isValidIssuer } from "../lib/stellar/validation";

/**
 * Trustlines: list what the account trusts, add a trustline by asset code +
 * issuer, and remove one when its balance is zero.
 */
export function TrustlineManager() {
  const { publicKey, account, balances, status, signAndSubmit, friendlyError, refresh } =
    useWallet();

  const [code, setCode] = useState("");
  const [issuer, setIssuer] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<"add" | string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  if (!publicKey) return <ConnectPrompt />;

  const issued = balances.filter((b) => b.assetCode !== "native");

  const addTrustline = async () => {
    setError(null);
    setResult(null);
    const errs: Record<string, string> = {};
    if (!isValidAssetCode(code)) {
      errs.code = "Asset code must be 1-12 alphanumeric characters.";
    }
    if (!isValidIssuer(issuer)) {
      errs.issuer = "Issuer must be a valid Stellar account address (G…).";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0 || !account) return;

    setPending("add");
    try {
      const tx = buildAddTrustlineTransaction({
        source: publicKey,
        sequence: account.sequence,
        assetCode: code,
        assetIssuer: issuer,
      });
      const hash = await signAndSubmit(tx);
      setResult(`Trustline added. Tx: ${hash.slice(0, 16)}…`);
      setCode("");
      setIssuer("");
      await refresh();
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setPending(null);
    }
  };

  const removeTrustline = async (assetCode: string, assetIssuer: string) => {
    if (!account || !publicKey) return;
    setError(null);
    setResult(null);
    setPending(assetIssuer);
    try {
      const tx = buildRemoveTrustlineTransaction({
        source: publicKey,
        sequence: account.sequence,
        assetCode,
        assetIssuer,
        balance: issued.find((b) => b.assetIssuer === assetIssuer)?.total ?? "0",
      });
      const hash = await signAndSubmit(tx);
      setResult(`Trustline removed. Tx: ${hash.slice(0, 16)}…`);
      setConfirmRemove(null);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardTitle>Existing trustlines</CardTitle>
        {status === "loading" && <p className="mb-2 text-xs text-dim">Refreshing…</p>}
        {issued.length === 0 ? (
          <p className="text-sm text-dim">This account trusts no custom assets yet.</p>
        ) : (
          <ul className="divide-y divide-blush-200">
            {issued.map((b) => {
              const zero = b.total === "0" || Number(b.total) === 0;
              return (
                <li
                  key={b.assetIssuer}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{b.assetCode}</p>
                    <p className="truncate font-mono text-xs text-dim">{b.assetIssuer}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink">{b.total}</span>
                    {zero ? (
                      confirmRemove === b.assetIssuer ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-danger">Remove for good?</span>
                          <Button
                            variant="danger"
                            onClick={() =>
                              void removeTrustline(b.assetCode, b.assetIssuer!)
                            }
                            disabled={pending !== null}
                          >
                            {pending === b.assetIssuer ? "Removing…" : "Confirm"}
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmRemove(b.assetIssuer!)}
                          disabled={pending !== null}
                        >
                          Remove
                        </Button>
                      )
                    ) : (
                      <Badge tone="neutral">balance &gt; 0</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-dim">
          Each trustline reserves 0.5 XLM until it is removed. Removal is only possible at
          zero balance.
        </p>
      </Card>

      <Card>
        <CardTitle>Add a trustline</CardTitle>
        <div className="flex flex-col gap-4">
          <Input
            label="Asset code"
            placeholder="USDC"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={fieldErrors.code}
          />
          <Input
            label="Issuer address"
            placeholder="G…"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            error={fieldErrors.issuer}
            hint="The account that issued the asset. Verify it with the issuer's docs."
          />
          {result && <p className="text-sm text-success">{result}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div>
            <Button
              onClick={() => void addTrustline()}
              disabled={pending !== null || status === "loading"}
            >
              {pending === "add" ? "Waiting for Freighter…" : "Add trustline"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
