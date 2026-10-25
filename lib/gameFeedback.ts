let audioContext: AudioContext | null = null;
let soundEnabled = true;
let musicEnabled = true;
let hapticsEnabled = true;
let masterGain: GainNode | null = null;
type VoiceKind = "music" | "effect";
const voices = new Map<
  AudioScheduledSourceNode,
  { gain: GainNode; kind: VoiceKind }
>();
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicGameId: string | null = null;
let musicStep = 0;
/** Settings › Música: which music plays. "mix" picks, each time music starts, the game's own theme or a focus track. */
export const FOCUS_TRACKS = ["lofi", "ambient", "piano", "deep", "synth", "rain"] as const;
export type FocusTrack = (typeof FOCUS_TRACKS)[number];
export type MusicChoice = "mix" | "game" | FocusTrack;
export const MUSIC_CHOICES: readonly MusicChoice[] = ["mix", "game", ...FOCUS_TRACKS];
let musicChoice: MusicChoice = "mix";
/** The track actually playing ("game" = the per-game synth theme). */
let activeTrack: "game" | FocusTrack = "game";

/** Apply the preference immediately; only a trusted gesture unlocks audio here. */
export function setGameSoundEnabled(enabled: boolean, fromGesture = false) {
  soundEnabled = enabled;
  if (masterGain && audioContext) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setValueAtTime(enabled ? 1 : 0, audioContext.currentTime);
  }
  if (!enabled) {
    stopGameMusic();
    cancelVoices();
    // The gain gate already makes mute synchronous. A pending resume cannot
    // bypass it, and stopped voices cannot return on the next activation.
    if (audioContext?.state === "running") {
      void audioContext.suspend().catch(() => {});
    }
  } else if (fromGesture) {
    context();
  }
}

function context() {
  if (typeof window === "undefined" || !soundEnabled) return null;
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function registerVoice(
  source: AudioScheduledSourceNode,
  gain: GainNode,
  kind: VoiceKind,
) {
  if (!masterGain) return;
  source.connect(gain);
  gain.connect(masterGain);
  voices.set(source, { gain, kind });
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    voices.delete(source);
  };
}

function cancelVoices(kind?: VoiceKind) {
  for (const [source, voice] of voices) {
    if (kind && voice.kind !== kind) continue;
    voices.delete(source);
    source.onended = null;
    source.stop();
    source.disconnect();
    voice.gain.disconnect();
  }
}

/** Music has its own switch (Settings › Música); sound effects keep playing. */
export function setGameMusicEnabled(enabled: boolean) {
  musicEnabled = enabled;
  if (!enabled) stopGameMusic();
}

