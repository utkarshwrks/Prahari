import type { Metadata } from "next";
import "./globals.css";
import { sans, mono, display } from "./fonts";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "PRAHARI — Dark-Web Threat Actor Attribution",
  description:
    "Attribution of dark-web threat actors by correlating footprints they leaked into public indexes. Calibrated confidence, published false-merge rate, tamper-evident record. SIH 2026 PS 26151.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
