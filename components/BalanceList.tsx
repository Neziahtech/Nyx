"use client";

import { Card, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { useWallet } from "./WalletProvider";
import { compareAmounts, subtractAmounts } from "../lib/stellar/validation";
import { stellarConfig } from "../lib/stellar/config";

/**
 * Balances dashboard card: XLM and issued assets, with the reserved XLM
 * explained so users know why spendable is lower than total.
 */
export function BalanceList() {
  const { balances, reserve, notFunded, publicKey } = useWallet();

  if (notFunded && publicKey) {
    return (
      <Card>
        <CardTitle>Balance</CardTitle>
        <p className="text-sm text-dim">
          This account doesn&apos;t exist on the {stellarConfig.name} network yet. Stellar
          accounts must hold a small starting balance before they can receive anything.
        </p>
        {stellarConfig.friendbotUrl && (
          <a
            className="mt-3 inline-block text-sm font-medium text-blush-500 hover:text-blush-600"
            href={`${stellarConfig.friendbotUrl}?addr=${publicKey}`}
            target="_blank"
            rel="noreferrer"
          >
            Fund this account with Friendbot →
          </a>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Balance</CardTitle>
        {status === "loading" && <span className="text-xs text-dim">Refreshing…</span>}
      </div>
      {balances.length === 0 && status !== "loading" ? (
        <p className="text-sm text-dim">No assets yet.</p>
      ) : (
        <ul className="divide-y divide-blush-200">
          {balances.map((b) => {
            const isXlm = b.assetCode === "native";
            const spendable =
              isXlm && reserve
                ? subtractAmounts(b.total, reserve.totalReserved)
                : b.total;
            const spendablePositive = compareAmounts(spendable, "0") > 0;
            return (
              <li
                key={`${b.assetCode}-${b.assetIssuer ?? "xlm"}`}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {isXlm ? "XLM" : b.assetCode}
                  </span>
                  {!isXlm && <Badge tone="neutral">{b.assetIssuer?.slice(0, 8)}…</Badge>}
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${spendablePositive ? "text-ink" : "text-dim"}`}
                  >
                    {spendable} {isXlm ? "XLM" : b.assetCode}
                  </p>
                  {isXlm && reserve && (
                    <p className="text-xs text-dim">
                      of {b.total} — {reserve.totalReserved} reserved
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {reserve && (
        <p className="mt-3 text-xs text-dim">
          Reserve: {reserve.baseReserveXlm} XLM base + {reserve.perEntryReserveXlm} XLM
          per trustline ({reserve.subentryCount} sub-entries). Reserved XLM can&apos;t be
          sent but is returned when you remove trustlines.
        </p>
      )}
    </Card>
  );
}
