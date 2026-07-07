import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Radio,
  MapPinned,
  ScanSearch,
  Bitcoin,
  BarChart3,
  Siren,
  Database,
  Tags,
  MapPin,
  Bell,
  FileText,
  ShieldCheck,
  IndianRupee,
  Zap,
  WifiOff,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import PublicShell from "@/components/public/PublicShell";
import SectionHeading from "@/components/public/SectionHeading";
import FeedTicker from "@/components/home/FeedTicker";
import InsightDiagram from "@/components/home/InsightDiagram";

const FEATURES = [
  {
    icon: Radio,
    title: "Live Intel Feed",
    body: "A streaming wall of synthetic dark-web intercepts, each auto-tagged for locations, contraband, wallets and handles in real time.",
  },
  {
    icon: MapPinned,
    title: "Jabalpur Geofence",
    body: "A protected jurisdiction ring around Jabalpur. The instant a listing names an in-zone city, the map sirens and a breach fires.",
  },
  {
    icon: ScanSearch,
    title: "Live NER Engine",
    body: "Paste any text and watch entities extract and geolocate live — powered by Groq, with a local engine so it runs at $0.",
  },
  {
    icon: Bitcoin,
    title: "Wallet Clustering",
    body: "Recurring crypto addresses link otherwise-separate sellers. Reuse is a correlation signal — we surface the top clusters.",
  },
  {
    icon: BarChart3,
    title: "Threat Analytics",
    body: "Live counters, contraband category breakdowns and activity spikes turn a noisy feed into a readable threat picture.",
  },
  {
    icon: Siren,
    title: "Alert & Report",
    body: "Non-overlapping breach alerts, a persistent alert log, and one-click export to hand a lead straight to an officer.",
  },
  {
    icon: Bell,
    title: "Notification Center",
    body: "A dedicated alert inbox with an unread badge — open any breach to read its full details and act on it.",
  },
  {
    icon: Briefcase,
    title: "Case Management",
    body: "Set each alert's status, assign it to an officer, and attach investigation notes — built for how a cyber cell actually works.",
  },
  {
    icon: GraduationCap,
    title: "Guided Onboarding",
    body: "A first-use walkthrough tours every feature with Next / Skip — any officer, technical or not, is productive in minutes.",
  },
];

const USPS = [
  {
    icon: ShieldCheck,
    title: "Honest & legal by design",
    body: "We geofence the locations criminals state — never a fake Tor-deanonymization claim. Every lead is auditable to its public source.",
  },
  {
    icon: MapPinned,
    title: "District-first, made for Jabalpur",
    body: "A jurisdiction geofence and neighbour-ring built around Jabalpur, Katni and Narsinghpur — not a national feed that never zooms in.",
  },
  {
    icon: Zap,
    title: "Real-time breach in under 20s",
    body: "The moment an in-zone city is named, the map sirens, the threat level spikes and the officer is alerted — no delay.",
  },
  {
    icon: Bitcoin,
    title: "Correlation, not just detection",
    body: "Recurring wallets and repeated handles link separate listings into the same operation — turning noise into a network.",
  },
  {
    icon: IndianRupee,
    title: "Runs at ₹0",
    body: "Only free and open-source tools and free tiers. A cyber cell can stand it up today with no budget approval.",
  },
  {
    icon: WifiOff,
    title: "Works fully offline",
    body: "The entire core — feed, map, geofence, alerts, analytics — runs with no internet and no API keys. Unbreakable on stage.",
  },
];

const STEPS = [
  { icon: Database, title: "Ingest", body: "Monitor marketplace / forum / paste content (synthetic here)." },
  { icon: Tags, title: "Extract", body: "NER pulls locations, contraband, wallets and handles." },
  { icon: MapPin, title: "Geofence", body: "Match stated cities against the Jabalpur jurisdiction." },
  { icon: Bell, title: "Alert", body: "Fire a breach the moment an in-zone city is named." },
  { icon: FileText, title: "Report", body: "Log, correlate and export an actionable lead." },
];

