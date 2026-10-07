let audioContext: AudioContext | null = null;
let soundEnabled = true;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicGameId: string | null = null;
let musicStep = 0;

export function setGameSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;

  if (!enabled) {
    stopGameMusic();
    if (audioContext?.state === "running") {
      void audioContext.suspend();
    }
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



type MusicProfile = {
  bpm: number;
  root: number;
  scale: number[];
  bassEvery: number;
};

function profileFor(gameId: string): MusicProfile {
  const profiles: MusicProfile[] = [
    { bpm: 112, root: 220, scale: [0, 3, 5, 7, 10, 12], bassEvery: 4 },
    { bpm: 120, root: 196, scale: [0, 2, 5, 7, 9, 12], bassEvery: 4 },
    { bpm: 104, root: 246.94, scale: [0, 3, 5, 8, 10, 12], bassEvery: 6 },
    { bpm: 126, root: 174.61, scale: [0, 2, 4, 7, 9, 12], bassEvery: 4 },
  ];

  let hash = 0;
  for (let index = 0; index < gameId.length; index += 1) {
    hash = (hash * 31 + gameId.charCodeAt(index)) >>> 0;
  }

  return profiles[hash % profiles.length];
}

function semitone(base: number, offset: number) {
  return base * Math.pow(2, offset / 12);
}

function scheduleMusicStep(gameId: string) {
  if (!soundEnabled || musicGameId !== gameId) return;

  const ctx = context();
  if (!ctx) return;

  const profile = profileFor(gameId);
  const phrase = [0, 2, 4, 2, 3, 5, 4, 1, 0, 3, 4, 2, 5, 3, 1, 2];
  const degree = phrase[musicStep % phrase.length] % profile.scale.length;
  const offset = profile.scale[degree];
  const beatSeconds = 60 / profile.bpm;

  tone(ctx, {
    frequency: semitone(profile.root, offset),
    duration: beatSeconds * 0.72,
    volume: 0.011,
    type: "sine",
  });

  if (musicStep % 2 === 0) {
    tone(ctx, {
      frequency: semitone(profile.root / 2, profile.scale[(degree + 2) % profile.scale.length]),
      start: beatSeconds * 0.04,
      duration: beatSeconds * 0.58,
      volume: 0.006,
      type: "triangle",
    });
  }

  if (musicStep % profile.bassEvery === 0) {
    tone(ctx, {
      frequency: profile.root / 2,
      duration: beatSeconds * 1.15,
      volume: 0.008,
      type: "sine",
    });
  }

  musicStep += 1;
}

/**
 * Soft synthesized background loop. It deliberately stays quiet under SFX,
 * uses only Web Audio primitives, and needs no licensed audio assets.
 */
export function startGameMusic(gameId: string) {
  if (!soundEnabled || typeof window === "undefined") return;

  if (musicGameId === gameId && musicTimer !== null) return;

  stopGameMusic();
  musicGameId = gameId;
  musicStep = 0;

  const profile = profileFor(gameId);
  const beatMs = Math.round((60_000 / profile.bpm) / 2);

  scheduleMusicStep(gameId);
  musicTimer = setInterval(() => {
    scheduleMusicStep(gameId);
  }, beatMs);
}

export function stopGameMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  musicGameId = null;
  musicStep = 0;
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
