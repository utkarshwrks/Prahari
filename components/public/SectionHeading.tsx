import { ReactNode } from "react";

/** Editorial section heading: mono kicker + red rule + big Space Grotesk title. */
export default function SectionHeading({
  kicker,
  title,
  accent,
  sub,
  center = false,
}: {
  kicker: string;
  title: ReactNode;
  accent?: string;
  sub?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-3xl"}>
      <div
        className={`mb-4 flex items-center gap-3 ${center ? "justify-center" : ""}`}
      >
        <span className="h-px w-8 bg-red" />
        <span className="mono text-[11px] uppercase tracking-[0.24em] text-red-bright">
          {kicker}
        </span>
      </div>
      <h2 className="font-heading text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
        {title} {accent && <span className="text-red-bright">{accent}</span>}
      </h2>
      {sub && (
        <p
          className={`mt-4 text-base leading-relaxed text-muted sm:text-lg ${center ? "mx-auto" : ""}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