export default function Home() {
  return (
    <PublicShell>
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 border border-border bg-panel/60 px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulseDot bg-red-bright" />
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted">
                MP Cyber Cell · Jabalpur Control Room
              </span>
            </div>

            <h1 className="font-display text-6xl uppercase leading-[0.9] tracking-tight text-white sm:text-7xl xl:text-8xl">
              See the threats
              <br />
              that <span className="text-red-bright">hide</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              PRAHARI is content-based geospatial threat intelligence for the
              Madhya Pradesh Police Cyber Cell. We geofence the locations
              criminals <span className="text-text">state themselves</span> — we
              do not, and cannot, deanonymize the Tor network.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-primary">
                Launch Console <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/docs" className="btn btn-ghost">
                <BookOpen className="h-4 w-4" /> Read the Docs
              </Link>
            </div>

            {/* stat strip */}
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-px border border-border bg-border">
              {[
                { n: "10", l: "MP Cities Watched" },
                { n: "60KM", l: "Jabalpur Geofence" },
                { n: "$0", l: "Cost To Run" },
              ].map((s) => (
                <div key={s.l} className="bg-panel px-4 py-3">
                  <div className="mono text-2xl font-bold text-red-bright">
                    {s.n}
                  </div>
                  <div className="mono mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-2">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* live preview */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 bg-[radial-gradient(circle,rgba(225,6,0,0.14),transparent_70%)]" />
            <div className="relative">
              <FeedTicker />
              <div className="mono mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-2">
                Live preview · synthetic intercepts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== PROBLEM ===================== */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="The Problem"
            title="Dark-web crime reaches MP —"
            accent="invisible to local police."
            sub="Narcotics, weapon parts, stolen Aadhaar/PAN dumps and counterfeit currency are advertised openly on Tor marketplaces, naming Indian cities as delivery points. National tools don't watch a single district's streets, and local cyber cells have no console built for the last mile."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { k: "01", t: "Named, not hidden", b: "Sellers must advertise where they ship — the location leaks in the content itself." },
              { k: "02", t: "No local lens", b: "Global threat feeds don't zoom to Jabalpur, Katni or Narsinghpur." },
              { k: "03", t: "No officer UX", b: "Raw intel never becomes an actionable, exportable lead for a beat officer." },
            ].map((c) => (
              <div key={c.k} className="panel p-5">
                <div className="mono text-3xl font-bold text-border-2">{c.k}</div>
                <div className="mono mt-2 text-sm uppercase tracking-[0.12em] text-text">
                  {c.t}
                </div>
                <p className="mt-2 text-sm text-muted">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== INSIGHT ===================== */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="The Insight"
            title="We geofence what they"
            accent="say — not the network."
            sub="This is the honest thesis at the core of PRAHARI. It is what makes the platform legal, defensible and genuinely useful."
          />
          <div className="mt-10">
            <InsightDiagram />
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="Capabilities"
            title="One console,"
            accent="every super-feature."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="panel group relative p-6 transition hover:border-red/50"
                >
                  <span className="flex h-11 w-11 items-center justify-center border border-border-2 bg-panel-2 transition group-hover:border-red group-hover:bg-red/10">
                    <Icon
                      className="h-5 w-5 text-muted transition group-hover:text-red-bright"
                      strokeWidth={1.75}
                    />
                  </span>
                  <h3 className="mono mt-4 text-sm uppercase tracking-[0.12em] text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== USP ===================== */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="Why PRAHARI"
            title="The last-mile edge for"
            accent="Indian regional policing."
            sub="What sets PRAHARI apart from national threat feeds and generic dashboards — purpose-built for a district cyber cell."
          />
          <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {USPS.map((u, i) => {
              const Icon = u.icon;
              return (
                <div key={u.title} className="group relative bg-panel p-6">
                  <div className="mono absolute right-4 top-4 text-2xl font-bold text-border-2">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center border border-red/40 bg-red/10">
                    <Icon className="h-5 w-5 text-red-bright" strokeWidth={1.75} />
                  </span>
                  <h3 className="mono mt-4 text-sm uppercase tracking-[0.1em] text-white">
                    {u.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{u.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="How It Works"
            title="A five-stage"
            accent="intelligence pipeline."
          />
          <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative bg-panel p-5">
                  <div className="mono mb-3 text-[10px] tracking-widest text-red-bright">
                    STEP {i + 1}
                  </div>
                  <Icon className="h-6 w-6 text-text" strokeWidth={1.5} />
                  <div className="mono mt-3 text-sm uppercase tracking-[0.1em] text-white">
                    {s.title}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(225,6,0,0.18),transparent_60%)]" />
        <div className="relative mx-auto max-w-[1400px] px-4 py-24 text-center sm:px-6">
          <h2 className="font-display text-5xl uppercase leading-none tracking-tight text-white sm:text-7xl">
            Own the first <span className="text-red-bright">30 seconds.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Launch the console in DEMO MODE and watch a Jabalpur geofence breach
            fire within 20 seconds — every single run.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn btn-primary">
              Launch Console <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/about" className="btn btn-ghost">
              About the Mission
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
