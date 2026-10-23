/**
 * Environment variable schema and validation.
 *
 * Nyx has exactly one required environment variable, and it must name a
 * known Stellar network. Anything else (missing, empty, or an unknown
 * value) fails fast with a plain-language message so a misconfiguration
 * is obvious at startup rather than at the first Horizon request.
 */

export const SUPPORTED_NETWORKS = ["testnet", "mainnet"] as const;

export type StellarNetwork = (typeof SUPPORTED_NETWORKS)[number];

export interface Env {
  network: StellarNetwork;
}

/** Error thrown when environment validation fails. */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validate a raw environment record (e.g. `process.env`).
 *
 * @param source Map of environment variable names to values.
 * @returns The parsed, typed environment.
 * @throws {EnvValidationError} If `NEXT_PUBLIC_STELLAR_NETWORK` is missing,
 *   empty, or not one of the supported networks.
 */
export function validateEnv(source: Record<string, string | undefined>): Env {
  const raw = source.NEXT_PUBLIC_STELLAR_NETWORK;

  if (raw === undefined || raw.trim() === "") {
    throw new EnvValidationError(
      "Missing environment variable NEXT_PUBLIC_STELLAR_NETWORK. " +
        'Set it to "testnet" or "mainnet" (see .env.example).'
    );
  }

  const value = raw.trim().toLowerCase();

  if (!SUPPORTED_NETWORKS.includes(value as StellarNetwork)) {
    throw new EnvValidationError(
      `Unknown NEXT_PUBLIC_STELLAR_NETWORK value "${raw}". ` +
        `Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`
    );
  }

  return { network: value as StellarNetwork };
}

/**
 * The validated environment for the running app.
 *
 * Throws at import time (startup) if the environment is invalid.
 *
 * Note: Next.js only inlines `NEXT_PUBLIC_*` variables into client bundles
 * when accessed as literal member expressions, so the value is read that
 * way here instead of passing the whole `process.env` object.
 */
export const env: Env = validateEnv({
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
});
