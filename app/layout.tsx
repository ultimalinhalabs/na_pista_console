import type { Metadata } from "next";
import { SessionProvider } from "../lib/session/SessionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Na Pista",
  description: "Na Pista — Ideias em Operação.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
