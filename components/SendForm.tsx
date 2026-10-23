"use client";

import { useMemo, useState } from "react";

import { Card, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useWallet } from "./WalletProvider";
import { ConnectPrompt } from "./ConnectPrompt";
import {
  buildSendTransaction,
  estimateFeeXlm,
  fetchBaseFee,
} from "../lib/stellar/payments";
import {
  isValidAddress,
  isValidAmount,
  isValidMemo,
  isAmountWithinBalance,
  subtractAmounts,
} from "../lib/stellar/validation";
import { explorerTxUrl, stellarConfig } from "../lib/stellar/config";
import { MIN_REFRESH_INTERVAL_MS } from "../lib/stellar/client";

/**
 * Send flow: form -> validation -> review (with fee estimate) -> Freighter
 * signature -> Horizon submission -> result with explorer link.
 */
export function SendForm() {
  const {
    publicKey,
    account,
    balances,
    reserve,
    status,
    signAndSubmit,
    friendlyError,
    refresh,
  } = useWallet();

  const [destination, setDestination] = useState("");
  const [assetKey, setAssetKey] = useState("native");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<"form" | "review" | "sending" | "done">("form");
  const [feeXlm, setFeeXlm] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  const assetOptions = useMemo(
    () =>
      balances.map((b) => ({
        key: b.assetIssuer ? `${b.assetCode}:${b.assetIssuer}` : "native",
        label:
          b.assetCode === "native"
            ? "XLM (lumens)"
            : `${b.assetCode} — ${b.assetIssuer?.slice(0, 8)}…`,
        balance: b,
      })),
    [balances]
  );

  const selected = assetOptions.find((o) => o.key === assetKey);
  const spendable =
    selected && reserve && selected.balance.assetCode === "native"
      ? subtractAmounts(selected.balance.total, reserve.totalReserved)
      : (selected?.balance.total ?? "0");

  if (!publicKey) return <ConnectPrompt />;

  const validateFields = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isValidAddress(destination)) {
      errs.destination =
        "Enter a valid Stellar account address (starts with G, 56 characters).";
    }
    if (!isValidAmount(amount)) {
      errs.amount = "Enter a positive amount with at most 7 decimal places.";
    } else if (!isAmountWithinBalance(amount, spendable)) {
      errs.amount = `Amount exceeds your spendable balance (${spendable} after reserves).`;
    }
    if (memo && !isValidMemo(memo)) {
      errs.memo = "Memo must be at most 28 bytes.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToReview = async () => {
    setError(null);
    if (!validateFields()) return;
    setStage("review");
    try {
      setFeeXlm(estimateFeeXlm(1, await fetchBaseFee()));
    } catch (e) {
      console.error(e);
      setFeeXlm(null);
      setError("Could not estimate the network fee. You can still continue.");
    }
  };

  const confirmSend = async () => {
    if (!account || !publicKey) return;
    if (!validateFields()) {
      setStage("form");
      return;
    }
    setStage("sending");
    setError(null);
    try {
      const asset = selected?.balance;
      if (!asset) throw new Error("Select an asset to send.");
      const tx = buildSendTransaction({
        source: publicKey,
        sequence: account.sequence,
        destination: destination.trim(),
        assetCode: asset.assetCode,
        assetIssuer: asset.assetIssuer,
        amount: amount.trim(),
        memo: memo || undefined,
        spendable,
      });
      const hash = await signAndSubmit(tx);
      setTxHash(hash);
      setStage("done");
      // Rate-limited balance refresh (never faster than 10s).
      if (Date.now() - lastRefresh > MIN_REFRESH_INTERVAL_MS) {
        setLastRefresh(Date.now());
        void refresh();
      }
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
      setStage("review");
    }
  };

  const reset = () => {
    setDestination("");
    setAmount("");
    setMemo("");
    setAssetKey("native");
    setFieldErrors({});
    setTxHash(null);
    setError(null);
    setStage("form");
  };

  if (stage === "done" && txHash) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardTitle>Payment sent</CardTitle>
        <p className="text-sm text-success">The network accepted your transaction.</p>
        <p className="mt-3 break-all font-mono text-xs text-dim">{txHash}</p>
        <div className="mt-4 flex justify-center gap-3">
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blush-500 hover:text-blush-600"
          >
            View in explorer →
          </a>
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={reset}>
            Send another
          </Button>
        </div>
      </Card>
    );
  }

  if (stage === "review" || stage === "sending") {
    return (
      <Card className="mx-auto max-w-md">
        <CardTitle>Review payment</CardTitle>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-dim">To</dt>
            <dd className="break-all font-mono text-xs text-ink">{destination.trim()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Asset</dt>
            <dd className="text-ink">{selected?.label ?? assetKey}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Amount</dt>
            <dd className="font-medium text-ink">{amount.trim()}</dd>
          </div>
          {memo && (
            <div className="flex justify-between gap-4">
              <dt className="text-dim">Memo</dt>
              <dd className="text-ink">{memo}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-dim">Estimated network fee</dt>
            <dd className="text-ink">{feeXlm ? `${feeXlm} XLM` : "unknown"}</dd>
          </div>
        </dl>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setStage("form")}
            disabled={stage === "sending"}
          >
            Back
          </Button>
          <Button onClick={() => void confirmSend()} disabled={stage === "sending"}>
            {stage === "sending"
              ? "Waiting for Freighter…"
              : `Confirm on ${stellarConfig.name}`}
          </Button>
        </div>
        <p className="mt-3 text-xs text-dim">
          You will approve this transaction in the Freighter popup. If the recipient has
          no trustline for this asset, the network will reject the payment and Nyx will
          explain why.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Send on {stellarConfig.name}</CardTitle>
      <div className="flex flex-col gap-4">
        <Input
          label="Destination address"
          placeholder="G…"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          error={fieldErrors.destination}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="asset" className="text-sm font-medium text-ink">
            Asset
          </label>
          <select
            id="asset"
            value={assetKey}
            onChange={(e) => setAssetKey(e.target.value)}
            className="rounded-xl border border-blush-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-blush-400"
          >
            {assetOptions.length === 0 && <option value="native">XLM (lumens)</option>}
            {assetOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} ({o.balance.total})
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Amount"
          placeholder="0.0000000"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={fieldErrors.amount}
          hint={`Spendable: ${spendable}`}
        />
        <Input
          label="Memo (optional)"
          placeholder="Up to 28 bytes"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          error={fieldErrors.memo}
        />
        {error && stage === "form" && <p className="text-sm text-danger">{error}</p>}
        <div>
          <Button
            onClick={() => void goToReview()}
            disabled={status === "loading" || !account}
          >
            Review payment
          </Button>
        </div>
      </div>
    </Card>
  );
}
