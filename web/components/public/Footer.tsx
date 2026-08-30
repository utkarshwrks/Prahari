import Link from "next/link";
import Logo from "../ui/Logo";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-black">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Content-based geospatial threat intelligence for the Madhya Pradesh
              Police Cyber Cell, Jabalpur. We geofence the locations criminals
              state — we do not deanonymize Tor.
            </p>
          </div>

          <FooterCol
            title="Platform"
            links={[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/docs", label: "Docs" },
              { href: "/login", label: "Launch Console" },
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              { href: "/docs#how-it-works", label: "How It Works" },
              { href: "/docs#how-to-use", label: "How To Use" },
              { href: "/docs#faq", label: "FAQ" },
              { href: "/docs#tech-stack", label: "Tech Stack" },
            ]}
          />
          <FooterCol
            title="Access"
            links={[
              { href: "/login", label: "Login" },
              { href: "/signup", label: "Sign Up" },
            ]}
          />
        </div>

        <div className="hairline my-8" />

        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-2">
            © 2026 PRAHARI · MP CYBER CELL · JABALPUR
          </p>
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-2">
            SYNTHETIC DATA · DEMO BUILD · NO REAL DARK-WEB ACCESS
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="label mb-3 text-red-bright">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="text-sm text-muted transition hover:text-text"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
