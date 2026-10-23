"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Transaction } from "@stellar/stellar-sdk";

import {
  loadAccount,
  getBalances,
  getReserveInfo,
  AccountNotFundedError,
  type AccountRecord,
  type Balance,
  type ReserveInfo,
} from "../lib/stellar/account";
import { submitSignedTransaction } from "../lib/stellar/payments";
import {
  WalletLockedError,
  getPublicKey as sessionPublicKey,
  isUnlocked,
  lockSession,
  signTransactionXdr,
  startSessionWatchers,
  subscribeSession,
} from "../lib/wallet/session";
import { logoutWallet, walletStored } from "../lib/wallet/wallet";

/**
 * Where the self-custody wallet is in its lifecycle, independent of the
 * Horizon account state. The gate in `WalletGate` routes on this value.
 */
type WalletStatus = "checking" | "none" | "locked" | "unlocked";

/** Horizon/account state shown on the dashboard once unlocked. */
type AccountStatus = "loading" | "ready" | "error";

/** Shared wallet session: keystore presence, unlock state, balances, signing. */
interface WalletContextValue {
  /** The unlocked wallet's G-address, or null while locked/unstored. */
  publicKey: string | null;
  walletStatus: WalletStatus;
  account: AccountRecord | null;
  balances: Balance[];
  reserve: ReserveInfo | null;
  /** The account has no on-chain record yet (needs funding). */
  notFunded: boolean;
  status: AccountStatus;
  /** Plain-language error for the UI; raw details go to console.error. */
  error: string | null;
  /** Lock the session now; the gate routes to /unlock. */
  lock: () => void;
  /** Erase the stored wallet and lock. UI must confirm the backup first. */
  logout: () => void;
  refresh: (key?: string) => Promise<void>;
  /** Sign with the in-memory key and submit; returns the transaction hash. */
  signAndSubmit: (tx: Transaction) => Promise<string>;
  friendlyError: (e: unknown) => string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [reserve, setReserve] = useState<ReserveInfo | null>(null);
  const [notFunded, setNotFunded] = useState(false);
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  keyRef.current = publicKey;

  const friendlyError = useCallback((e: unknown): string => {
    if (e instanceof WalletLockedError) return e.message;
    return e instanceof Error ? e.message : "Something went wrong.";
  }, []);

  /** Recompute lifecycle status from the keystore + session singletons. */
  const readWalletStatus = useCallback((): WalletStatus => {
    if (!walletStored()) return "none";
    if (!isUnlocked()) return "locked";
    return "unlocked";
  }, []);

  const refresh = useCallback(
    async (key?: string) => {
      const address = key ?? keyRef.current;
      if (!address) return;
      setStatus("loading");
      setError(null);
      try {
        const loaded = await loadAccount(address);
        setAccount(loaded);
        setBalances(getBalances(loaded));
        setReserve(getReserveInfo(loaded));
        setNotFunded(false);
        setStatus("ready");
      } catch (e) {
        if (e instanceof AccountNotFundedError) {
          setAccount(null);
          setBalances([]);
          setReserve(null);
          setNotFunded(true);
          setStatus("ready");
          return;
        }
        console.error(e);
        setError(friendlyError(e));
        setStatus("error");
      }
    },
    [friendlyError]
  );

  const clearAccountState = useCallback(() => {
    setAccount(null);
    setBalances([]);
    setReserve(null);
    setNotFunded(false);
    setError(null);
  }, []);

  /**
   * Sync React state with the session singletons. Runs on mount, on every
   * lock/unlock transition (including the inactivity auto-lock), and after
   * unlock navigations.
   */
  const syncFromSession = useCallback(() => {
    const next = readWalletStatus();
    setWalletStatus(next);
    if (next === "unlocked") {
      const key = sessionPublicKey();
      if (key) {
        setPublicKey(key);
        keyRef.current = key;
        void refresh(key);
      }
    } else {
      setPublicKey(null);
      keyRef.current = null;
      clearAccountState();
    }
  }, [clearAccountState, readWalletStatus, refresh]);

  // Initial read + subscriptions. Key material never passes through here;
  // only the public address and lock state do.
  useEffect(() => {
    syncFromSession();
    const stopListener = subscribeSession(syncFromSession);
    const stopWatchers = startSessionWatchers();
    return () => {
      stopListener();
      stopWatchers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lock = useCallback(() => {
    lockSession();
  }, []);

  const logout = useCallback(() => {
    logoutWallet();
    setWalletStatus("none");
    setPublicKey(null);
    clearAccountState();
  }, [clearAccountState]);

  const signAndSubmit = useCallback(async (tx: Transaction): Promise<string> => {
    // Throws WalletLockedError if the session auto-locked mid-form; the gate
    // then routes to /unlock.
    const signedXdr = signTransactionXdr(tx.toXDR());
    return submitSignedTransaction(signedXdr);
  }, []);

  const value = useMemo(
    () => ({
      publicKey,
      walletStatus,
      account,
      balances,
      reserve,
      notFunded,
      status,
      error,
      lock,
      logout,
      refresh,
      signAndSubmit,
      friendlyError,
    }),
    [
      publicKey,
      walletStatus,
      account,
      balances,
      reserve,
      notFunded,
      status,
      error,
      lock,
      logout,
      refresh,
      signAndSubmit,
      friendlyError,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Access the shared wallet session. Must be used under WalletProvider. */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider.");
  return ctx;
}
