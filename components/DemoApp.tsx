"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GameLoader from "./GameLoader";
import { GAMES, STAKES, modeForStake, prizeForStake, type GameMeta, type MatchMode, type Stake } from "@/lib/games";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic, setGameSoundEnabled } from "@/lib/gameFeedback";

type Screen = "welcome" | "avatar-setup" | "home" | "play" | "game" | "wallet" | "profile" | "legal";
type Provider = "google" | "apple" | null;
type Turn = "create" | "existing";

type EarningsPoint = { label: string; value: number };
type Movement = { label: string; amount: number };

type PersistedState = {
  onboarded: boolean;
  provider: Provider;
  playerName: string;
  avatarId: number;
  avatarSrc: string;
  balance: number;
  netEarnings: number;
  nextTurn: Turn;
  musicOn: boolean;
  earnings: EarningsPoint[];
  movements: Movement[];
  tutorialSeen: boolean;
  wins: number;
  losses: number;
  streak: number;
};

const VALID_SCREENS: Screen[] = ["welcome", "avatar-setup", "home", "play", "game", "wallet", "profile", "legal"];

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && VALID_SCREENS.includes(value as Screen);
}

const AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/avatar-${i + 1}.svg`);
const START_BALANCE = 25;
const APP_ITERATION = "v11";
const STORAGE_KEY = `skill-arena-${APP_ITERATION}`;
const TUTORIAL_KEY = `skill-arena-color-tutorial-${APP_ITERATION}`;

function euro(value: number) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function rankingFromEarnings(value: number) {
  if (value >= 100) return 12;
  if (value >= 50) return 48;
  if (value >= 20) return 133;
  if (value >= 5) return 241;
  if (value >= 0) return 417;
  if (value >= -10) return 612;
  if (value >= -30) return 819;
  return 1042;
}

function demoPercentile(score: number, benchmark: number) {
  if (score <= 0) return 1;
  const ratio = score / Math.max(1, benchmark);
  const percentile = Math.round(100 / (1 + Math.exp(-3.2 * (ratio - 0.78))));
  return Math.max(1, Math.min(99, percentile));
}

const BLOCKED_DEMO_NAMES = new Set(["admin", "skillarena", "skill_arena", "soporte", "support"]);

function isDemoNameAvailable(value: string) {
  const clean = value.trim();
  if (!/^[A-Za-z0-9_]{3,18}$/.test(clean)) return false;
  return !BLOCKED_DEMO_NAMES.has(clean.toLowerCase());
}

async function compactAvatarSource(source: string) {
  if (!source.startsWith("data:image/")) return source;

  return new Promise<string>((resolve) => {
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(source);
          return;
        }

        ctx.fillStyle = "#dce6f4";
        ctx.fillRect(0, 0, 256, 256);

        const scale = Math.max(256 / image.width, 256 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (256 - width) / 2;
        const y = (256 - height) / 2;

        ctx.drawImage(image, x, y, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(source);
      }
    };

    image.onerror = () => resolve(source);
    image.src = source;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function drawCrop(
  canvas: HTMLCanvasElement,
  source: string,
  zoom: number,
  offsetX: number,
  offsetY: number
) {
  const image = new Image();
  image.onload = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const scale = Math.max(size / image.width, size / image.height) * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const maxX = Math.max(0, (width - size) / 2);
    const maxY = Math.max(0, (height - size) / 2);
    const x = (size - width) / 2 + offsetX * maxX;
    const y = (size - height) / 2 + offsetY * maxY;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#dce6f4";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, x, y, width, height);
  };
  image.src = source;
}

async function cropAvatarSource(
  source: string,
  zoom: number,
  offsetX: number,
  offsetY: number
) {
  return new Promise<string>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(source);
        return;
      }

      const scale = Math.max(256 / image.width, 256 / image.height) * zoom;
      const width = image.width * scale;
      const height = image.height * scale;
      const maxX = Math.max(0, (width - 256) / 2);
      const maxY = Math.max(0, (height - 256) / 2);

      ctx.fillStyle = "#dce6f4";
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(
        image,
        (256 - width) / 2 + offsetX * maxX,
        (256 - height) / 2 + offsetY * maxY,
        width,
        height
      );

      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };

    image.onerror = () => resolve(source);
    image.src = source;
  });
}

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [onboarded, setOnboarded] = useState(false);
  const [provider, setProvider] = useState<Provider>(null);
  const [playerName, setPlayerName] = useState("");
  const [avatarId, setAvatarId] = useState(0);
  const [avatarSrc, setAvatarSrc] = useState(AVATARS[0]);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const matchStartLockRef = useRef(false);
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [netEarnings, setNetEarnings] = useState(0);
  const [nextTurn, setNextTurn] = useState<Turn>("create");
  const [musicOn, setMusicOn] = useState(true);
  const [earnings, setEarnings] = useState<EarningsPoint[]>([{ label: "Inicio", value: 0 }]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedGame, setSelectedGame] = useState<GameMeta>(GAMES[0]);
  const [selectedStake, setSelectedStake] = useState<Stake>(0);
  const [selectedMode, setSelectedMode] = useState<MatchMode>("create");
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [activeGame, setActiveGame] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy" | "cookies" | "rules">("terms");

  useEffect(() => {
    // En desarrollo queremos probar siempre el flujo completo desde cero.
    // En producción, el onboarding y el tutorial se recuerdan normalmente.
    if (process.env.NODE_ENV === "development") {
      setOnboarded(false);
      setProvider(null);
      setPlayerName("");
      setAvatarId(0);
      setAvatarSrc(AVATARS[0]);
      setAvatarPrompt("");
      setAvatarEditorOpen(true);
      setAvatarGenerating(false);
      setAvatarError("");
      setScreen("welcome");
      setTutorialSeen(false);
      setTutorialOpen(false);
      setTutorialStep(0);
      setIsLoaded(true);
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as Partial<PersistedState>;
        if (data.onboarded) { setOnboarded(true); setScreen("home"); }
        if (data.provider === "google" || data.provider === "apple") setProvider(data.provider);
        if (typeof data.playerName === "string") setPlayerName(data.playerName);
        if (typeof data.avatarId === "number") {
          const nextAvatarId = Math.max(0, Math.min(AVATARS.length - 1, data.avatarId));
          setAvatarId(nextAvatarId);
          setAvatarSrc(AVATARS[nextAvatarId]);
        }
        if (typeof data.avatarSrc === "string" && data.avatarSrc) {
          setAvatarSrc(data.avatarSrc);
          if (data.avatarSrc.startsWith("data:image/")) {
            void compactAvatarSource(data.avatarSrc).then(setAvatarSrc);
          }
        }
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.netEarnings === "number") setNetEarnings(data.netEarnings);
        if (data.nextTurn === "create" || data.nextTurn === "existing") setNextTurn(data.nextTurn);
        if (typeof data.musicOn === "boolean") setMusicOn(data.musicOn);
        if (Array.isArray(data.earnings) && data.earnings.length) setEarnings(data.earnings.slice(-20));
        if (Array.isArray(data.movements)) setMovements(data.movements.slice(0, 20));
        if (typeof data.wins === "number") setWins(data.wins);
        if (typeof data.losses === "number") setLosses(data.losses);
        if (typeof data.streak === "number") setStreak(data.streak);
      } catch {}
    }
    setTutorialSeen(localStorage.getItem(TUTORIAL_KEY) === "1");
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const data: PersistedState = {
      onboarded,
      provider,
      playerName,
      avatarId,
      avatarSrc,
      balance,
      netEarnings,
      nextTurn,
      musicOn,
      earnings,
      movements,
      tutorialSeen,
      wins,
      losses,
      streak,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be full on mobile; gameplay must continue even if persistence fails.
    }
  }, [isLoaded, onboarded, provider, playerName, avatarId, avatarSrc, balance, netEarnings, nextTurn, musicOn, earnings, movements, tutorialSeen, wins, losses, streak]);

  useEffect(() => {
    setGameSoundEnabled(musicOn);
  }, [musicOn]);

  useEffect(() => {
    if (!cropSource || !cropCanvasRef.current) return;
    drawCrop(
      cropCanvasRef.current,
      cropSource,
      cropZoom,
      cropOffset.x,
      cropOffset.y
    );
  }, [cropSource, cropZoom, cropOffset]);

  useEffect(() => {
    if (!isLoaded) return;

    window.history.replaceState({ skillArenaScreen: screen }, "", `#${screen}`);

    const onPopState = (event: PopStateEvent) => {
      if (screen === "game" && (activeGame || countdown !== null)) {
        window.history.pushState({ skillArenaScreen: "game" }, "", "#game");
        return;
      }

      const target = event.state?.skillArenaScreen;
      setActiveGame(false);
      setCountdown(null);
      setResult(null);
      setTutorialOpen(false);
      setScreen(isScreen(target) ? target : onboarded ? "home" : "welcome");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLoaded, onboarded, screen, activeGame, countdown]);

  useEffect(() => {
    if (isLoaded && onboarded && screen === "home" && !tutorialSeen) {
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  }, [isLoaded, onboarded, screen, tutorialSeen]);

  useEffect(() => {
    if (screen !== "game") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "game" || countdown === null) return;
    if (countdown === 0) {
      gameTone("good");
      haptic([20, 35, 35]);
      const timer = window.setTimeout(() => {
        setCountdown(null);
        setActiveGame(true);
      }, 360);
      return () => window.clearTimeout(timer);
    }
    gameTone("countdown");
    haptic(8);
    const timer = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 650);
    return () => window.clearTimeout(timer);
  }, [screen, countdown]);

  function navigate(next: Screen, replace = false) {
    const resolved: Screen =
      next === "play" ? "home" : next === "wallet" ? "profile" : next;

    if (resolved === screen) return;

    const state = { skillArenaScreen: resolved };
    if (replace) window.history.replaceState(state, "", `#${resolved}`);
    else window.history.pushState(state, "", `#${resolved}`);
    setScreen(resolved);
  }

  function advanceTutorial() {
    if (tutorialStep < 2) {
      setTutorialStep((step) => step + 1);
      return;
    }
    localStorage.setItem(TUTORIAL_KEY, "1");
    setTutorialSeen(true);
    setTutorialOpen(false);
  }

  const rank = rankingFromEarnings(netEarnings);
  const nameAvailable = isDemoNameAvailable(playerName);
  const matchesPlayed = wins + losses;
  const winRate = matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;

  const chartPoints = useMemo(() => {
    if (earnings.length === 1) return "0,74 100,74";
    const values = earnings.map((p) => p.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const span = Math.max(1, max - min);
    return earnings
      .map((point, index) => {
        const x = (index / (earnings.length - 1)) * 100;
        const y = 92 - ((point.value - min) / span) * 76;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [earnings]);

  function chooseProvider(nextProvider: Exclude<Provider, null>) {
    setProvider(nextProvider);
    setAvatarId(0);
    setAvatarSrc(AVATARS[0]);
    setAvatarPrompt("");
    setAvatarEditorOpen(true);
    setAvatarError("");
    navigate("avatar-setup");
  }

  async function generateAvatarProposal() {
    const description = avatarPrompt.trim();
    if (!description) {
      setAvatarError("Describe tu avatar.");
      return;
    }

    setAvatarGenerating(true);
    setAvatarError("");
    try {
      const response = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, playerName: playerName.trim() }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.image !== "string") {
        throw new Error(data.error || "No se pudo generar el avatar.");
      }
      setAvatarSrc(await compactAvatarSource(data.image));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "No se pudo generar el avatar.");
    } finally {
      setAvatarGenerating(false);
    }
  }

  function handleAvatarUpload(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;

    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("La imagen es demasiado grande. Máximo 8 MB.");
      return;
    }

    setAvatarError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropSource(reader.result);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
  }

  async function applyAvatarCrop() {
    if (!cropSource) return;

    const cropped = await cropAvatarSource(
      cropSource,
      cropZoom,
      cropOffset.x,
      cropOffset.y
    );

    setAvatarSrc(cropped);
    setCropSource(null);
  }

  function moveCrop(clientX: number, clientY: number) {
    const drag = cropDragRef.current;
    if (!drag) return;

    setCropOffset({
      x: clamp(drag.ox + (clientX - drag.x) / 110, -1, 1),
      y: clamp(drag.oy + (clientY - drag.y) / 110, -1, 1),
    });
  }

  function completeAvatar() {
    const clean = playerName.trim().slice(0, 18);
    if (!isDemoNameAvailable(clean)) return;
    setPlayerName(clean);
    setOnboarded(true);
    navigate("home", true);
  }

  function openGame(game: GameMeta) {
    haptic(5);

    const preserveScrollY = screen === "play" ? window.scrollY : 0;
    const isSameSelection = screen === "play" && selectedGame.id === game.id;

    setSelectedGame(game);

    if (!isSameSelection) {
      setSelectedStake(0);
      const mode = modeForStake(game, 0, nextTurn);
      setSelectedMode(mode);
      setGhostEnabled(mode === "existing");
    }

    setResult(null);
    setActiveGame(false);

    if (screen !== "play") {
      navigate("play");
    } else {
      requestAnimationFrame(() => window.scrollTo(0, preserveScrollY));
    }
  }

  function selectStake(stake: Stake) {
    haptic(4);
    const mode = modeForStake(selectedGame, stake, nextTurn);
    setSelectedStake(stake);
    setSelectedMode(mode);
    setGhostEnabled(mode === "existing");
  }

  function startMatch(gameOverride?: GameMeta) {
    const game = gameOverride ?? selectedGame;
    const stake = selectedStake;
    const mode = modeForStake(game, stake, nextTurn);

    if (matchStartLockRef.current || stake > balance) return;

    matchStartLockRef.current = true;
    setStartingGameId(game.id);

    setSelectedGame(game);
    setSelectedStake(stake);
    setSelectedMode(mode);
    setGhostEnabled(mode === "existing");

    setBalance((b) => Number((b - stake).toFixed(2)));
    if (stake > 0) {
      setMovements((items) => [
        { label: `${game.name} · entrada`, amount: -stake },
        ...items,
      ].slice(0, 20));
    }

    setResult(null);
    setActiveGame(false);
    setGameKey((k) => k + 1);
    setCountdown(3);
    gameTone("countdown");
    haptic(12);
    navigate("game");
  }

  function finishMatch(gameResult: GameResult) {
    matchStartLockRef.current = false;
    setStartingGameId(null);
    setActiveGame(false);

    if (selectedGame.id === "tower-drop" && gameResult.verified !== true) {
      if (selectedStake > 0) {
        setBalance((value) => Number((value + selectedStake).toFixed(2)));
        setMovements((items) => [
          { label: `${selectedGame.name} · devolución verificación`, amount: selectedStake },
          ...items,
        ].slice(0, 20));
      }
      setResult({
        ...gameResult,
        won: false,
        score: 0,
        verified: false,
      });
      return;
    }

    const didWin = gameResult.score >= selectedGame.rivalScore;
    const resolvedResult = { ...gameResult, won: didWin };
    setResult(resolvedResult);

    if (selectedStake === 0) {
      gameTone(didWin ? "good" : "bad");
      haptic(didWin ? 10 : 20);
      return;
    }

    if (didWin) {
      setWins((value) => value + 1);
      setStreak((value) => value + 1);
      gameTone("win");
      haptic([30, 45, 60]);
    } else {
      setLosses((value) => value + 1);
      setStreak(0);
      gameTone("bad");
      haptic(35);
    }

    const prize = prizeForStake(selectedStake);
    const delta = didWin ? prize - selectedStake : -selectedStake;

    if (didWin && prize > 0) {
      setBalance((b) => Number((b + prize).toFixed(2)));
      setMovements((items) => [{ label: `${selectedGame.name} · premio`, amount: prize }, ...items].slice(0, 20));
    }

    const nextValue = Number((netEarnings + delta).toFixed(2));
    setNetEarnings(nextValue);
    setEarnings((points) => [...points, { label: `P${points.length}`, value: nextValue }].slice(-20));
    setNextTurn((turn) => (turn === "create" ? "existing" : "create"));
  }

  function resetAvatar() {
    const nextAvatarId = (avatarId + 1) % AVATARS.length;
    setAvatarId(nextAvatarId);
    setAvatarSrc(AVATARS[nextAvatarId]);
    setPlayerName("PLAYER_NEW");
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    setWins(0);
    setLosses(0);
    setStreak(0);
    navigate("profile");
  }

  function logoutDemo() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TUTORIAL_KEY);
    localStorage.removeItem("skill-arena-v10");
    setOnboarded(false);
    setProvider(null);
    setPlayerName("");
    setAvatarId(0);
    setAvatarSrc(AVATARS[0]);
    setAvatarPrompt("");
    setAvatarEditorOpen(false);
    setAvatarGenerating(false);
    setAvatarError("");
    setBalance(START_BALANCE);
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    setMovements([]);
    setWins(0);
    setLosses(0);
    setStreak(0);
    setCountdown(null);
    navigate("welcome", true);
  }

  if (screen === "welcome") {
    return (
      <main className="onboarding arenaOnboarding">
        <section className="welcomeCard welcomeCardCompact">
          <div className="arenaBadge">SA</div>
          <div className="wordmark">SKILL ARENA</div>
          <div className="authStack">
            <button className="authButton google" onClick={() => chooseProvider("google")}><span>G</span>Continuar con Google</button>
            <button className="authButton apple" onClick={() => chooseProvider("apple")}><span className="appleMark" aria-hidden="true"></span>Continuar con Apple</button>
          </div>
          <p className="microcopy">V11 · MOBILE COMPETITIVE BUILD</p>
        </section>
      </main>
    );
  }

  if (screen === "avatar-setup") {
    return (
      <main className="onboarding arenaOnboarding">
        <section className="setupCard avatarSetupCard avatarSetupMinimal">
          <div className="avatarPortraitWrap">
            <div className="avatarPortrait">
              <img src={avatarSrc} alt="Propuesta de avatar" />
              <button
                className={`avatarChangeButton ${avatarEditorOpen ? "open" : ""}`}
                type="button"
                onClick={() => setAvatarEditorOpen((open) => !open)}
                aria-label="Cambiar avatar"
                aria-expanded={avatarEditorOpen}
              >
                ↻
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="hiddenFileInput"
              type="file"
              accept="image/*"
              onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
            />
          </div>

          <input
            id="avatar-name"
            className="nameInput"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={18}
            placeholder="Nombre de avatar"
            aria-label="Nombre de avatar"
          />
          <div className={`nameAvailability ${nameAvailable ? "available" : "unavailable"}`}>
            {playerName.trim().length === 0 ? "" : nameAvailable ? "Disponible" : "No disponible"}
          </div>

          {avatarEditorOpen && (
            <div className="avatarEditor">
              <textarea
                id="avatar-prompt"
                className="promptInput"
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                maxLength={180}
                placeholder="Describe tu avatar..."
                aria-label="Descripción del avatar"
              />
              <div className="avatarActions">
                <button className="secondaryAction" type="button" onClick={generateAvatarProposal} disabled={avatarGenerating}>
                  {avatarGenerating ? "GENERANDO..." : "GENERAR CON IA"}
                </button>
                <button className="secondaryAction" type="button" onClick={() => fileInputRef.current?.click()}>SUBIR FOTO</button>
              </div>
              {avatarError && <div className="avatarError">{avatarError}</div>}
            </div>
          )}

          <button className="mainAction" onClick={completeAvatar} disabled={!nameAvailable || avatarGenerating}>CONTINUAR</button>

          {cropSource && (
            <div className="avatarCropOverlay" role="dialog" aria-modal="true" aria-label="Ajustar foto de avatar">
              <div className="avatarCropCard">
                <div className="cropTitle">
                  <strong>AJUSTA TU FOTO</strong>
                  <small>Arrastra la imagen dentro del círculo.</small>
                </div>
                <div
                  className="avatarCropViewport"
                  onPointerDown={(event) => {
                    cropDragRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      ox: cropOffset.x,
                      oy: cropOffset.y,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => moveCrop(event.clientX, event.clientY)}
                  onPointerUp={(event) => {
                    cropDragRef.current = null;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    cropDragRef.current = null;
                  }}
                >
                  <canvas ref={cropCanvasRef} width={240} height={240} />
                  <div className="cropCircleGuide" />
                </div>
                <label className="cropZoom">
                  <span>ZOOM</span>
                  <input
                    type="range"
                    min="1"
                    max="2.4"
                    step="0.05"
                    value={cropZoom}
                    onChange={(event) => setCropZoom(Number(event.target.value))}
                  />
                </label>
                <div className="cropActions">
                  <button type="button" onClick={() => setCropSource(null)}>CANCELAR</button>
                  <button type="button" className="primary" onClick={() => void applyAvatarCrop()}>USAR FOTO</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      {screen !== "game" && (
        <header className="appHeader">
          <button className="logoButton" onClick={() => navigate("home")}>SKILL ARENA</button>
          <button className="balanceChip" onClick={() => navigate("profile")}>{euro(balance)}</button>
        </header>
      )}

      <div className={`appBody ${screen === "game" ? "gameBody" : ""}`}>
        {screen === "home" && (
          <section className="catalogScreen playCatalogSimple homePlayMerged">
            <button className="playerStrip mergedPlayerStrip" onClick={() => navigate("profile")}>
              <img src={avatarSrc} alt="Avatar" />
              <strong>{playerName}</strong>
              <span className="rankNumber">#{rank}</span>
              <span className={`moneyNumber ${netEarnings < 0 ? "negative" : ""}`}>
                {netEarnings > 0 ? "+" : ""}{euro(netEarnings)}
              </span>
            </button>

            <div className="homePlayHeading">
              <div>
                <small>SKILL ARENA</small>
                <h1>Elige arena</h1>
              </div>
              <button type="button" onClick={() => navigate("profile")}>
                SALDO {euro(balance)}
              </button>
            </div>

            <div className="quickStakeBar" aria-label="Importe de la partida">
              {STAKES.map((stake) => (
                <button
                  key={stake}
                  className={selectedStake === stake ? "selected" : ""}
                  onClick={() => selectStake(stake)}
                  disabled={stake > balance}
                >
                  {stake === 0 ? "GRATIS" : `${stake}€`}
                </button>
              ))}
            </div>

            <div className="gameGrid large playGameGrid">
              {GAMES.map((game) => {
                const mode = modeForStake(game, selectedStake, nextTurn);
                const canPlay = selectedStake <= balance;

                return (
                  <article className="playGameCard" key={game.id}>
                    <div className="gameCoverWrap">
                      <img src={game.cover} alt={game.name} />
                      {mode === "existing" && (
                        <button
                          className={`cardGhostToggle ${ghostEnabled ? "active" : ""}`}
                          onClick={() => setGhostEnabled((value) => !value)}
                          aria-label="Mostrar u ocultar fantasma"
                          type="button"
                        >
                          👻
                        </button>
                      )}
                    </div>
                    <div className="playGameCardFooter">
                      <strong>{game.name}</strong>
                      <button
                        className="cardPlayButton"
                        type="button"
                        disabled={!canPlay || startingGameId !== null}
                        onClick={() => startMatch(game)}
                        aria-busy={startingGameId === game.id}
                      >
                        {startingGameId === game.id
                          ? "ENTRANDO…"
                          : selectedStake === 0
                            ? "JUGAR"
                            : `JUGAR · ${selectedStake}€`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {screen === "game" && (
          <section className="gameScreen">
            <div className="mobileGameHeader">
              <button
                className="mobileGameBack"
                onClick={() => {
                  if (!activeGame && countdown === null) window.history.back();
                }}
                aria-label="Volver"
              >
                ←
              </button>
              <div>
                <strong>{selectedGame.name}</strong>
                <small>{selectedStake === 0 ? "ENTRENAMIENTO" : `${selectedStake}€ · 1 VS 1`}</small>
              </div>
              {selectedMode === "existing" ? (
                <button
                  className={`ghostToggle ${ghostEnabled ? "active" : ""}`}
                  onClick={() => setGhostEnabled((value) => !value)}
                  aria-pressed={ghostEnabled}
                >
                  👻
                </button>
              ) : (
                <span className="fairPlayDot">●</span>
              )}
            </div>

            <div className="compactMatchStrip">
              <span>{playerName || "TÚ"}</span>
              <b>VS</b>
              <span>{selectedGame.rivalName}</span>
              {selectedMode === "existing" && ghostEnabled && <em>👻 fantasma activo</em>}
            </div>

            <div className="gameArenaWrap">
              <GameLoader
                game={selectedGame}
                active={activeGame}
                stake={selectedStake}
                ghostEnabled={selectedMode === "existing" && ghostEnabled}
                instanceKey={gameKey}
                onFinish={finishMatch}
              />
              {countdown !== null && (
                <div className="countdownOverlay">
                  <small>PREPÁRATE</small>
                  <b>{countdown > 0 ? countdown : "GO"}</b>
                </div>
              )}
            </div>

            {result && (
              <div className="resultPanel premiumResult neutralResult">
                {result.verified === false ? (
                  <>
                    <div className="resultIcon">⚠</div>
                    <b>RESULTADO NO VERIFICADO</b>
                    <p>No se registra este intento competitivo.</p>
                    {result.verificationError && (
                      <div className="verificationErrorCode">{result.verificationError}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="demoPercentileBlock resultOnlyPercentile">
                      <span>MEJOR QUE</span>
                      <strong>{demoPercentile(result.score, selectedGame.rivalScore)}%</strong>
                      <small>DE LOS INTENTOS DEMO DE REFERENCIA</small>
                    </div>
                    {result.verified === true && (
                      <div className="serverVerifiedBadge">
                        ✓ SERVER REPLAY VERIFICADO
                        {result.verificationId && <small>ID {result.verificationId.slice(0, 8)}</small>}
                      </div>
                    )}
                  </>
                )}
                <div className="resultActions">
                  <button className="rematchAction" onClick={() => startMatch()}>OTRA VEZ</button>
                  <button className="mainAction" onClick={() => navigate("home")}>OTRO JUEGO</button>
                </div>
              </div>
            )}
          </section>
        )}

        {screen === "profile" && (
          <section className="simpleScreen">
            <div className="screenTop"><span>{playerName || "PERFIL"}</span></div>
            <div className="profileStrip"><img src={avatarSrc} alt="Avatar" /><div><strong>{playerName}</strong><span>#{rank}</span></div><b className={netEarnings < 0 ? "negative" : ""}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</b></div>

            <section className="accountWalletCard">
              <div>
                <small>SALDO</small>
                <strong>{euro(balance)}</strong>
              </div>
              <div className="walletActions">
                <button onClick={() => {
                  setBalance((b) => b + 10);
                  setMovements((m) => [{ label: "Ingreso demo", amount: 10 }, ...m]);
                }}>INGRESAR</button>
                <button
                  disabled={balance < 10}
                  onClick={() => {
                    setBalance((b) => Number((b - 10).toFixed(2)));
                    setMovements((m) => [{ label: "Retirada demo", amount: -10 }, ...m]);
                  }}
                >RETIRAR</button>
              </div>
              <div className="miniMovementList">
                {movements.slice(0, 3).map((movement, index) => (
                  <div key={`${movement.label}-${index}`}>
                    <span>{movement.label}</span>
                    <b className={movement.amount < 0 ? "negative" : ""}>
                      {movement.amount > 0 ? "+" : ""}{euro(movement.amount)}
                    </b>
                  </div>
                ))}
              </div>
            </section>

            <div className="chartPanel">
              <div className="chartHead"><span>DINERO GANADO</span><strong>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</strong></div>
              <svg className="earningsChart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Dinero ganado en función del tiempo">
                <line x1="0" y1="50" x2="100" y2="50" className="zeroLine" />
                <polyline points={chartPoints} className="profitLine" />
              </svg>
              <div className="chartAxis"><span>INICIO</span><span>AHORA</span></div>
            </div>
            <div className="settingsList">
              <button onClick={() => setMusicOn((v) => !v)}><span>SONIDO</span><b>{musicOn ? "ON" : "OFF"}</b></button>
              <button onClick={() => { setAvatarEditorOpen(true); setAvatarError(""); navigate("avatar-setup"); }}><span>CAMBIAR NOMBRE / AVATAR</span><b>→</b></button>
              <button onClick={resetAvatar}><span>RESETEAR AVATAR</span><b>0 €</b></button>
              <button onClick={() => navigate("legal")}><span>LEGAL</span><b>→</b></button>
              <button onClick={logoutDemo}><span>CERRAR SESIÓN DEMO</span><b>×</b></button>
            </div>
            <p className="resetNote">Resetear avatar reinicia ranking y resultado competitivo visible. El saldo de wallet no se borra.</p>
          </section>
        )}

        {screen === "legal" && (
          <section className="simpleScreen">
            <div className="screenTop"><button className="textBack" onClick={() => window.history.back()}>← {playerName || "PERFIL"}</button><span>LEGAL</span></div>
            <div className="legalTabs">
              <button className={legalTab === "terms" ? "active" : ""} onClick={() => setLegalTab("terms")}>TÉRMINOS</button>
              <button className={legalTab === "privacy" ? "active" : ""} onClick={() => setLegalTab("privacy")}>PRIVACIDAD</button>
              <button className={legalTab === "cookies" ? "active" : ""} onClick={() => setLegalTab("cookies")}>COOKIES</button>
              <button className={legalTab === "rules" ? "active" : ""} onClick={() => setLegalTab("rules")}>REGLAS</button>
            </div>
            <article className="legalCopy">
              <h2>{legalTab === "terms" ? "Términos y condiciones" : legalTab === "privacy" ? "Privacidad" : legalTab === "cookies" ? "Cookies" : "Reglas de competición"}</h2>
              <p>Contenido de demostración. Antes de operar con dinero real esta sección deberá sustituirse por documentación jurídica revisada y aplicable al servicio definitivo.</p>
              <p>La arquitectura reserva esta pantalla para que las condiciones sean accesibles desde la aplicación móvil sin depender de una web externa.</p>
            </article>
          </section>
        )}
      </div>

      {tutorialOpen && screen === "home" && (
        <div className="tutorialOverlay" role="dialog" aria-modal="true" aria-label="Tutorial de tipos de partida">
          <div className="tutorialCard">
            <div className="tutorialProgress">PRIMERA VEZ · {tutorialStep + 1}/3</div>
            <h2>{tutorialStep === 0 ? "VERDE · TÚ CREAS" : tutorialStep === 1 ? "AZUL · YA EXISTE UNA JUGADA" : "MORADO · HAY ALGUIEN ESPERANDO"}</h2>
            <button className={`tutorialStake ${tutorialStep === 0 ? "create" : tutorialStep === 1 ? "existing" : "waiting"}`} disabled>
              5€
            </button>
            <p>
              {tutorialStep === 0
                ? "Juegas primero. Tu resultado queda guardado para que otro jugador intente superarlo."
                : tutorialStep === 1
                  ? "Otro jugador ya dejó su resultado. Tú juegas ahora para intentar superarlo."
                  : "Hay un jugador esperando una partida de este importe. Este color indica cola activa."}
            </p>
            <div className={`tutorialActions ${tutorialStep === 0 ? "single" : ""}`}>
              {tutorialStep > 0 && <button className="tutorialBack" onClick={() => setTutorialStep((step) => Math.max(0, step - 1))}>ATRÁS</button>}
              <button className="mainAction" onClick={advanceTutorial}>{tutorialStep < 2 ? "SIGUIENTE" : "ENTENDIDO"}</button>
            </div>
          </div>
        </div>
      )}

      {screen !== "game" && screen !== "legal" && (
        <nav className="bottomNav bottomNavTwo" aria-label="Navegación principal">
          <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}>
            <span>▶</span>JUGAR
          </button>
          <button className={screen === "profile" ? "active" : ""} onClick={() => navigate("profile")}>
            <img src={avatarSrc} alt="" />CUENTA
          </button>
        </nav>
      )}
    </main>
  );
}
