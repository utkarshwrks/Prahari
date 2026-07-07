import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, MapPin, IndianRupee, Scale } from "lucide-react";
import PublicShell from "@/components/public/PublicShell";
import SectionHeading from "@/components/public/SectionHeading";

export const metadata: Metadata = {
  title: "About · PRAHARI",
  description:
    "PRAHARI's mission: honest, local, actionable dark-web threat intelligence for the MP Police Cyber Cell, Jabalpur.",
};

const DIFFERENTIATORS = [
  {
    icon: MapPin,
    title: "Local",
    body: "Built for a single district's streets — Jabalpur, Katni, Narsinghpur — not a global feed that never zooms in.",
  },
  {
    icon: ShieldCheck,
    title: "Honest",
    body: "We geofence stated locations and never claim to deanonymize Tor. Every lead is auditable to a public source.",
  },
  {
    icon: Scale,
    title: "Actionable",
    body: "Raw intercepts become correlated, exportable leads an officer can act on — not a dashboard that just looks busy.",
  },
  {
    icon: IndianRupee,
    title: "Free",
    body: "Runs entirely on free and open tooling. No paid services, no billing — a cyber cell can stand it up at zero cost.",
  },
];

export default function AboutPage() {
  return (
    <PublicShell>
      {/* hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-red" />
            <span className="mono text-[11px] uppercase tracking-[0.24em] text-red-bright">
              About PRAHARI
            </span>
          </div>
          <h1 className="max-w-4xl font-display text-5xl uppercase leading-[0.95] tracking-tight text-white sm:text-7xl">
            The sentinel that never sleeps.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            प्रहरी (prahari) means "sentinel." Our mission is to give the Madhya
            Pradesh Police Cyber Cell a control room that turns openly-published
            dark-web crime into local, honest, actionable intelligence.
          </p>
        </div>
      </section>

      {/* mission / problem */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading
              kicker="The Problem in MP"
              title="Crime that names our"
              accent="cities, unseen by us."
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>
                On Tor marketplaces, forums and paste dumps, sellers advertise
                narcotics, weapon parts, stolen identity records and counterfeit
                currency — and they say exactly where they deliver: "across
                Jabalpur and Katni", "MP region, Bhopal and Indore".
              </p>
              <p>
                That location leakage is intrinsic — a marketplace{" "}
                <span className="text-text">must</span> advertise where it ships.
                Yet national tools don't watch a single district, and local cells
                have never had a console built for that last mile.
              </p>
            </div>
          </div>

          <div>
            <SectionHeading
              kicker="The Honest Approach"
              title="Content geofencing,"
              accent="not deanonymization."
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>
                The dark web is anonymous by design. You cannot geolocate the Tor
                network, and PRAHARI never pretends to. Instead we read the{" "}
                <span className="text-text">content</span> criminals publish and
                use NER to extract the real-world locations they state themselves.
              </p>
              <p>
                We geofence on those mentions — with Jabalpur as a protected
                jurisdiction — and corroborate with recurring crypto-wallet
                clusters and repeated @handles. This is content-based geospatial
                threat intelligence: legal, defensible and genuinely useful.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* differentiators */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="What Makes Us Different"
            title="Four principles,"
            accent="one console."
            center
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIATORS.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.title} className="panel brackets p-6">
                  <Icon className="h-6 w-6 text-red-bright" strokeWidth={1.6} />
                  <h3 className="mono mt-4 text-base uppercase tracking-[0.14em] text-white">
                    {d.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {d.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* built-for note + CTA */}
      <section>
        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6">
          <div className="panel relative overflow-hidden p-8 sm:p-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(225,6,0,0.12),transparent_60%)]" />
            <div className="relative">
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-red-bright">
                Built For
              </div>
              <h2 className="mt-3 max-w-3xl font-heading text-3xl font-bold text-white sm:text-4xl">
                The Madhya Pradesh Police Cyber Cell, Jabalpur.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-muted">
                Jabalpur is the pilot jurisdiction. Because the geofence and the
                gazetteer are configuration — not code — a new district is a data
                change, and the same console scales to every cell in the state.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn btn-primary">
                  Launch Console <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="/docs" className="btn btn-ghost">
                  Read the Docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
