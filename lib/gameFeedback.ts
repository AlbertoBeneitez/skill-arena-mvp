let audioContext: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function gameTone(kind: "tap" | "good" | "bad" | "win" | "countdown") {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const config = {
    tap: [420, 0.035, 0.035],
    good: [680, 0.055, 0.05],
    bad: [150, 0.08, 0.05],
    win: [880, 0.13, 0.07],
    countdown: [520, 0.05, 0.04],
  } as const;
  const [freq, duration, volume] = config[kind];
  osc.type = kind === "bad" ? "sawtooth" : "sine";
  osc.frequency.setValueAtTime(freq, now);
  if (kind === "win") osc.frequency.exponentialRampToValueAtTime(1320, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}
