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
        {/*
          Pick and apply a skin before first paint — no flash, no layout shift.

          THE ONLY dangerouslySetInnerHTML in the tree, and the only inline
          script. It is safe because SKIN_PICKER_SCRIPT is a module constant
          built from a hardcoded skin registry: no user input, no request data
          and no engine response reaches it. It must be inline and synchronous
          — an external script would paint the default palette first and then
          repaint, which is the flash this exists to prevent.

          The INV-6 lint rule fires here by design. Disabling it at this single
          site keeps the exception greppable; a blanket allowance would let the
          next one in silently, which is how FINDING-02 happened.
        */}
        {/* eslint-disable-next-line no-restricted-syntax -- documented INV-6 exception, see above */}
        <script dangerouslySetInnerHTML={{ __html: SKIN_PICKER_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
