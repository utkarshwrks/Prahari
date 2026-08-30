import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

export const sans = Inter({
  subsets: ["latin"], variable: "--font-sans", display: "swap",
});
export const mono = JetBrains_Mono({
  subsets: ["latin"], variable: "--font-mono", display: "swap",
});
export const display = Space_Grotesk({
  subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500","600","700"],
});
