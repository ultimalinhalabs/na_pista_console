import type { Metadata } from "next";
import { SessionProvider } from "../lib/session/SessionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Na Pista",
  description: "Na Pista — product management",
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
