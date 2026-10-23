"use client";

import { BalanceList } from "../components/BalanceList";
import { HistoryList } from "../components/HistoryList";
import { ConnectPrompt } from "../components/ConnectPrompt";
import { Button } from "../components/ui/Button";
import { useWallet } from "../components/WalletProvider";

/** Dashboard: connect state, balances with reserves, and recent activity. */
export default function DashboardPage() {
  const { publicKey, status, error, refresh } = useWallet();

  if (!publicKey) return <ConnectPrompt />;

  return (
    <div className="flex flex-col gap-5">
      {status === "error" && error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">{error}</p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        </div>
      )}
      <BalanceList />
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>
      <HistoryList />
    </div>
  );
}
