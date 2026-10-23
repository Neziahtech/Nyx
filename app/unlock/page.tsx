"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../../components/ui/Button";
import { Card, CardTitle } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useWallet } from "../../components/WalletProvider";
import { INACTIVITY_TIMEOUT_MS } from "../../lib/wallet/session";
import {
  KeystoreMissingError,
  storedPublicKey,
  unlockWithPassword,
} from "../../lib/wallet/wallet";
import { KeystoreCorruptedError } from "../../lib/wallet/storage";
import { WalletPasswordError } from "../../lib/wallet/keystore";

/**
 * Unlock screen: decrypts the stored wallet blob with the user's password
 * and opens an in-memory session. A wrong password and damaged data show
 * the same generic message. If no wallet exists here, the user is sent to
 * /create.
 */
export default function UnlockPage() {
  const router = useRouter();
  const { friendlyError } = useWallet();

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [corrupted, setCorrupted] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Read the stored wallet's identity (never its key material) on mount.
  useEffect(() => {
    try {
      const stored = storedPublicKey();
      if (stored === null) {
        router.replace("/create");
        return;
      }
      setPublicKey(stored);
    } catch (e) {
      if (e instanceof KeystoreCorruptedError || e instanceof KeystoreMissingError) {
        setCorrupted(true);
        return;
      }
      console.error(e);
      setError(friendlyError(e));
    }
  }, [router, friendlyError]);

  const minutes = Math.round(INACTIVITY_TIMEOUT_MS / 60_000);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockWithPassword(password);
      setPassword("");
      router.replace("/");
    } catch (e) {
      console.error(e);
      // WalletPasswordError already carries a generic, non-revealing message.
      setError(
        e instanceof WalletPasswordError
          ? e.message
          : e instanceof KeystoreCorruptedError || e instanceof KeystoreMissingError
            ? e.message
            : friendlyError(e)
      );
    } finally {
      setBusy(false);
    }
  };

  if (corrupted) {
    return (
      <Card className="mx-auto max-w-md">
        <CardTitle>Wallet data unreadable</CardTitle>
        <p className="text-sm text-ink">
          The stored wallet data is damaged and cannot be decrypted. If you have your
          secret key backed up, you can create or import a fresh wallet — this replaces
          the damaged data.
        </p>
        <div className="mt-4">
          <Button onClick={() => router.replace("/create")}>Set up a wallet</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardTitle>Unlock your wallet</CardTitle>
      {publicKey && (
        <p className="text-sm text-dim">
          Stored account:{" "}
          <span className="font-mono text-xs text-ink">
            {publicKey.slice(0, 8)}…{publicKey.slice(-8)}
          </span>
        </p>
      )}
      <div className="mt-4 flex flex-col gap-4">
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <Button onClick={() => void submit()} disabled={busy || password.length === 0}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
        <p className="text-xs text-dim">
          The key stays in memory only while unlocked and locks itself after {minutes}{" "}
          minutes of inactivity or when this tab closes. Password recovery does not exist
          — your secret key backup is the only way back in.
        </p>
      </div>
    </Card>
  );
}
