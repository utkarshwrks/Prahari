"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, ChevronDown, HelpCircle } from "lucide-react";
import { START_TOUR_EVENT } from "./TourGuide";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const name = session?.user?.name ?? "Officer";
  const email = session?.user?.email ?? "";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-border bg-panel-2 px-2.5 py-1.5 transition hover:border-border-2"
      >
        <span className="flex h-5 w-5 items-center justify-center border border-red/40 bg-red/10">
          <User className="h-3 w-3 text-red-bright" />
        </span>
        <span className="mono hidden max-w-[120px] truncate text-[11px] text-text sm:block">
          {name}
        </span>
        <ChevronDown className="h-3 w-3 text-muted" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-56 border border-border bg-panel shadow-panel">
            <div className="border-b border-border px-3 py-2.5">
              <div className="mono text-[11px] text-text">{name}</div>
              <div className="mono mt-0.5 truncate text-[10px] text-muted-2">
                {email}
              </div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(START_TOUR_EVENT));
              }}
              className="mono flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.12em] text-muted transition hover:bg-panel-2 hover:text-red-bright"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Replay Tutorial
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mono flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.12em] text-muted transition hover:bg-panel-2 hover:text-red-bright"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
