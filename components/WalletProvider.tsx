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
  connectWallet,
  ensureCorrectNetwork,
  restoreConnection,
  signWithWallet,
  watchWalletChanges,
  UserRejectedError,
} from "../lib/stellar/wallet";
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
import { stellarConfig } from "../lib/stellar/config";

/** Shared wallet session: connection state, balances, and the sign+submit flow. */
interface WalletContextValue {
  publicKey: string | null;
  account: AccountRecord | null;
  balances: Balance[];
  reserve: ReserveInfo | null;
  /** The account has no on-chain record yet (needs funding). */
  notFunded: boolean;
  status: "disconnected" | "connecting" | "loading" | "ready" | "error";
  /** Plain-language error for the UI; raw details go to console.error. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: (key?: string) => Promise<void>;
  /** Sign via Freighter and submit; returns the transaction hash. */
  signAndSubmit: (tx: Transaction) => Promise<string>;
  friendlyError: (e: unknown) => string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [reserve, setReserve] = useState<ReserveInfo | null>(null);
  const [notFunded, setNotFunded] = useState(false);
  const [status, setStatus] = useState<WalletContextValue["status"]>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  keyRef.current = publicKey;

  const friendlyError = useCallback((e: unknown): string => {
    if (e instanceof UserRejectedError) return e.message;
    return e instanceof Error ? e.message : "Something went wrong.";
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

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const key = await connectWallet();
      await ensureCorrectNetwork();
      setPublicKey(key);
      keyRef.current = key;
      await refresh(key);
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
      setStatus("disconnected");
    }
  }, [friendlyError, refresh]);

  const disconnect = useCallback(() => {
    // Freighter keeps its own authorization; Nyx only clears local session state.
    setPublicKey(null);
    setAccount(null);
    setBalances([]);
    setReserve(null);
    setNotFunded(false);
    setError(null);
    setStatus("disconnected");
  }, []);

  const signAndSubmit = useCallback(async (tx: Transaction): Promise<string> => {
    await ensureCorrectNetwork();
    const signedXdr = await signWithWallet(tx.toXDR());
    return submitSignedTransaction(signedXdr);
  }, []);

  // Restore an existing Freighter authorization on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await restoreConnection().catch((e) => {
        console.error(e);
        return null;
      });
      if (key && !cancelled) {
        setPublicKey(key);
        keyRef.current = key;
        await refresh(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Re-read the account when the user switches accounts or networks in Freighter.
  useEffect(() => {
    if (!publicKey) return;
    const stop = watchWalletChanges(({ address, networkPassphrase }) => {
      if (address !== keyRef.current) {
        setPublicKey(address);
        keyRef.current = address;
        void refresh(address);
        return;
      }
      if (networkPassphrase !== stellarConfig.networkPassphrase) {
        setError(
          `Freighter switched to another network. Nyx runs on "${stellarConfig.name}" — switch back in Freighter, then refresh.`
        );
        setStatus("error");
      } else {
        void refresh(address);
      }
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const value = useMemo(
    () => ({
      publicKey,
      account,
      balances,
      reserve,
      notFunded,
      status,
      error,
      connect,
      disconnect,
      refresh,
      signAndSubmit,
      friendlyError,
    }),
    [
      publicKey,
      account,
      balances,
      reserve,
      notFunded,
      status,
      error,
      connect,
      disconnect,
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
