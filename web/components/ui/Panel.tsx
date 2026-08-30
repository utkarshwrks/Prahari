import { ReactNode } from "react";

export default function Panel({
  title, right, children, className = "", bodyClassName = "", marked = false,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  marked?: boolean;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${marked ? "marked" : ""} ${className}`}>
      {title && (
        <header className="hairline flex shrink-0 items-center justify-between gap-3 px-3 py-2">
          <h2 className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
