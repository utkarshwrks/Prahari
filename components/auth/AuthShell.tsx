import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "../ui/Logo";

/** Centered red/black auth layout with the tactical grid backdrop. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <Logo />
        <Link
          href="/"
          className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to site
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mono mb-2 text-[11px] uppercase tracking-[0.24em] text-red-bright">
              Secure Access
            </div>
            <h1 className="font-heading text-3xl font-bold text-white">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>

          <div className="panel brackets p-6 sm:p-8">{children}</div>

          {footer && (
            <div className="mt-6 text-center text-sm text-muted">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
