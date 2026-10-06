let audioContext: AudioContext | null = null;
let soundEnabled = true;

export function setGameSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (!enabled && audioContext?.state === "running") {
    void audioContext.suspend();
  }
}

function context() {
  if (typeof window === "undefined" || !soundEnabled) return null;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function tone(
  ctx: AudioContext,
  args: {
    frequency: number;
    toFrequency?: number;
    start?: number;
    duration: number;
    volume: number;
    type?: OscillatorType;
  }
) {
  const start = ctx.currentTime + (args.start ?? 0);
  const stop = start + args.duration;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = args.type ?? "sine";
  oscillator.frequency.setValueAtTime(args.frequency, start);
  if (args.toFrequency && args.toFrequency > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(
      args.toFrequency,
      stop
    );
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(args.volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(stop + 0.01);
}

function noiseBurst(ctx: AudioContext, duration = 0.07, volume = 0.025) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  // Deterministic-enough arcade texture; generated locally, no licensed asset.
  for (let index = 0; index < length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

/**
 * Lightweight arcade SFX synthesized with Web Audio.
 * No third-party audio files, attribution requirements or runtime downloads.
 */
export function gameTone(kind: "tap" | "good" | "bad" | "win" | "countdown") {
  const ctx = context();
  if (!ctx) return;

  switch (kind) {
    case "tap":
      tone(ctx, {
        frequency: 520,
        toFrequency: 390,
        duration: 0.045,
        volume: 0.032,
        type: "triangle",
      });
      break;

    case "good":
      tone(ctx, {
        frequency: 660,
        toFrequency: 760,
        duration: 0.075,
        volume: 0.042,
        type: "sine",
      });
      tone(ctx, {
        frequency: 920,
        start: 0.045,
        duration: 0.07,
        volume: 0.032,
        type: "triangle",
      });
      break;

    case "bad":
      tone(ctx, {
        frequency: 155,
        toFrequency: 72,
        duration: 0.14,
        volume: 0.05,
        type: "sawtooth",
      });
      noiseBurst(ctx, 0.09, 0.018);
      break;

    case "win":
      [660, 825, 990, 1320].forEach((frequency, index) => {
        tone(ctx, {
          frequency,
          start: index * 0.07,
          duration: 0.12,
          volume: index === 3 ? 0.055 : 0.04,
          type: index === 3 ? "sine" : "triangle",
        });
      });
      break;

    case "countdown":
      tone(ctx, {
        frequency: 460,
        toFrequency: 520,
        duration: 0.065,
        volume: 0.036,
        type: "square",
      });
      break;
  }
}
