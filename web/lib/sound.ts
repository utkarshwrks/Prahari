// Soft alert ping via WebAudio — no audio asset, so the app stays fully offline.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Short two-tone alert ping. No-op if muted or WebAudio unavailable. */
export function playBreachPing(muted: boolean): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  master.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  [740, 1180].forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.09);
    osc.connect(master);
    osc.start(now + i * 0.09);
    osc.stop(now + 0.5);
  });
}
