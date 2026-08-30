"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/a11y";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => <StaticPoster />,
});

/** Radial poster shown while the 3D loads, and permanently under reduced motion
 *  or on devices without WebGL — so information is never lost to a missing GPU. */
function StaticPoster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="h-[70%] w-[70%] max-w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%)",
          boxShadow: "inset 0 0 120px color-mix(in srgb, var(--accent) 18%, transparent)",
          border: "1px solid var(--border-2)",
        }}
      />
    </div>
  );
}

export default function GlobeStage() {
  const [webgl, setWebgl] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    try {
      const c = document.createElement("canvas");
      setWebgl(Boolean(c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch {
      setWebgl(false);
    }
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {webgl && !reduced ? <Globe /> : <StaticPoster />}
    </div>
  );
}
