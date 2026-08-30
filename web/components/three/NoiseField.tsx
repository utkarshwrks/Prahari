"use client";

/** A faint animated grid + scan sweep behind content — cheap, GPU-free, and it
 *  gives the dead space the "operational console" feel without a heavy canvas. */
export default function NoiseField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border-2) 1px, transparent 1px), linear-gradient(90deg, var(--border-2) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black, transparent 75%)",
        }}
      />
      <div className="scan-sweep absolute inset-x-0 h-[35%]" />
      <style jsx>{`
        .scan-sweep {
          background: linear-gradient(
            180deg,
            transparent,
            color-mix(in srgb, var(--accent) 6%, transparent),
            transparent
          );
          animation: sweep 7s ease-in-out infinite;
        }
        @keyframes sweep {
          0%,
          100% {
            transform: translateY(-40%);
            opacity: 0;
          }
          50% {
            transform: translateY(240%);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-sweep {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
