import { Networks } from "@stellar/stellar-sdk";

import { env, type StellarNetwork } from "../env";

/**
 * All network-dependent settings for Nyx, in one place.
 *
 * The active network comes from `NEXT_PUBLIC_STELLAR_NETWORK`; switching
 * between testnet and mainnet is a config/deploy change, not a code change.
 */
export interface NetworkSettings {
  /** Human-readable network name. */
  name: StellarNetwork;
  /** Horizon REST endpoint for reads and transaction submission. */
  horizonUrl: string;
  /** Stellar network passphrase, used when building and signing transactions. */
  networkPassphrase: string;
  /** Base URL of the block explorer, for transaction and account links. */
  explorerBaseUrl: string;
  /** Friendbot funding endpoint (testnet only; null on mainnet). */
  friendbotUrl: string | null;
}

const NETWORKS: Record<StellarNetwork, NetworkSettings> = {
  testnet: {
    name: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET, // "Test SDF Network ; September 2015"
    explorerBaseUrl: "https://stellar.expert/explorer/testnet",
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    name: "mainnet",
    // Mainnet values (used when NEXT_PUBLIC_STELLAR_NETWORK=mainnet):
    //   Horizon:    https://horizon.stellar.org
    //   Passphrase: "Public Global Stellar Network ; September 2015"
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    explorerBaseUrl: "https://stellar.expert/explorer/public",
    friendbotUrl: null, // no faucet on mainnet
  },
};

/** The settings for whichever network `NEXT_PUBLIC_STELLAR_NETWORK` selects. */
export const stellarConfig: NetworkSettings = NETWORKS[env.network];

/** Build a link to a transaction in the explorer. */
export function explorerTxUrl(hash: string): string {
  return `${stellarConfig.explorerBaseUrl}/tx/${hash}`;
}

/** Build a link to an account in the explorer. */
export function explorerAccountUrl(address: string): string {
  return `${stellarConfig.explorerBaseUrl}/account/${address}`;
}
