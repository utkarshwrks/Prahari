"use client";

import { useEffect, useState } from "react";
import { clockString } from "@/lib/time";

export default function Clock() {
  const [time, setTime] = useState<string>("--:--:--");
  useEffect(() => {
    const tick = () => setTime(clockString(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="mono tabular-nums text-sm tracking-widest text-text">
      {time}
    </span>
  );
}
