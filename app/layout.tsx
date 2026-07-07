import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { anton, grotesk, jetbrainsMono, inter } from "./fonts";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "PRAHARI · MP Cyber Cell — Dark-Web Threat Intelligence",
  description:
    "PRAHARI (प्रहरी) — Dark-Web Threat Intelligence & Geofencing Control Room for the Madhya Pradesh Police Cyber Cell, Jabalpur. Content-based geospatial intelligence, not network deanonymization. Synthetic-data demo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${grotesk.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <body className="crt-lines">
        <div className="tactical-bg" />
        <Providers>{children}</Providers>
        <div className="scanline-overlay" />
      </body>
    </html>
  );
}
