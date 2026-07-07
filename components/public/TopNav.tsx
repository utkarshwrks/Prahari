"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import Logo from "../ui/Logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* center links (desktop) */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`mono px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
                isActive(l.href)
                  ? "text-red-bright"
                  : "text-muted hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* right actions (desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="mono text-xs uppercase tracking-[0.16em] text-muted transition hover:text-text"
          >
            Login
          </Link>
          <Link href="/login" className="btn btn-primary !py-2.5 !text-xs">
            Launch Console <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* mobile toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center border border-border text-text md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="border-t border-border bg-black md:hidden">
          <nav className="mx-auto flex max-w-[1400px] flex-col px-4 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`mono border-b border-border/60 py-3 text-sm uppercase tracking-[0.16em] ${
                  isActive(l.href) ? "text-red-bright" : "text-muted"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-ghost w-full"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                Launch Console
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
