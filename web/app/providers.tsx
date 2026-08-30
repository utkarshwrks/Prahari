"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/** Client-side providers. Wraps the app in NextAuth's SessionProvider and
 *  mounts the Sonner <Toaster/> ONCE. visibleToasts caps concurrent toasts so
 *  alerts never overlap or cover the screen — overflow collapses into a neat
 *  stacked pile. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        expand={false}
        visibleToasts={2}
        gap={8}
        offset={72}
        richColors={false}
        toastOptions={{
          duration: 3200,
          style: {
            background: "#1E1E25",
            border: "1px solid #E10600",
            borderRadius: "4px",
            color: "#F4F4F5",
            pointerEvents: "auto",
          },
        }}
      />
    </SessionProvider>
  );
}
