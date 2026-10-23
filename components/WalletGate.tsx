"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWallet } from "./WalletProvider";

/** Routes that work without an unlocked session. */
const PUBLIC_PATHS = ["/create", "/unlock"];

/**
 * Client-side redirect rules for the self-custody wallet: no wallet stored
 * -> /create, wallet stored but locked -> /unlock. Protected pages render
 * nothing until the session is unlocked, so their components can assume a
 * public key exists. localStorage is browser-only, so this must be a client
 * component; middleware cannot see the keystore blob.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { walletStatus } = useWallet();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (walletStatus === "checking" || isPublic) return;
    if (walletStatus === "none") router.replace("/create");
    else if (walletStatus === "locked") router.replace("/unlock");
  }, [walletStatus, isPublic, router]);

  if (isPublic) return <>{children}</>;

  if (walletStatus !== "unlocked") {
    // Being redirected; render nothing rather than a flash of protected data.
    return null;
  }
  return <>{children}</>;
}
