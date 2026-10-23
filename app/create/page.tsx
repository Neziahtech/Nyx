"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../../components/ui/Button";
import { Card, CardTitle } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useWallet } from "../../components/WalletProvider";
import { createWallet, finalizeWallet, isValidSecretKey } from "../../lib/wallet/wallet";
import { MIN_PASSWORD_LENGTH } from "../../lib/wallet/keystore";

/** Which step of the setup flow the user is on. */
type Stage = "choice" | "backup" | "password";

/**
 * Wallet setup: create a brand-new keypair (with a one-time secret key
 * display and explicit backup confirmation) or import an existing secret
 * key, then set the password that encrypts it. The secret key lives in this
 * component's state only until `finalizeWallet` encrypts it; it is never
 * logged, placed in the URL, or stored in plain text.
 */
export default function CreateWalletPage() {
  const router = useRouter();
  const { walletStatus, friendlyError } = useWallet();

  const [stage, setStage] = useState<Stage>("choice");
  const [mode, setMode] = useState<"create" | "import">("create");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const replacing = walletStatus === "locked" || walletStatus === "unlocked";

  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordReady =
    password.length >= MIN_PASSWORD_LENGTH && confirmPassword === password;

  const startCreate = () => {
    setError(null);
    const created = createWallet();
    setMode("create");
    setPublicKey(created.publicKey);
    setSecretKey(created.secretKey);
    setStage("backup");
  };

  const startImport = () => {
    setError(null);
    setImportError(null);
    setMode("import");
    setPublicKey(null);
    setSecretKey(null);
    setStage("password");
  };

  const continueFromBackup = () => {
    if (!confirmedBackup || !secretKey) return;
    setError(null);
    setStage("password");
  };

  const submit = async () => {
    const secret = mode === "create" ? secretKey : importValue.trim();
    if (!secret || !isValidSecretKey(secret)) {
      if (mode === "import") {
        setImportError(
          "That is not a valid Stellar secret key (starts with S, 35 characters)."
        );
      } else {
        setError("The generated key was lost. Start over to create a new wallet.");
      }
      return;
    }
    if (!passwordReady) {
      setError(
        confirmPassword !== password
          ? "The two passwords do not match."
          : `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await finalizeWallet(secret, password);
      // Scrub the plaintext key and password from this component's state.
      setSecretKey(null);
      setImportValue("");
      setPassword("");
      setConfirmPassword("");
      router.replace("/");
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {replacing && stage === "choice" && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-ink">
          This browser already holds a wallet. Creating or importing a new one
          <span className="font-medium"> replaces and erases it</span> — make sure the
          current wallet&apos;s secret key is backed up first.{" "}
          <button
            type="button"
            className="font-medium text-blush-500 hover:text-blush-600"
            onClick={() => router.replace("/unlock")}
          >
            Go to unlock →
          </button>
        </div>
      )}

      {stage === "choice" && (
        <Card>
          <CardTitle>Set up your wallet</CardTitle>
          <p className="text-sm text-dim">
            Nyx generates its own keys and stores them encrypted with a password you
            choose. No browser extension is involved.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={startCreate}>Create a new wallet</Button>
            <Button variant="secondary" onClick={startImport}>
              Import an existing secret key
            </Button>
          </div>
        </Card>
      )}

      {stage === "backup" && publicKey && secretKey && (
        <Card>
          <CardTitle>Your new wallet — write this down now</CardTitle>
          <p className="text-sm text-ink">
            This is the <span className="font-medium">only time</span> Nyx will show your
            secret key. Anyone with this key controls the account; losing it means losing
            any funds held on it.
          </p>
          <ReadOnlyField label="Public key (share to receive funds)" value={publicKey} />
          <div className="mt-3">
            <ReadOnlyField
              label="Secret key (never share, never lose)"
              value={secretKey}
              danger
            />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={confirmedBackup}
              onChange={(e) => setConfirmedBackup(e.target.checked)}
              className="mt-0.5 accent-blush-500"
            />
            I&apos;ve saved my secret key somewhere safe.
          </label>
          <div className="mt-4">
            <Button onClick={continueFromBackup} disabled={!confirmedBackup}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {stage === "password" && (
        <Card>
          <CardTitle>
            {mode === "create" ? "Choose your password" : "Import and protect your key"}
          </CardTitle>
          {mode === "import" && (
            <div className="mb-4">
              <Input
                label="Secret key"
                placeholder="S…"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                error={importError ?? undefined}
                hint="Starts with S, 35 characters. It is encrypted immediately and never stored in plain text."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={`At least ${MIN_PASSWORD_LENGTH} characters. Nyx cannot reset it for you.`}
                autoComplete="new-password"
              />
              <StrengthMeter score={strength.score} label={strength.label} />
            </div>
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={
                confirmPassword.length > 0 && confirmPassword !== password
                  ? "The two passwords do not match."
                  : undefined
              }
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-3">
              {mode === "import" && (
                <Button variant="secondary" onClick={() => setStage("choice")}>
                  Back
                </Button>
              )}
              <Button onClick={() => void submit()} disabled={busy || !passwordReady}>
                {busy ? "Encrypting your wallet…" : "Create wallet"}
              </Button>
            </div>
            <p className="text-xs text-dim">
              Encryption runs in your browser (AES-GCM, 600,000 key-derivation steps),
              which takes a second or two.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Monospace, selectable display for key material with a copy button. */
function ReadOnlyField({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`flex-1 break-all rounded-xl border bg-blush-50 p-3 font-mono text-xs ${
            danger ? "border-danger/40 text-danger" : "border-blush-200 text-ink"
          }`}
        >
          {value}
        </code>
        <Button variant="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

/** UI-only heuristic; the enforced rule is the minimum length. */
function passwordStrength(password: string): { score: number; label: string } {
  if (password.length === 0) return { score: 0, label: "" };
  let score = 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const label = score <= 2 ? "Weak" : score <= 3 ? "Fair" : "Strong";
  return { score, label };
}

function StrengthMeter({ score, label }: { score: number; label: string }) {
  if (score === 0) return null;
  const tone =
    label === "Weak" ? "bg-danger" : label === "Fair" ? "bg-blush-500" : "bg-success";
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`flex-1 rounded-full ${step <= score ? tone : "bg-blush-200"}`}
          />
        ))}
      </div>
      <span className="text-xs text-dim">{label}</span>
    </div>
  );
}
