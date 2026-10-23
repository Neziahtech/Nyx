// Vitest setup: the app's required env var, mirroring the committed .env.
process.env.NEXT_PUBLIC_STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