/** Settings › Vibración. */
export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function haptic(pattern: number | number[] = 12) {
  if (!hapticsEnabled) return;
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
    kind?: VoiceKind;
  },
) {
  const start = ctx.currentTime + (args.start ?? 0);
  const stop = start + args.duration;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = args.type ?? "sine";
  oscillator.frequency.setValueAtTime(args.frequency, start);
  if (args.toFrequency && args.toFrequency > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(args.toFrequency, stop);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(args.volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  registerVoice(oscillator, gain, args.kind ?? "effect");
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

  registerVoice(source, gain, "effect");
  source.start(now);
  source.stop(now + duration);
}

type MusicProfile = {
  bpm: number;
  root: number;
  scale: number[];
  bassEvery: number;
  motif?: readonly number[];
  leadType?: OscillatorType;
};

function profileFor(gameId: string): MusicProfile {
  // Calm, slow ambience for the lobby, groups and rankings.
  if (gameId === "menu")
    return {
      bpm: 78,
      root: 174.61,
      scale: [0, 2, 4, 7, 9, 12],
      bassEvery: 8,
      motif: [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 4, 5, 4, 2, 1, 2],
      leadType: "sine",
    };
  if (gameId === "reaction-test")
    return {
      bpm: 144,
      root: 110,
      scale: [0, 1, 3, 6, 7, 10],
      bassEvery: 2,
      motif: [0, 1, 0, 3, 0, 4, 3, 1, 0, 1, 0, 5, 4, 3, 1, 0],
      leadType: "triangle",
    };
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
  const phrase = profile.motif ?? [
    0, 2, 4, 2, 3, 5, 4, 1, 0, 3, 4, 2, 5, 3, 1, 2,
  ];
  const degree = phrase[musicStep % phrase.length] % profile.scale.length;
  const offset = profile.scale[degree];
  const beatSeconds = 60 / profile.bpm;

  tone(ctx, {
    frequency: semitone(profile.root, offset),
    duration: beatSeconds * 0.72,
    volume: 0.011,
    type: profile.leadType ?? "sine",
    kind: "music",
  });

  if (musicStep % 2 === 0) {
    tone(ctx, {
      frequency: semitone(
        profile.root / 2,
        profile.scale[(degree + 2) % profile.scale.length],
      ),
      start: beatSeconds * 0.04,
      duration: beatSeconds * 0.58,
      volume: 0.006,
      type: "triangle",
      kind: "music",
    });
  }

  if (musicStep % profile.bassEvery === 0) {
    tone(ctx, {
      frequency: profile.root / 2,
      duration: beatSeconds * 1.15,
      volume: 0.008,
      type: "sine",
      kind: "music",
    });
  }

  musicStep += 1;
}

/**
 * Soft synthesized background loop. It deliberately stays quiet under SFX,
 * uses only Web Audio primitives, and needs no licensed audio assets.
 */
export function startGameMusic(gameId: string, force = false) {
  if (!soundEnabled || !musicEnabled || typeof window === "undefined") return;

  if (!force && musicGameId === gameId && musicTimer !== null) return;

  stopGameMusic();
  musicGameId = gameId;
  musicStep = 0;
  // Presentation only (Math.random is fine here): pick the track for this session of music.
  const pool: ("game" | FocusTrack)[] = ["game", ...FOCUS_TRACKS];
  activeTrack = musicChoice === "mix" ? pool[Math.floor(Math.random() * pool.length)] : musicChoice;

  if (activeTrack !== "game") {
    const track = FOCUS[activeTrack];
    const stepMs = Math.round(60_000 / track.bpm / track.stepsPerBeat);
    const run = () => {
      if (!soundEnabled || musicGameId !== gameId) return;
      const ctx = context();
      if (!ctx) return;
      track.step(ctx, musicStep, 60 / track.bpm / track.stepsPerBeat);
      musicStep += 1;
    };
    run();
    musicTimer = setInterval(run, stepMs);
    return;
  }

  const profile = profileFor(gameId);
  const beatMs = Math.round(60_000 / profile.bpm / 2);

  scheduleMusicStep(gameId);
  musicTimer = setInterval(() => {
    scheduleMusicStep(gameId);
  }, beatMs);
}

/** Settings › Música › track. Restarts the current music with the new choice. */
export function setGameMusicTrack(choice: MusicChoice) {
  if (!MUSIC_CHOICES.includes(choice)) return;
  const changed = choice !== musicChoice;
  musicChoice = choice;
  if (changed && musicGameId !== null) startGameMusic(musicGameId, true);
}
export const currentMusicTrack = () => activeTrack;

// ---------- Focus tracks: original, synthesized live with Web Audio (no audio files, no licences) ----------
type VoiceArgs = {
  frequency: number;
  start?: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  cutoff?: number;
  detune?: number;
  pan?: number;
};
/** One soft music voice: oscillator → low-pass → (pan) → gain envelope. */
function musicVoice(ctx: AudioContext, a: VoiceArgs) {
  if (!masterGain) return;
  const start = ctx.currentTime + (a.start ?? 0), attack = a.attack ?? 0.02, release = a.release ?? a.duration * 0.6;
  const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  osc.type = a.type ?? "sine";
  osc.frequency.setValueAtTime(a.frequency, start);
  if (a.detune) osc.detune.setValueAtTime(a.detune, start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(a.cutoff ?? 2400, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(a.volume, start + attack);
  gain.gain.setValueAtTime(a.volume, start + Math.max(attack, a.duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + a.duration);
  osc.connect(filter);
  let tail: AudioNode = filter;
  if (a.pan && typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(a.pan, start);
    filter.connect(panner);
    tail = panner;
  }
  tail.connect(gain);
  gain.connect(masterGain);
  voices.set(osc, { gain, kind: "music" });
  osc.onended = () => { osc.disconnect(); filter.disconnect(); if (tail !== filter) tail.disconnect(); gain.disconnect(); voices.delete(osc); };
  osc.start(start);
  osc.stop(start + a.duration + 0.02);
}
let noiseBuffer: AudioBuffer | null = null;
/** Filtered noise (brushed hats, rain). */
function musicNoise(ctx: AudioContext, a: { start?: number; duration: number; volume: number; cutoff: number; type?: BiquadFilterType }) {
  if (!masterGain) return;
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const start = ctx.currentTime + (a.start ?? 0);
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  src.buffer = noiseBuffer;
  src.loop = true;
  filter.type = a.type ?? "lowpass";
  filter.frequency.setValueAtTime(a.cutoff, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(a.volume, start + Math.min(0.4, a.duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + a.duration);
  src.connect(filter); filter.connect(gain); gain.connect(masterGain);
  voices.set(src, { gain, kind: "music" });
  src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); voices.delete(src); };
  src.start(start);
  src.stop(start + a.duration + 0.02);
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
type FocusDef = { bpm: number; stepsPerBeat: number; step(ctx: AudioContext, i: number, stepSeconds: number): void };
const FOCUS: Record<FocusTrack, FocusDef> = {
  // Lo-fi study: warm 9th chords, round bass, brushed hats and a lazy pentatonic melody.
  lofi: {
    bpm: 74, stepsPerBeat: 2,
    step(ctx, i, st) {
      const chords = [[50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 52, 55, 59, 62], [45, 48, 52, 55, 59]];
      const bar = Math.floor(i / 8) % 4, chord = chords[bar], inBar = i % 8;
      if (inBar === 0) for (const n of chord) musicVoice(ctx, { frequency: hz(n), duration: st * 7.6, volume: 0.0032, type: "triangle", attack: 0.08, cutoff: 1300 });
      if (inBar === 0 || inBar === 5) musicVoice(ctx, { frequency: hz(chord[0] - 12), duration: st * 2.4, volume: 0.009, type: "sine", attack: 0.01 });
      if (inBar % 2 === 1) musicNoise(ctx, { duration: 0.06, volume: 0.0025, cutoff: 7000, type: "highpass" });
      const mel = [0, -1, 7, -1, 4, 2, -1, -1, 9, -1, 7, 4, -1, 2, -1, -1];
      const m = mel[i % 16];
      if (m >= 0 && i % 32 >= 16) musicVoice(ctx, { frequency: hz(chord[0] + 12 + m), duration: st * 1.8, volume: 0.0045, type: "sine", attack: 0.02, cutoff: 3000 });
    },
  },
  // Ambient: slow detuned pads that swell and fade, with a distant bell now and then.
  ambient: {
    bpm: 48, stepsPerBeat: 1,
    step(ctx, i, st) {
      const chords = [[45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62], [40, 47, 52, 59]];
      if (i % 8 === 0) {
        const chord = chords[Math.floor(i / 8) % 4];
        for (const n of chord) for (const det of [-7, 7]) musicVoice(ctx, { frequency: hz(n), duration: st * 9.5, volume: 0.0018, type: "sawtooth", detune: det, attack: st * 2.5, release: st * 4, cutoff: 650 });
      }
      if (i % 6 === 3) musicVoice(ctx, { frequency: hz([76, 79, 81, 84, 88][Math.floor(i / 6) % 5]), duration: st * 4, volume: 0.0035, type: "sine", attack: 0.01, release: st * 3.6, pan: (i % 12) < 6 ? -0.4 : 0.4 });
    },
  },
  // Minimal piano: a gentle arpeggio over C – Am – F – G, soft hammer attack and long decay.
  piano: {
    bpm: 66, stepsPerBeat: 2,
    step(ctx, i, st) {
      const chords = [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]];
      const chord = chords[Math.floor(i / 8) % 4], pattern = [0, 2, 3, 4, 3, 2, 1, 2], n = chord[pattern[i % 8]] + 12;
      musicVoice(ctx, { frequency: hz(n), duration: st * 3.5, volume: 0.006, type: "sine", attack: 0.005, release: st * 3.2, cutoff: 2600 });
      musicVoice(ctx, { frequency: hz(n + 12), duration: st * 1.6, volume: 0.0016, type: "triangle", attack: 0.005, release: st * 1.4, cutoff: 3200 });
      if (i % 8 === 0) musicVoice(ctx, { frequency: hz(chord[0] - 12), duration: st * 7.5, volume: 0.006, type: "sine", attack: 0.01, release: st * 6 });
    },
  },
  // Deep focus: a low drone with a slow 4 Hz binaural beat (left/right) and a heartbeat-slow pulse.
  deep: {
    bpm: 60, stepsPerBeat: 1,
    step(ctx, i, st) {
      if (i % 8 === 0) {
        musicVoice(ctx, { frequency: 110, duration: st * 9, volume: 0.006, type: "sine", attack: st * 2, release: st * 3, pan: -0.9 });
        musicVoice(ctx, { frequency: 114, duration: st * 9, volume: 0.006, type: "sine", attack: st * 2, release: st * 3, pan: 0.9 });
        musicVoice(ctx, { frequency: 165, duration: st * 9, volume: 0.0025, type: "triangle", attack: st * 3, release: st * 3, cutoff: 500 });
      }
      musicVoice(ctx, { frequency: 55, duration: st * 0.6, volume: 0.006, type: "sine", attack: 0.01, release: st * 0.5 });
      if (i % 16 === 12) musicVoice(ctx, { frequency: hz(81), duration: st * 5, volume: 0.002, type: "sine", attack: 0.6, release: st * 4 });
    },
  },
  // Calm synthwave: soft 16th-note arpeggio over a warm pad.
  synth: {
    bpm: 92, stepsPerBeat: 4,
    step(ctx, i, st) {
      const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];
      const chord = chords[Math.floor(i / 16) % 4], arp = [0, 1, 2, 3, 2, 1, 2, 3];
      musicVoice(ctx, { frequency: hz(chord[arp[i % 8]]), duration: st * 0.9, volume: 0.0022, type: "square", attack: 0.004, release: st * 0.7, cutoff: 1100 });
      if (i % 16 === 0) for (const n of chord) musicVoice(ctx, { frequency: hz(n - 12), duration: st * 15.5, volume: 0.0016, type: "sawtooth", attack: 0.4, release: st * 6, cutoff: 700, detune: 5 });
      if (i % 8 === 0) musicVoice(ctx, { frequency: hz(chord[0] - 24), duration: st * 3, volume: 0.007, type: "sine", attack: 0.01 });
    },
  },
  // Rain and keys: soft rainfall with glassy pentatonic chimes.
  rain: {
    bpm: 60, stepsPerBeat: 2,
    step(ctx, i, st) {
      if (i % 8 === 0) musicNoise(ctx, { duration: st * 8.6, volume: 0.0055, cutoff: 1400 });
      const pent = [72, 74, 76, 79, 81, 84, 86, 88], pattern = [0, -1, 3, -1, 5, 2, -1, -1, 4, -1, 1, 6, -1, -1, 3, -1];
      const k = pattern[i % 16];
      if (k >= 0) musicVoice(ctx, { frequency: hz(pent[k]), duration: st * 5, volume: 0.0032, type: "sine", attack: 0.005, release: st * 4.6, pan: k % 2 ? 0.5 : -0.5 });
      if (i % 16 === 0) musicVoice(ctx, { frequency: hz(48), duration: st * 15, volume: 0.004, type: "sine", attack: 1.5, release: st * 8 });
    },
  },
};

export function stopGameMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  musicGameId = null;
  musicStep = 0;
  cancelVoices("music");
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
