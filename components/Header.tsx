"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useWallet } from "./WalletProvider";
import { Button } from "./ui/Button";
import { stellarConfig } from "../lib/stellar/config";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/trustlines", label: "Trustlines" },
];

/**
 * Top bar: Nyx wordmark, tab navigation, network badge, and the session
 * controls. "Lock" keeps the wallet but clears the key from memory;
 * "Log out" erases the stored wallet and requires confirming you hold the
 * secret key backup, because it is otherwise unrecoverable.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { publicKey, walletStatus, lock, logout } = useWallet();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const isCreate = pathname === "/create" || pathname === "/unlock";

  const doLogout = () => {
    logout();
    setConfirmOpen(false);
    setAcknowledged(false);
    router.replace("/create");
  };

  return (
    <header className="border-b border-blush-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-blush-500">
            Nyx
          </Link>
          {!isCreate && (
            <nav className="hidden items-center gap-1 sm:flex">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
                    pathname === tab.href
                      ? "bg-blush-100 font-medium text-blush-600"
                      : "text-dim hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-blush-100 px-2.5 py-0.5 text-xs font-medium text-blush-600 sm:inline">
            {stellarConfig.name}
          </span>
          {publicKey && (
            <div className="flex items-center gap-2">
              <span className="max-w-[10rem] truncate font-mono text-xs text-dim">
                {publicKey.slice(0, 6)}…{publicKey.slice(-6)}
              </span>
              <Button variant="ghost" onClick={lock}>
                Lock
              </Button>
              <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
                Log out
              </Button>
            </div>
          )}
        </div>
      </div>
      {!isCreate && walletStatus === "unlocked" && (
        <nav className="flex items-center gap-1 border-t border-blush-200 px-4 py-2 sm:hidden">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-xl px-3 py-1.5 text-sm ${
                pathname === tab.href
                  ? "bg-blush-100 font-medium text-blush-600"
                  : "text-dim"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Log out of Nyx"
        >
          <div className="w-full max-w-md rounded-xl border border-blush-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Log out of Nyx?</h2>
            <p className="mt-2 text-sm text-ink">
              This deletes the encrypted wallet from this browser. Without your secret
              key, the account and any funds on it are gone forever — there is no password
              recovery in a self-custody wallet.
            </p>
            <p className="mt-2 text-sm font-medium text-danger">
              Back up your secret key first if you have not already.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 accent-blush-500"
              />
              I have saved my secret key somewhere safe.
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmOpen(false);
                  setAcknowledged(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" disabled={!acknowledged} onClick={doLogout}>
                Delete wallet and log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
