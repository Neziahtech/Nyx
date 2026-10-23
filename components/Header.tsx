"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWallet } from "./WalletProvider";
import { Button } from "./ui/Button";
import { stellarConfig } from "../lib/stellar/config";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/trustlines", label: "Trustlines" },
];

/** Top bar: Nyx wordmark, tab navigation, network badge, connect control. */
export function Header() {
  const pathname = usePathname();
  const { publicKey, status, connect, disconnect } = useWallet();

  return (
    <header className="border-b border-blush-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-blush-500">
            Nyx
          </Link>
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
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-blush-100 px-2.5 py-0.5 text-xs font-medium text-blush-600 sm:inline">
            {stellarConfig.name}
          </span>
          {publicKey ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[10rem] truncate font-mono text-xs text-dim">
                {publicKey.slice(0, 6)}…{publicKey.slice(-6)}
              </span>
              <Button variant="ghost" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={connect} disabled={status === "connecting"}>
              {status === "connecting" ? "Connecting…" : "Connect Freighter"}
            </Button>
          )}
        </div>
      </div>
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
    </header>
  );
}
