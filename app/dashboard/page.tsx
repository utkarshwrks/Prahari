import type { Metadata } from "next";
import ControlRoom from "@/components/dashboard/ControlRoom";

export const metadata: Metadata = {
  title: "Control Room · PRAHARI",
  description: "PRAHARI dark-web threat intelligence control room.",
};

// Protected by middleware.ts — unauthenticated requests redirect to /login.
export default function DashboardPage() {
  return <ControlRoom />;
}
