import { ReactNode } from "react";

/** Bordered tactical card: mono uppercase header with a status dot, a thin red
 *  accent rule, optional corner brackets, and generous internal padding.
 *  The workhorse container for every dashboard panel. */
export default function TacticalPanel({
  title,
  right,
  children,
  brackets = true,
  className = "",
  bodyClassName = "",
  live = false,
  tourId,
}: {
  title: string;
  right?: ReactNode;
  children?: ReactNode;
  brackets?: boolean;
  className?: string;
  bodyClassName?: string;
  live?: boolean;
  tourId?: string;
}) {
  return (
    <section
      data-tour={tourId}
      className={`panel flex min-h-0 flex-col ${brackets ? "brackets" : ""} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 ${live ? "animate-pulseDot bg-red-bright" : "bg-muted-2"}`}
          />
          <h2 className="mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text">
            {title}
          </h2>
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      <div className="red-rule opacity-70" />
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
