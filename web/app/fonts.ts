import {
  Inter, JetBrains_Mono, Space_Grotesk, Sora, Outfit, IBM_Plex_Mono,
} from "next/font/google";

// Base families, always loaded.
export const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// Display families the skin engine rotates between, for genuine per-load variety.
export const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });
export const displaySora = Sora({ subsets: ["latin"], variable: "--font-display-b", display: "swap", weight: ["500", "600", "700"] });
export const displayOutfit = Outfit({ subsets: ["latin"], variable: "--font-display-c", display: "swap", weight: ["500", "600", "700"] });
export const monoAlt = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono-b", display: "swap", weight: ["400", "500", "600"] });
