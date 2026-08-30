import type { Metadata } from "next";
import "./globals.css";
import {
  sans, mono, display, displaySora, displayOutfit, monoAlt,
} from "./fonts";
import { SKIN_PICKER_SCRIPT } from "@/lib/skins";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "PRAHARI — Dark-Web Threat Actor Attribution",
  description:
    "Attribution of dark-web threat actors by correlating footprints they leaked into public indexes. Calibrated confidence, published false-merge rate, tamper-evident record. SIH 2026 PS 26151.",
};

const fontVars = [
  sans.variable, mono.variable, display.variable,
  displaySora.variable, displayOutfit.variable, monoAlt.variable,
].join(" ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        {/* Pick and apply a skin before first paint — no flash, no layout shift. */}
        <script dangerouslySetInnerHTML={{ __html: SKIN_PICKER_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
