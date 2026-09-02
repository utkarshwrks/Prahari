import { FEATURES } from "@/lib/features";
import Sangam from "@/components/sangam/Sangam";
import SangamPro from "@/components/sangam/SangamPro";

export const metadata = { title: "Sangam — PRAHARI" };

/**
 * `/sangam`, behind NEXT_PUBLIC_FF_SANGAM_PRO.
 *
 * With the flag off this is the existing map, unchanged — the prime directive.
 * With it on, the three-class coordinate model, the resolution chain, the
 * unplaced panel and the class-preserving exports (DEC-061, DEC-062).
 */
export default function Page() {
  return FEATURES.sangamPro ? <SangamPro /> : <Sangam />;
}
