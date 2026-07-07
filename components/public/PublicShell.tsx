import { ReactNode } from "react";
import TopNav from "./TopNav";
import Footer from "./Footer";

/** Wraps every public page with the shared nav + footer. */
export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
