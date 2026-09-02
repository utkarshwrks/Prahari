"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ClassifiedPoint } from "@/lib/sangamClass";
import { DERIVED, RESOLVED } from "@/lib/sangamClass";

/**
 * The SANGAM Pro map (DEC-061).
 *
 * MARKER SHAPE CARRIES THE CLASS:
 *
 *   RESOLVED  a solid filled pin
 *   DERIVED   a hollow pin with a DASHED ring, and no pulse
 *
 * Shape, not colour. Colour is skin-dependent (DEC-055) and fails for
 * colour-blind readers, so a viewer must be able to tell a measured point from
 * a region in greyscale.
 *
 * TWO RULES the drawing obeys:
 *
 *   * A DERIVED point never gets an accuracy circle. A circle implies a radius
 *     of confidence in metres; a region has no such thing, and drawing one
 *     would be inventing precision.
 *   * Co-located points are CLUSTERED with a count badge, never scattered.
 *     Jitter on a real coordinate is fabrication, so identical coordinates stay
 *     identical and the map shows how many share them.
 */

const Leaflet = dynamic(() => import("./LeafletCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <span className="mono text-[10px] text-[var(--muted-2)]">Loading map…</span>
    </div>
  ),
});

export interface MapProps {
  points: ClassifiedPoint[];
  selected: ClassifiedPoint | null;
  compareWith: ClassifiedPoint | null;
  onSelect: (p: ClassifiedPoint) => void;
  onTileError: () => void;
}

/** Group points that share an exact coordinate. Clustering, not scattering. */
export function cluster(points: ClassifiedPoint[]): {
  lat: number;
  lng: number;
  members: ClassifiedPoint[];
}[] {
  const byCoord = new Map<string, ClassifiedPoint[]>();
  for (const p of points) {
    if (p.lat === null || p.lng === null) continue;
    const key = `${p.lat},${p.lng}`;
    byCoord.set(key, [...(byCoord.get(key) ?? []), p]);
  }
  return [...byCoord.entries()].map(([key, members]) => {
    const [lat, lng] = key.split(",").map(Number);
    return { lat, lng, members };
  });
}

export default function SangamProMap(props: MapProps) {
  const clusters = useMemo(() => cluster(props.points), [props.points]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(
      typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    );
  }, []);

  if (clusters.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <p className="mono max-w-[46ch] text-center text-[10px] leading-relaxed text-[var(--muted-2)]">
          No point in this view has a coordinate. Anything that could not be placed is listed in the
          unplaced panel with the reason it could not be.
        </p>
      </div>
    );
  }

  return <Leaflet {...props} clusters={clusters} reducedMotion={reduced} />;
}

export { RESOLVED, DERIVED };
