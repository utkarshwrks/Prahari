import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import PublicShell from "@/components/public/PublicShell";
import DocsSidebar, { DocSection } from "@/components/docs/DocsSidebar";
import Faq from "@/components/docs/Faq";

export const metadata: Metadata = {
  title: "Docs · PRAHARI",
  description:
    "PRAHARI documentation — overview, the intelligence pipeline, how to use the console, features, tech stack and FAQ.",
};

const SECTIONS: DocSection[] = [
  { id: "overview", label: "Overview & Thesis" },
  { id: "how-it-works", label: "How It Works" },
  { id: "how-to-use", label: "How To Use" },
  { id: "features", label: "Features Reference" },
  { id: "tech-stack", label: "Tech Stack" },
  { id: "faq", label: "FAQ" },
];

function DocSectionBlock({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border py-12 first:pt-0">
      <div className="mono mb-2 text-[11px] uppercase tracking-[0.22em] text-red-bright">
        {kicker}
      </div>
      <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

const PIPELINE = [
  ["Ingest", "Continuously monitor marketplace, forum, paste and bridge sources. In this build the source is a synthetic generator; in production it is a single swap to a real ingestion feed."],
  ["Extract", "Named-Entity Recognition pulls four entity classes from each intercept: locations, contraband categories, crypto wallets and @handles — pre-tagged deterministically for the feed, and live via the NER analyzer."],
  ["Geofence", "Every stated city is matched against the Jabalpur jurisdiction (a ~60km ring). In-zone hits (Jabalpur, Katni, Narsinghpur) are breaches; other MP cities are watched at lower severity."],
  ["Alert", "A breach fires a non-overlapping red alert, drops a siren ring on the map, escalates the threat level and appends to the persistent Alert Log so nothing is lost."],
  ["Report", "Wallet reuse and handle repetition correlate otherwise-separate sellers into clusters; the Alert Log exports to JSON as an actionable lead for an officer."],
];

const HOWTO = [
  ["Log in — one click", "On the login page press the big “Use Demo Account” button. That's it, you're inside. (To type it instead: email officer@mp.gov.in, password prahari123.)"],
  ["Take the guided tour", "The first time you enter, a short walkthrough pops up and points at each part of the screen. Press Next to move along or Skip to jump in. You can replay it anytime from the user menu at the top-right."],
  ["Watch the feed on the left", "A live list of dark-web adverts, newest on top. For each one, PRAHARI automatically highlights the city, the item being sold, the crypto wallet and the @username."],
  ["Watch the map in the middle", "A map of Madhya Pradesh with red rings around Jabalpur. If an advert names a city inside those rings, that spot flashes red and an alarm goes off — that's a “breach”."],
  ["Try the analyzer (the fun part)", "Below the map is a box where you can paste ANY sentence, like “selling LSD in Jabalpur, contact @rocky”. Press Analyze and watch PRAHARI pull out the details and drop a pin on the map."],
  ["Check the numbers on the right", "The right side keeps score: how many adverts came in, how many breaches happened, which wallets and usernames keep appearing, and what kinds of items are being sold."],
  ["Open the notification bell", "The bell icon at the top (with a red number) is your alert inbox. Click it to see every breach, then click any alert to open its full details."],
  ["Manage an alert like a case", "Inside an alert you can set its status (New → Acknowledged → Investigating → Closed), assign it to an officer and write a note. This turns a warning into a trackable case."],
  ["Save a report", "In the Alert Log press JSON to download all alerts as a file, or REPORT to open a clean printable page you can hand to a senior officer."],
  ["Demo Mode switch", "The DEMO switch at the top makes adverts arrive faster and guarantees a Jabalpur alarm within 20 seconds — perfect for a live demo. Turn it off for a slower, realistic pace."],
];

const FEATURES = [
  ["Live Intel Feed", "Auto-scrolling synthetic intercepts with source badges, relative timestamps, entity chips and a severity bar."],
  ["Geospatial Command", "React-Leaflet dark map, ten MP city markers, the pulsing Jabalpur geofence, marker pulses, siren rings and threat-heat glow."],
  ["Threat Analytics", "Animated counters, a recharts contraband breakdown and a 24h activity sparkline with a spike marker."],
  ["Jabalpur Zone Monitor", "Zone threat level, in-zone breach count, a neighbour-ring watch and a local handle watchlist."],
  ["Live NER Analyzer", "A server route that uses Groq when a key is present and a local regex/gazetteer engine otherwise — always returning results."],
  ["Wallet Cluster Tracker", "Recurring wallet addresses ranked by how many listings they appear in — reuse links separate sellers."],
  ["Alert Log", "Every breach in one chronological list with JSON export and a printable report, so nothing is ever lost."],
  ["Notification Center", "A bell with an unread badge opens an alert inbox. Filter by severity/status and open any alert for its full detail."],
  ["Case Management", "On each alert: set a status (New/Acknowledged/Investigating/Closed), assign an officer, add a note, and re-ping it on the map."],
  ["Guided Tutorial", "A first-use walkthrough spotlights every feature with Next/Skip — replayable anytime from the user menu."],
];

const STACK = [
  ["Next.js 14 (App Router) + TypeScript", "The application framework and type system."],
  ["Tailwind CSS", "The design system — red/white/black tactical tokens on an 8px grid."],
  ["NextAuth.js (Credentials)", "Free, offline authentication with a seeded demo officer account."],
  ["react-leaflet + CartoDB dark_matter", "The map and free dark tiles — no API key required."],
  ["Sonner", "Stacked, non-overlapping breach toasts."],
  ["zustand", "Global intel state, the streamer and derived counters."],
  ["recharts", "Contraband bars and the activity sparkline."],
  ["framer-motion + lucide-react", "Animations and icons."],
  ["Groq (llama-3.3-70b-versatile), optional", "Live NER — with a local fallback so it runs at $0."],
];

export default function DocsPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="mb-10">
          <h1 className="font-display text-5xl uppercase tracking-tight text-white sm:text-6xl">
            Documentation
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Everything you need to understand, run and demo PRAHARI.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* sidebar */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <DocsSidebar sections={SECTIONS} />
          </aside>

          {/* content */}
          <div>
            <DocSectionBlock id="overview" kicker="01" title="Overview — in plain words">
              <p>
                Think of PRAHARI (प्रहरी means “the sentinel”) as a tireless guard
                for the Jabalpur cyber cell. Criminals post adverts on the dark web
                to sell drugs, weapons, stolen ID data and fake currency — and they
                openly say <span className="text-text">where they deliver</span>.
              </p>
              <p>
                PRAHARI reads those adverts, picks out the city, and checks it
                against a map of Jabalpur. If the city is inside Jabalpur's area, it
                sounds an alarm so an officer can act. It also notices when the same
                crypto wallet or username keeps appearing, which links different
                criminals together.
              </p>
              <p>
                <span className="text-text">Important:</span> the dark web hides
                <em> who </em> posted an advert, and PRAHARI never pretends to unmask
                that. It only uses the locations criminals write down themselves.
                That makes it honest, legal and genuinely useful.
              </p>
              <div className="panel border-l-2 border-l-red p-4">
                <span className="mono text-[11px] uppercase tracking-widest text-red-bright">
                  Key point
                </span>
                <p className="mt-1 text-text">
                  Content-based geospatial threat intelligence — not network
                  deanonymization.
                </p>
              </div>
            </DocSectionBlock>

            <DocSectionBlock id="how-it-works" kicker="02" title="How It Works — the 5-stage pipeline">
              <ol className="space-y-4">
                {PIPELINE.map(([t, b], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="mono flex h-8 w-8 shrink-0 items-center justify-center border border-red bg-red/10 text-sm font-bold text-red-bright">
                      {i + 1}
                    </span>
                    <div>
                      <div className="mono text-sm uppercase tracking-[0.12em] text-white">
                        {t}
                      </div>
                      <p className="mt-1 text-sm text-muted">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </DocSectionBlock>

            <DocSectionBlock id="how-to-use" kicker="03" title="How To Use">
              <ol className="space-y-3">
                {HOWTO.map(([t, b], i) => (
                  <li key={t} className="border border-border bg-panel p-4">
                    <div className="mono text-sm uppercase tracking-[0.1em] text-red-bright">
                      Step {i + 1} · {t}
                    </div>
                    <p className="mt-1.5 text-sm text-muted">{b}</p>
                  </li>
                ))}
              </ol>
            </DocSectionBlock>

            <DocSectionBlock id="features" kicker="04" title="Features Reference">
              <div className="divide-y divide-border border border-border">
                {FEATURES.map(([t, b]) => (
                  <div key={t} className="grid gap-1 p-4 sm:grid-cols-[220px_1fr]">
                    <div className="mono text-sm uppercase tracking-[0.1em] text-white">
                      {t}
                    </div>
                    <p className="text-sm text-muted">{b}</p>
                  </div>
                ))}
              </div>
            </DocSectionBlock>

            <DocSectionBlock id="tech-stack" kicker="05" title="Tech Stack">
              <p>Everything is free and open-source or a free tier.</p>
              <div className="divide-y divide-border border border-border">
                {STACK.map(([t, b]) => (
                  <div key={t} className="grid gap-1 p-4 sm:grid-cols-[300px_1fr]">
                    <div className="mono text-[13px] text-red-bright">{t}</div>
                    <p className="text-sm text-muted">{b}</p>
                  </div>
                ))}
              </div>
            </DocSectionBlock>

            <DocSectionBlock id="faq" kicker="06" title="FAQ">
              <Faq />
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn btn-primary">
                  Launch Console <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="/about" className="btn btn-ghost">
                  About the Mission
                </Link>
              </div>
            </DocSectionBlock>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
