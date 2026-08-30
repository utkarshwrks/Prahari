"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import ThreatHUD from "./ThreatHUD";
import Clock from "./Clock";
import HeaderControls from "./HeaderControls";
import UserMenu from "./UserMenu";
import NotificationCenter from "./NotificationCenter";
import RecordsButton from "./RecordsButton";

export default function DashboardHeader() {
  return (
    <header className="relative z-30 flex items-center justify-between gap-4 border-b border-border bg-panel/70 px-4 py-2.5 backdrop-blur-sm">
      {/* Left: wordmark */}
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center border border-red bg-red/10 shadow-glow-sm">
          <ShieldAlert className="h-5 w-5 text-red-bright" strokeWidth={2} />
        </span>
        <div className="leading-none">
          <div className="flex items-baseline gap-1.5">
            <span className="mono text-lg font-bold tracking-[0.24em] text-white">
              PRAHARI
            </span>
            <span className="text-base text-red-bright">प्रहरी</span>
          </div>
          <div className="mono mt-0.5 hidden text-[9px] tracking-[0.2em] text-muted-2 sm:block">
            MP CYBER CELL · JABALPUR CONTROL ROOM
          </div>
        </div>
      </Link>

      {/* Center: threat HUD */}
      <div className="hidden md:block">
        <ThreatHUD />
      </div>

      {/* Right: uplink + clock + controls + user.
          On mobile the clock/controls move into the threat bar below. */}
      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-bright opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-bright" />
          </span>
          <span className="mono animate-flicker text-[10px] uppercase tracking-[0.16em] text-red-bright">
            Secure Uplink
          </span>
        </div>
        <div className="hidden h-6 w-px bg-border-2 lg:block" />
        <div className="hidden sm:block">
          <Clock />
        </div>
        <div className="hidden h-6 w-px bg-border-2 md:block" />
        <div className="hidden md:block">
          <HeaderControls />
        </div>
        <RecordsButton />
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
