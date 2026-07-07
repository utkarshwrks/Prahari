"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Smoothly tweens to `value` whenever it changes. */
export default function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <>{Math.round(display).toLocaleString("en-IN")}</>;
}
