/**
 * Nyx Next.js configuration.
 *
 * Note: Next 14 loads config only from `next.config.js`/`.mjs`, so this file
 * stays JavaScript even though the app itself is strict TypeScript.
 *
 * The app runs entirely against Horizon over HTTPS and holds only an
 * encrypted keystore blob in localStorage, so the production CSP is strict:
 * no remote scripts, no frames, no form targets, and network access limited
 * to the Horizon/Friendbot origins the app actually calls.
 *
 * 'unsafe-inline' for scripts and styles is required by Next.js itself: it
 * injects inline bootstrap scripts and optimizes Tailwind's single
 * stylesheet into inline form. There is no dangerouslySetInnerHTML anywhere
 * in the app, so inline-script capability is the residual risk rather than
 * app-generated markup.
 *
 * In development 'unsafe-eval' is added because the Next dev server
 * evaluates scripts at runtime for HMR; without it the dev experience breaks.
 */

const IS_PROD = process.env.NODE_ENV === "production";

/** Origins the client is allowed to fetch from. */
const CONNECT_SRC = [
  "'self'",
  // Horizon + Friendbot, both networks so a mainnet deploy needs no CSP edit.
  "https://horizon-testnet.stellar.org",
  "https://horizon.stellar.org",
  "https://friendbot.stellar.org",
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_PROD ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src ${CONNECT_SRC}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
