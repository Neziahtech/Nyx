import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import "./globals.css";
import { Header } from "../components/Header";
import { WalletProvider } from "../components/WalletProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nyx — Stellar wallet",
  description:
    "A soft, clean Stellar wallet: send and receive XLM and custom assets on testnet.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <WalletProvider>
          <Header />
          <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
