"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FolderKanban } from "lucide-react";
import RecordsModal from "./RecordsModal";

export const OPEN_RECORDS_EVENT = "prahari:open-records";

export default function RecordsButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(OPEN_RECORDS_EVENT, h);
    return () => window.removeEventListener(OPEN_RECORDS_EVENT, h);
  }, []);

  return (
    <>
      <button
        data-tour="records"
        onClick={() => setOpen(true)}
        title="Case records & reports"
        className="flex h-8 w-8 items-center justify-center border border-border bg-panel-2 text-muted transition hover:border-red/50 hover:text-red-bright"
      >
        <FolderKanban className="h-4 w-4" />
      </button>
      {mounted && open && createPortal(<RecordsModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
