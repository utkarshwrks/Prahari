"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import ThemeControl from "@/components/system/ThemeControl";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ThemeControl />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border-2)",
            color: "var(--text)",
            borderRadius: "var(--radius)",
            fontSize: "12px",
          },
        }}
      />
    </SessionProvider>
  );
}
