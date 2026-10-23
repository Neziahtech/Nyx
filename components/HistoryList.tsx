"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Card, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useWallet } from "./WalletProvider";
import { explorerTxUrl } from "../lib/stellar/config";
import { fetchHistoryPage, type HistoryEntry } from "../lib/stellar/payments";

/**
 * Recent payments and operations from Horizon, newest first, with
 * cursor-based "Load more" pagination. Received rows use the muted green
 * and sent rows the deep neutral, so debits never read as errors.
 */
export function HistoryList() {
  const { publicKey, status, friendlyError } = useWallet();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (after?: string) => {
      if (!publicKey) return;
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchHistoryPage(publicKey, after);
        if (id !== requestId.current) return; // stale response
        setEntries((prev) => (after ? [...prev, ...page.entries] : page.entries));
        setCursor(page.nextCursor);
      } catch (e) {
        if (id !== requestId.current) return;
        console.error(e);
        setError(friendlyError(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [publicKey, friendlyError]
  );

  useEffect(() => {
    if (publicKey) {
      void load();
    } else {
      setEntries([]);
    }
  }, [publicKey, load]);

  if (!publicKey) return null;

  return (
    <Card>
      <CardTitle>Activity</CardTitle>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {entries.length === 0 && !loading && !error ? (
        <p className="text-sm text-dim">No transactions yet on this account.</p>
      ) : (
        <ul className="divide-y divide-blush-200">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${
                    entry.direction === "received" ? "text-success" : "text-ink"
                  }`}
                >
                  {entry.direction === "received" ? "+" : "−"}
                  {entry.amount} {entry.assetCode === "native" ? "XLM" : entry.assetCode}
                </p>
                <p className="truncate text-xs text-dim">
                  {entry.direction === "received" ? "from" : "to"}{" "}
                  {entry.counterparty.slice(0, 6)}…{entry.counterparty.slice(-4)}
                  {entry.memo ? ` · ${entry.memo}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-dim">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                {!entry.successful ? (
                  <Badge tone="danger">failed</Badge>
                ) : (
                  <a
                    href={explorerTxUrl(entry.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-blush-500 hover:text-blush-600"
                  >
                    view in explorer
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <div className="mt-4 text-center">
          <Button
            variant="secondary"
            onClick={() => void load(cursor ?? undefined)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
      {loading && entries.length === 0 && (
        <p className="mt-2 text-center text-xs text-dim">Loading activity…</p>
      )}
    </Card>
  );
}
