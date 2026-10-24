"use client";
import GameResultSummary from "./GameResultSummary";
import { safeStorage } from "@/lib/safeStorage";
import GameActionButton from "./GameActionButton";
import CatalogBrowser from "./CatalogBrowser";
import shellStyles from "./ProductShell.module.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicMatchAvailability, usePendingMatchResolution } from "@/lib/usePublicMatchState";
import GalacticMark from "./GalacticMark";
import { PRODUCT_NAME } from "@/lib/productIdentity";
import GameLoader from "./GameLoader";
import RecentAttempts from "./RecentAttempts";
import GlobalRanking from "./GlobalRanking";
import GroupHub from "./GroupHub";
import { GAMES, STAKES, modeForStake, prizeForStake, type GameMeta, type MatchMode, type Stake } from "@/lib/games";
import { competitionProgressLabel, createDemoClosedGroup, joinDemoClosedGroup, groupPot, groupTargetScore, payoutLabel, type ClosedGroup, type GroupCompetitionConfig } from "@/lib/groupPlay";
import type { GameResult } from "@/lib/types";
import { useProgression } from "./useProgression";
import PlayerProgress from "./PlayerProgress";
import RiskPicker from "./RiskPicker";
import RunRewards from "./RunRewards";
import type { RiskId, RunApplied } from "@/lib/progression";
import { gameTone, haptic, setGameSoundEnabled, startGameMusic, stopGameMusic } from "@/lib/gameFeedback";

type Screen = "welcome" | "avatar-setup" | "home" | "group" | "game" | "profile" | "legal" | "ranking";
type Provider = "google" | "apple" | null;
type Turn = "create" | "existing";
type MatchScope = "duel" | "group";

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
  group: ClosedGroup | null;
};

const VALID_SCREENS: Screen[] = ["welcome", "avatar-setup", "home", "group", "game", "profile", "legal", "ranking"];

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && VALID_SCREENS.includes(value as Screen);
}

const AVATARS = Array.from({ length: 16 }, (_, i) => `/avatars/portrait-${String(i + 1).padStart(2, "0")}.webp`);
/** Small variant for grids/lists; the full 512 px image is only used for the large preview. */
const avatarThumb = (src: string) => (/\/portrait-\d{2}\.webp$/.test(src) ? src.replace(".webp", "-s.webp") : src);
const START_BALANCE = 25;
const APP_ITERATION = "v12";
const STORAGE_KEY = `skill-arena-${APP_ITERATION}`;
const TUTORIAL_KEY = `skill-arena-color-tutorial-${APP_ITERATION}`;

function euro(value: number) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function totalCompetitionStages(
  config: GroupCompetitionConfig,
  memberCount: number
) {
  if (config.type === "league") return config.rounds;
  if (config.type === "tournament") {
    return Math.max(
      1,
      Math.ceil(
        (Math.max(2, memberCount) - 1) /
          Math.max(1, config.eliminatedPerRound)
      )
    );
  }
  return 1;
}

function payoutShare(
  config: GroupCompetitionConfig,
  placement: 1 | 2 | 3
) {
  if (config.distribution === "top2-70-30") {
    return placement === 1 ? 0.7 : placement === 2 ? 0.3 : 0;
  }
  if (config.distribution === "top3-60-30-10") {
    return placement === 1 ? 0.6 : placement === 2 ? 0.3 : 0.1;
  }
  return placement === 1 ? 1 : 0;
}

const BLOCKED_DEMO_NAMES = new Set(["admin", "skillarena", "skill_arena", "soporte", "support"]);

function isDemoNameAvailable(value: string) {
  const clean = value.trim();
  if (!/^[A-Za-z0-9_ ]{3,18}$/.test(clean) || /\s{2,}/.test(clean)) return false;
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
  const [avatarListOpen, setAvatarListOpen] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarSection, setAvatarSection] = useState<"profile" | "ranking">("profile");
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const matchStartLockRef = useRef(false);
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
  const [matchStartError,setMatchStartError]=useState("");
  const settledMatchesRef=useRef(new Set<string>());
  const [balance, setBalance] = useState(START_BALANCE);
  const [netEarnings, setNetEarnings] = useState(0);
  const [nextTurn, setNextTurn] = useState<Turn>("create");
  const [musicOn, setMusicOn] = useState(true);
  const [earnings, setEarnings] = useState<EarningsPoint[]>([{ label: "Inicio", value: 0 }]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameMeta>(GAMES[0]);
  const resultPointerReadyRef = useRef(false);
  const [selectedStake, setSelectedStake] = useState<number>(0);
  // Player-experience layer (local only): progress, risk decision before each game, rewards after it.
  const { progress, recordRun, claim, takeChest, equipItem } = useProgression();
  const [risk, setRisk] = useState<RiskId>("calm");
  const runRiskRef = useRef<RiskId>("calm");
  const recordedKeyRef = useRef(-1);
  const [runApplied, setRunApplied] = useState<RunApplied | null>(null);
  const [selectedMode, setSelectedMode] = useState<MatchMode>("create");
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [activeGame, setActiveGame] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [resultActionsReady, setResultActionsReady] = useState(false);
  useEffect(() => {
    setResultActionsReady(false);
    if (!result) return;
    const timer = window.setTimeout(() => setResultActionsReady(true), 350);
    return () => window.clearTimeout(timer);
  }, [result]);
  const [attemptSummary, setAttemptSummary] = useState<GameResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [group, setGroup] = useState<ClosedGroup | null>(null);
  const [matchScope, setMatchScope] = useState<MatchScope>("duel");
  const [matchTargetScore, setMatchTargetScore] = useState(GAMES[0].rivalScore);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [groupCompetition, setGroupCompetition] = useState<GroupCompetitionConfig | null>(null);
  const [groupStage, setGroupStage] = useState(1);
  const [groupCompetitionWins, setGroupCompetitionWins] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const freshOnboardingRef = useRef(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy" | "cookies" | "rules">("terms");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Cada visita nueva (pestaña nueva al pulsar el enlace) empieza en el login inicial.
    // Recargar la misma pestaña conserva la sesión; `?keep=1` desactiva el reinicio.
    let sessionLive = false;
    try {
      sessionLive = window.sessionStorage.getItem("ga-session-live") === "1";
      window.sessionStorage.setItem("ga-session-live", "1");
    } catch {
      sessionLive = false;
    }
    const resetMode = params.get("reset") === "1" || (params.get("keep") !== "1" && params.get("fresh") !== "1" && !sessionLive);
    const freshMode = !resetMode && params.get("fresh") === "1";
    const joinCode = (params.get("join") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    setPendingJoinCode(joinCode);
    freshOnboardingRef.current = freshMode;

    if (resetMode) {
      safeStorage.keys().filter((key) => key.startsWith("skill-arena-")).forEach((key) => safeStorage.removeItem(key));

      setOnboarded(false);
      setProvider(null);
      setPlayerName("");
      const randomAvatar = Math.floor(Math.random() * AVATARS.length);
      setAvatarId(randomAvatar);
      setAvatarSrc(AVATARS[randomAvatar]);
      setAvatarEditorOpen(true);
      setAvatarError("");
      setBalance(START_BALANCE);
      setNetEarnings(0);
      setNextTurn("create");
      setMusicOn(true);
      setEarnings([{ label: "Inicio", value: 0 }]);
      setMovements([]);
      setTutorialSeen(false);


      setWins(0);
      setLosses(0);
      setStreak(0);
      setGroup(null);
      setScreen("welcome");
      setIsLoaded(true);
      return;
    }

    // En desarrollo queremos probar siempre el flujo completo desde cero.
    // En producción, el onboarding y el tutorial se recuerdan normalmente.
    if (process.env.NODE_ENV === "development" && !freshMode) {
      setOnboarded(false);
      setProvider(null);
      setPlayerName("");
      const randomAvatar = Math.floor(Math.random() * AVATARS.length);
      setAvatarId(randomAvatar);
      setAvatarSrc(AVATARS[randomAvatar]);
      setAvatarEditorOpen(true);
      setAvatarError("");
      setScreen("welcome");
      setTutorialSeen(false);


      setGroup(null);
      setIsLoaded(true);
      return;
    }

    let restoredOnboarded = false;
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as Partial<PersistedState>;
        if (data.onboarded) {
          restoredOnboarded = true;
          setOnboarded(true);
          setScreen(joinCode ? "group" : "home");
        }
        if (data.provider === "google" || data.provider === "apple") {
          setProvider(data.provider);
        }
        if (typeof data.playerName === "string") {
          setPlayerName(data.playerName);
        }
        if (typeof data.avatarId === "number") {
          const nextAvatarId = Math.max(
            0,
            Math.min(AVATARS.length - 1, data.avatarId)
          );
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
        if (typeof data.netEarnings === "number") {
          setNetEarnings(data.netEarnings);
        }
        if (
          data.nextTurn === "create" ||
          data.nextTurn === "existing"
        ) {
          setNextTurn(data.nextTurn);
        }
        if (typeof data.musicOn === "boolean") {
          setMusicOn(data.musicOn);
        }
        if (Array.isArray(data.earnings) && data.earnings.length) {
          setEarnings(data.earnings.slice(-20));
        }
        if (Array.isArray(data.movements)) {
          setMovements(data.movements.slice(0, 20));
        }
        if (typeof data.wins === "number") setWins(data.wins);
        if (typeof data.losses === "number") setLosses(data.losses);
        if (typeof data.streak === "number") setStreak(data.streak);
        if (data.group && typeof data.group === "object") {
          setGroup(data.group as ClosedGroup);
        }
      } catch {}
    }

    setTutorialSeen(safeStorage.getItem(TUTORIAL_KEY) === "1");

    if (freshMode) {
      // Repite solo el onboarding. El resto de la cuenta se conserva hasta
      // que el usuario complete de nuevo su perfil.
      setOnboarded(false);
      setProvider(null);
      setPlayerName("");
      const randomAvatar = Math.floor(Math.random() * AVATARS.length);
      setAvatarId(randomAvatar);
      setAvatarSrc(AVATARS[randomAvatar]);
      setAvatarEditorOpen(true);
      setAvatarError("");
      setScreen("welcome");


    } else if (joinCode && restoredOnboarded) {
      setScreen("group");
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    // ?fresh=1 is a transient onboarding pass. Do not overwrite the saved
    // account if the tester closes the tab before finishing onboarding.
    if (freshOnboardingRef.current && !onboarded) return;

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
      group,
    };
    try {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be full on mobile; gameplay must continue even if persistence fails.
    }
  }, [isLoaded, onboarded, provider, playerName, avatarId, avatarSrc, balance, netEarnings, nextTurn, musicOn, earnings, movements, tutorialSeen, wins, losses, streak, group]);

  function toggleSound() {
    const enabled = !musicOn;
    // Apply mute/unlock within the click instead of waiting for a React effect.
    setGameSoundEnabled(enabled, true);
    setMusicOn(enabled);
  }

  useEffect(() => {
    setGameSoundEnabled(musicOn);
  }, [musicOn]);

  useEffect(() => {
    if (screen === "game" && activeGame && musicOn) {
      startGameMusic(selectedGame.id);
      return () => stopGameMusic();
    }

    // Outside a game the lobby plays a calm ambient loop (only once onboarding is done).
    if (musicOn && screen !== "game" && onboarded) {
      startGameMusic("menu");
      return () => stopGameMusic();
    }

    stopGameMusic();
    return undefined;
  }, [screen, activeGame, musicOn, selectedGame.id, onboarded]);

  // Every button gets the same soft tap sound, so the interface feels alive.
  useEffect(() => {
    if (!musicOn) return undefined;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, [role=button]") && !target.closest("canvas, .detGameSurface, .coreGameSurface")) gameTone("tap");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [musicOn]);

  useEffect(() => {
    if (!showWinAnimation) return;
    const timer = window.setTimeout(() => setShowWinAnimation(false), 1350);
    return () => window.clearTimeout(timer);
  }, [showWinAnimation]);

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

    window.history.replaceState({ skillArenaScreen: screen, avatarSection }, "", `#${screen}`);

    const onPopState = (event: PopStateEvent) => {
      if (screen === "game" && (activeGame || countdown !== null)) {
        window.history.pushState({ skillArenaScreen: "game" }, "", "#game");
        return;
      }

      const target = event.state?.skillArenaScreen;
      if (target === "ranking") {
        window.history.replaceState({ skillArenaScreen: "profile", avatarSection: "ranking" }, "", "#profile");
      }
      setActiveGame(false);
      setCountdown(null);
      setResult(null);
      setAttemptSummary(null);

      setAvatarSection(target === "ranking" || event.state?.avatarSection === "ranking" ? "ranking" : "profile");
      setScreen(target === "ranking" ? "profile" : isScreen(target) ? target : onboarded ? "home" : "welcome");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLoaded, onboarded, screen, activeGame, countdown, avatarSection]);


  // A new screen starts at the top; coming back from a game restores where the
  // catalogue (or group page) was, so the player does not lose their place.
  const previousScreenRef = useRef<Screen | null>(null);
  const scrollMemoryRef = useRef<Partial<Record<Screen, number>>>({});
  useEffect(() => {
    const onScroll = () => {
      const current = previousScreenRef.current;
      if (current && current !== "game") scrollMemoryRef.current[current] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const previous = previousScreenRef.current;
    previousScreenRef.current = screen;
    if (previous === null || previous === screen || screen === "game") return;
    window.scrollTo(0, previous === "game" ? (scrollMemoryRef.current[screen] ?? 0) : 0);
  }, [screen]);

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
    // Keep historical ranking navigation compatible, inside Avatar.
    const target = next === "ranking" ? "profile" : next;
    const section = next === "ranking" ? "ranking" : "profile";
    if (target === "profile") setAvatarSection(section);
    if (target === screen) return;

    const state = { skillArenaScreen: target, avatarSection: section };
    if (replace) window.history.replaceState(state, "", `#${target}`);
    else window.history.pushState(state, "", `#${target}`);
    setScreen(target);
  }

  function leaveGameNow() {
    const entryWasCharged =
      matchScope !== "group" ||
      !groupCompetition ||
      groupCompetition.type === "quick" ||
      groupStage === 1;

    if (selectedStake > 0 && !result && entryWasCharged && !activeGame) {
      setBalance((value) => Number((value + selectedStake).toFixed(2)));
      setMovements((items) => [
        {
          label: `${selectedGame.name} · cancelación local`,
          amount: selectedStake,
        },
        ...items,
      ].slice(0, 20));
    }

    if(!result&&activeGame){setLosses(value=>value+1);setStreak(0);}
    matchStartLockRef.current = false;
    setStartingGameId(null);
    setActiveGame(false);
    setCountdown(null);
    setResult(null);
    setAttemptSummary(null);
    setShowWinAnimation(false);
    setExitConfirmOpen(false);
    navigate(matchScope === "group" ? "group" : "home", true);
  }

  function requestExitGame() {
    if (activeGame || countdown !== null) {
      if (selectedStake === 0) {
        leaveGameNow();
      } else {
        setExitConfirmOpen(true);
      }
      return;
    }

    leaveGameNow();
  }

  const nameAvailable = isDemoNameAvailable(playerName);
  const matchesPlayed = wins + losses;
  const winRate = matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;
  const groupStageTotal =
    group && groupCompetition
      ? totalCompetitionStages(groupCompetition, group.members.length)
      : 1;
  const groupCanAdvance =
    matchScope === "group" &&
    groupCompetition !== null &&
    group !== null &&
    groupCompetition.type !== "quick" &&
    groupStage < groupStageTotal &&
    result?.verified !== false &&
    (groupCompetition.type !== "tournament" || result?.won === true);

  const chartPoints = useMemo(() => {
    if (earnings.length < 2) return "0,50 100,50";
    const extent = Math.max(1, ...earnings.map((point) => Math.abs(point.value)));
    return earnings
      .map((point, index) => {
        const x = (index / (earnings.length - 1)) * 100;
        const y = 50 - (point.value / extent) * 40;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [earnings]);

  function continueWithoutProvider() {
    setProvider(null);
    const firstAvatar = Math.floor(Math.random() * AVATARS.length);
    setAvatarId(firstAvatar);
    setAvatarSrc(AVATARS[firstAvatar]);
    setAvatarEditorOpen(false);
    setAvatarError("");
    navigate("avatar-setup");
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
    const clean = playerName.trim().replace(/\s+/g, " ").slice(0, 18);
    if (!isDemoNameAvailable(clean)) return;
    setPlayerName(clean);
    setOnboarded(true);
    freshOnboardingRef.current = false;
    navigate(pendingJoinCode ? "group" : "home", true);
  }

  function selectStake(stake: Stake) {
    haptic(4);
    const mode = modeForStake(selectedGame, stake, nextTurn);
    setSelectedStake(stake);
    setSelectedMode(mode);
    setGhostEnabled(mode === "existing");
  }

  const {persistentTraining,liveModes}=usePublicMatchAvailability(isLoaded&&onboarded,screen==="home",selectedStake);
  usePendingMatchResolution(screen==="game"&&result!==null,attemptSummary,finishMatch);

  useEffect(() => {
    if (!result || result.forfeited || result.verified === false || recordedKeyRef.current === gameKey) return;
    recordedKeyRef.current = gameKey;
    const final = attemptSummary ?? result;
    const reach = final.verified === true && final.height !== undefined && Number.isSafeInteger(final.height) && final.height >= 0 ? final.height : final.score;
    setRunApplied(recordRun({ gameId: selectedGame.id, score: reach, won: final.won, risk: runRiskRef.current }));
  }, [result, attemptSummary, gameKey, selectedGame.id, recordRun]);

  function startMatch(gameOverride?: GameMeta) {
    const game = gameOverride ?? selectedGame;
    const stake = selectedStake;
    const mode = persistentTraining ? (liveModes[game.id]??"create") : modeForStake(game, stake as Stake, nextTurn);

    if (matchStartLockRef.current || stake > balance) return;
    if(persistentTraining && stake>0 && game.competition.verification!=="server-replay"){
      setMatchStartError("Este juego solo admite entrenamiento local");return;
    }
    setMatchStartError("");

    matchStartLockRef.current = true;
    setStartingGameId(game.id);

    setSelectedGame(game);
    setSelectedStake(stake);
    setSelectedMode(mode);
    setGhostEnabled(mode === "existing");
    setMatchScope("duel");
    setMatchTargetScore(persistentTraining ? 1_000_000_000 : game.rivalScore);
    setShowWinAnimation(false);
    setExitConfirmOpen(false);

    setBalance((b) => Number((b - stake).toFixed(2)));
    if (stake > 0) {
      setMovements((items) => [
        { label: `${game.name} · entrada`, amount: -stake },
        ...items,
      ].slice(0, 20));
    }

    setResult(null);
    setAttemptSummary(null);
    setRunApplied(null);
    runRiskRef.current = risk;
    setActiveGame(false);
    setGameKey((k) => k + 1);
    setCountdown(3);
    gameTone("countdown");
    haptic(12);
    navigate("game");
  }

  function finishMatch(gameResult: GameResult) {
    resultPointerReadyRef.current = false;
    matchStartLockRef.current = false;
    setStartingGameId(null);
    setActiveGame(false);

    if (selectedGame.competition.verification === "server-replay" && gameResult.verified !== true) {
      // A started attempt is lost on disconnect/failed verification, never refunded by UI.
      setLosses(value=>value+1);setStreak(0);
      setResult({
        ...gameResult,
        won: false,
        score: 0,
        verified: false,
        forfeited: gameResult.forfeited || gameResult.verificationError === "ATTEMPT_FORFEITED",
      });
      return;
    }

    if(gameResult.serverMatch){
      setAttemptSummary(gameResult);
      if(gameResult.serverMatch.status==="waiting"){
        setSelectedMode("create");setResult({...gameResult,won:false});return;
      }
      if(settledMatchesRef.current.has(gameResult.serverMatch.matchId))return;
      settledMatchesRef.current.add(gameResult.serverMatch.matchId);
    }

    setAttemptSummary(gameResult);

    const replyAttempt =
      matchScope === "duel" &&
      (selectedMode === "existing" || selectedMode === "waiting");

    const didWin = gameResult.serverMatch
      ? gameResult.serverMatch.winnerSlot === gameResult.serverMatch.slot
      : selectedStake === 0
        ? gameResult.won
        : matchScope === "group"
          ? gameResult.won || gameResult.score >= matchTargetScore
          : replyAttempt
            ? gameResult.won || gameResult.score >= matchTargetScore
            : false;
    const resolvedResult = { ...gameResult, won: didWin };
    setAttemptSummary(resolvedResult);
    if(gameResult.serverMatch?.reason==="exact-tie"){
      setResult(resolvedResult);
      if(selectedStake>0)setBalance(value=>Number((value+selectedStake).toFixed(2)));
      return;
    }
    // Balance games (slot, roulette) do not celebrate a "challenge cleared".
    if (didWin && selectedGame.resultMetric !== "fictitious-balance") setShowWinAnimation(true);
    setResult(resolvedResult);

    const inGroupCompetition =
      matchScope === "group" && group !== null && groupCompetition !== null;

    const winsAfter = groupCompetitionWins + (didWin ? 1 : 0);
    if (inGroupCompetition && didWin) {
      setGroupCompetitionWins(winsAfter);
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

    if (selectedStake === 0) return;

    if (inGroupCompetition && group && groupCompetition) {
      const totalStages = totalCompetitionStages(
        groupCompetition,
        group.members.length
      );
      const eliminated =
        groupCompetition.type === "tournament" && !didWin;
      const competitionFinished =
        groupCompetition.type === "quick" ||
        groupStage >= totalStages ||
        eliminated;

      if (!competitionFinished) return;

      let placement: 1 | 2 | 3 = 1;

      if (groupCompetition.type === "league") {
        const ratio = winsAfter / Math.max(1, totalStages);
        placement = ratio >= 0.67 ? 1 : ratio >= 0.34 ? 2 : 3;
      } else if (groupCompetition.type === "tournament") {
        placement =
          didWin && groupStage >= totalStages
            ? 1
            : groupStage >= totalStages
              ? 2
              : 3;
      } else {
        placement = didWin ? 1 : 3;
      }

      const pot = groupPot(group, groupCompetition.stake);
      const prize =
        groupCompetition.type === "quick" && !didWin
          ? 0
          : Number(
              (pot * payoutShare(groupCompetition, placement)).toFixed(2)
            );
      const delta = Number(
        (prize - groupCompetition.stake).toFixed(2)
      );

      if (prize > 0) {
        setBalance((value) => Number((value + prize).toFixed(2)));
        setMovements((items) => [
          {
            label: `${group.name} · premio ${payoutLabel(groupCompetition.distribution)}`,
            amount: prize,
          },
          ...items,
        ].slice(0, 20));
      }

      const nextValue = Number((netEarnings + delta).toFixed(2));
      setNetEarnings(nextValue);
      setEarnings((points) => [
        ...points,
        { label: `P${points.length}`, value: nextValue },
      ].slice(-20));
      return;
    }

    const prize = prizeForStake(selectedStake);
    const delta = didWin ? prize - selectedStake : -selectedStake;

    if (didWin && prize > 0) {
      setBalance((value) => Number((value + prize).toFixed(2)));
      setMovements((items) => [
        { label: `${selectedGame.name} · premio`, amount: prize },
        ...items,
      ].slice(0, 20));
    }

    const nextValue = Number((netEarnings + delta).toFixed(2));
    setNetEarnings(nextValue);
    setEarnings((points) => [
      ...points,
      { label: `P${points.length}`, value: nextValue },
    ].slice(-20));
    // One green attempt creates exactly one reply opportunity.
    // A blue/purple reply consumes it; purple never generates an extra blue.
    setNextTurn(selectedMode === "create" ? "existing" : "create");
  }

  function createClosedGroup(name: string, stake: number) {
    const next = createDemoClosedGroup({
      name,
      stake,
      playerName: playerName || "TÚ",
      avatar: avatarSrc,
    });
    setGroup(next);
    gameTone("good");
    haptic(8);
  }

  function joinClosedGroup(code: string) {
    const next = joinDemoClosedGroup({
      code,
      playerName: playerName || "TÚ",
      avatar: avatarSrc,
    });

    setGroup(next);
    setPendingJoinCode("");
    gameTone("good");
    haptic(8);
  }

  function setClosedGroupStake(stake: number) {
    setGroup((current) => current ? { ...current, stake } : current);
    haptic(4);
  }

  function startGroupCompetition(
    game: GameMeta,
    config: GroupCompetitionConfig,
    options?: { chargeEntry?: boolean; nextStage?: number }
  ) {
    const chargeEntry = options?.chargeEntry ?? true;
    if (
      !group ||
      matchStartLockRef.current ||
      (chargeEntry && config.stake > balance)
    ) {
      return;
    }
    if(persistentTraining!==false){setMatchStartError("Grupos no disponibles en esta sesión");return;}
    setMatchStartError("");
    const nextStage = options?.nextStage ?? 1;

    matchStartLockRef.current = true;
    setStartingGameId(game.id);
    setSelectedGame(game);
    setSelectedStake(config.stake);
    setSelectedMode("create");
    setGhostEnabled(false);
    setMatchScope("group");
    setMatchTargetScore(groupTargetScore(group, game));
    setShowWinAnimation(false);
    setExitConfirmOpen(false);
    setGroupCompetition(config);
    setGroupStage(nextStage);
    if (chargeEntry) setGroupCompetitionWins(0);

    if (chargeEntry && config.stake > 0) {
      setBalance((value) => Number((value - config.stake).toFixed(2)));
      setMovements((items) => [
        {
          label:
            config.type === "quick"
              ? `${group.name} · partida rápida`
              : config.type === "league"
                ? `${group.name} · entrada liga`
                : `${group.name} · entrada torneo`,
          amount: -config.stake,
        },
        ...items,
      ].slice(0, 20));
    }

    setResult(null);
    setAttemptSummary(null);
    setActiveGame(false);
    setGameKey((key) => key + 1);
    setCountdown(3);
    gameTone("countdown");
    haptic(12);
    navigate("game");
  }

  function repeatOrContinueGroupCompetition() {
    if (!group || !groupCompetition) return;

    if (groupCompetition.type === "quick") {
      startGroupCompetition(selectedGame, groupCompetition, {
        chargeEntry: true,
        nextStage: 1,
      });
      return;
    }

    const nextStage = groupStage + 1;
    const nextGameId =
      groupCompetition.gameIds[nextStage - 1] ??
      groupCompetition.gameIds[0];
    const nextGame =
      GAMES.find((game) => game.id === nextGameId) ??
      selectedGame;

    startGroupCompetition(nextGame, groupCompetition, {
      chargeEntry: false,
      nextStage,
    });
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
    safeStorage.removeItem(STORAGE_KEY);
    safeStorage.removeItem(TUTORIAL_KEY);
    safeStorage.removeItem("skill-arena-v10");
    setOnboarded(false);
    setProvider(null);
    setPlayerName("");
    setAvatarId(0);
    setAvatarSrc(AVATARS[0]);
    setAvatarEditorOpen(false);
    setAvatarError("");
    setBalance(START_BALANCE);
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    setMovements([]);
    setWins(0);
    setLosses(0);
    setStreak(0);
    setGroup(null);
    setCountdown(null);
    navigate("welcome", true);
  }

  if (screen === "welcome") {
    return (
      <main className="onboarding arenaOnboarding">
        <section className="welcomeCard welcomeCardCompact">
          <GalacticMark className="galacticWelcomeMark" />
          <h1 className="wordmark">{PRODUCT_NAME}</h1>
          <div className="authStack">

            <div className="galacticProviderRow">
              <button className="authButton google" disabled aria-label="Google, próximamente"><span aria-hidden="true">G</span>Google</button>
              <button className="authButton apple" disabled aria-label="Apple, próximamente"><span aria-hidden="true">●</span>Apple</button>
            </div>
            <button className="authButton guest galacticEntryAction" aria-label="Iniciar sesión local" onClick={continueWithoutProvider}><span>INICIAR SESIÓN</span><small>SESIÓN LOCAL</small></button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "avatar-setup") {
    return (
      <main className="onboarding arenaOnboarding">
        <section className="setupCard avatarSetupCard avatarSetupMinimal galacticAvatarSetup">
          <small className="galacticSetupBrand">{PRODUCT_NAME}</small>
          <h1>Elige tu identidad</h1>
          <div className="avatarPortraitWrap">
            <div className="avatarPortrait">
              <img src={avatarSrc} alt="Propuesta de avatar" />
              <button
                className={`avatarChangeButton ${avatarEditorOpen ? "open" : ""}`}
                type="button"
                onClick={() => { setAvatarError(""); fileInputRef.current?.click(); }}
                aria-label="Subir foto de avatar"
              >
                ↻
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="hiddenFileInput"
              type="file"
              accept="image/*"
              onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          <button type="button" className="avatarListToggle" aria-expanded={avatarListOpen} onClick={() => setAvatarListOpen((v) => !v)}>{avatarListOpen ? "OCULTAR AVATARES ▴" : "ELEGIR OTRO AVATAR ▾"}</button>
          <div className="galacticAvatarChoices" hidden={!avatarListOpen} aria-label="Avatares disponibles">{AVATARS.map((src,index)=><button key={src} type="button" aria-label={`Avatar ${index+1}`} aria-pressed={avatarSrc===src} onClick={()=>{setAvatarId(index);setAvatarSrc(src);}}><img src={avatarThumb(src)} alt="" width={96} height={96} loading="lazy" decoding="async"/></button>)}</div>
          <label className="galacticNameLabel" htmlFor="avatar-name">Nombre de jugador</label>
          <input
            autoComplete="nickname"
            id="avatar-name"
            className="nameInput"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={18}
            placeholder="Nombre de avatar"
            aria-label="Nombre de avatar"
          />
          <div className={`nameAvailability ${nameAvailable ? "available" : "unavailable"}`}>
            {playerName.trim().length === 0 ? "" : nameAvailable ? "Nombre disponible en este navegador" : "Elige otro nombre"}
          </div>

          {avatarError && <div className="avatarError" role="alert">{avatarError}</div>}

          <button className="mainAction" onClick={completeAvatar} disabled={!nameAvailable}>CONTINUAR</button>

          {cropSource && (
            <div className="avatarCropOverlay" role="dialog" aria-modal="true" aria-label="Ajustar foto de avatar">
              <div className="avatarCropCard">
                <div className="cropTitle">
                  <strong>AJUSTA TU FOTO</strong>
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
    <main className={`appShell ${shellStyles.shell}`}>
      {screen !== "game" && (
        <header className="appHeader">
          <button className="logoButton" onClick={() => navigate("home")}>{PRODUCT_NAME}</button>
          <div className="appHeaderActions">
            <button
              className={`soundToggle ${musicOn ? "on" : "off"}`}
              type="button"
              aria-label={musicOn ? "Desactivar sonido" : "Activar sonido"}
              aria-pressed={musicOn}
              onClick={toggleSound}
            >
              {musicOn ? "🔊" : "🔇"}
            </button>
            <button className="balanceChip" aria-label={`Saldo ficticio ${euro(balance)}`} onClick={() => navigate("profile")}>FICTICIO · {euro(balance)}</button>
          </div>
        </header>
      )}

      <div className={`appBody ${screen === "game" ? "gameBody" : ""}`}>
        {screen === "home" && (
          <section className="catalogScreen playCatalogSimple homePlayMerged">
            <div className="homePlayHeading">
              <h1>Elige tu reto</h1>
              <button type="button" className="globalRankingShortcut" aria-label="Ranking global · Beneficio neto" onClick={()=>navigate("ranking")}>Ranking global →</button>
            </div>

            <PlayerProgress progress={progress} onClaim={claim} onEquip={equipItem} />
            <RiskPicker value={risk} onChange={setRisk} />

            {matchStartError && <p role="status">{matchStartError}</p>}
            <CatalogBrowser serverOnly={persistentTraining === true} modes={persistentTraining ? liveModes : undefined} stake={selectedStake as Stake} balance={balance} nextTurn={nextTurn} startingGameId={startingGameId} ghostEnabled={ghostEnabled} onToggleGhost={()=>setGhostEnabled(value=>!value)} onPlay={startMatch} />
          </section>
        )}

        {screen === "group" && matchStartError && <p role="status">{matchStartError}</p>}
        {screen === "group" && (
          <GroupHub
            group={group}
            balance={balance}
            playerName={playerName}
            avatarSrc={avatarSrc}
            initialJoinCode={pendingJoinCode}
            onCreateGroup={createClosedGroup}
            onJoinGroup={joinClosedGroup}
            onSetStake={setClosedGroupStake}
            onStartCompetition={startGroupCompetition}
          />
        )}

        {screen === "game" && (
          <section className="gameScreen">
            <div className="mobileGameHeader">
              <GameActionButton
                className="mobileGameBack"
                onActivate={requestExitGame}
                aria-label="Volver"
              >
                ←
              </GameActionButton>
              <div>
                <strong>{selectedGame.name}</strong>
                <small>
                  {matchScope === "group" && groupCompetition && group
                    ? competitionProgressLabel(groupCompetition, groupStage, group.members.length)
                    : selectedStake === 0
                      ? "ENTRENAMIENTO"
                      : `${selectedStake} FICHAS · 1 VS 1`}
                </small>
              </div>
              <div className="gameHeaderActions">
                <GameActionButton
                  className={`gameSoundToggle ${musicOn ? "on" : "off"}`}
                  type="button"
                  aria-label={musicOn ? "Desactivar sonido" : "Activar sonido"}
                  aria-pressed={musicOn}
                  onActivate={toggleSound}
                >
                  {musicOn ? "🔊" : "🔇"}
                </GameActionButton>
                {!persistentTraining && selectedMode === "existing" && matchScope === "duel" && (
                  <button
                    className={`ghostToggle ${ghostEnabled ? "active" : ""}`}
                    onClick={() => setGhostEnabled((value) => !value)}
                    aria-pressed={ghostEnabled}
                    aria-label="Mostrar u ocultar fantasma"
                  >
                    👻
                  </button>
                )}
              </div>
            </div>

            <div className="gameArenaWrap">
              <GameLoader
                game={selectedGame}
                active={activeGame}
                stake={selectedStake}
                ghostEnabled={!persistentTraining && selectedMode === "existing" && ghostEnabled}
                instanceKey={gameKey}
                targetScore={matchTargetScore}
                stopOnTarget={
                  !persistentTraining && matchScope === "duel" &&
                  (selectedMode === "existing" ||
                    selectedMode === "waiting")
                }
                onFinish={finishMatch}
              />
              {countdown !== null && (
                <div className="countdownOverlay">
                  <small>PREPÁRATE</small>
                  <b>{countdown > 0 ? countdown : "GO"}</b>
                </div>
              )}
            </div>

            {exitConfirmOpen && (
              <div className="gameExitOverlay" role="dialog" aria-modal="true" aria-label="Salir de la partida">
                <div className="gameExitCard">
                  <strong>SALIR DE LA PARTIDA</strong>
                  <p>
                    {activeGame
                      ? "La partida contará como perdida."
                      : "Se cancelará el inicio."}
                  </p>
                  <div>
                    <button type="button" onClick={() => setExitConfirmOpen(false)}>SEGUIR JUGANDO</button>
                    <button type="button" className="danger" onClick={leaveGameNow}>SALIR</button>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="resultPanel premiumResult neutralResult"
                onPointerDownCapture={() => { resultPointerReadyRef.current = resultActionsReady; }}
                onPointerCancelCapture={() => { resultPointerReadyRef.current = false; }}
                onClickCapture={event => {
                  // A held game gesture must not click through to a newly shown
                  // result action. Keyboard/assistive clicks (detail 0) still work.
                  if (event.detail !== 0 && (!resultActionsReady || !resultPointerReadyRef.current)) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                  resultPointerReadyRef.current = false;
                }}
              >
                {result.forfeited ? <GameResultSummary result={result} gameName={selectedGame.name} resultMetric={selectedGame.resultMetric} /> : result.verified === false ? (
                  <>
                    <div className="resultIcon">⚠</div>
                    <b>RESULTADO NO VERIFICADO</b>
                    <p className="resultNote">El servicio de partidas no ha podido confirmar esta partida. Inténtalo de nuevo en unos minutos.</p>
                  </>
                ) : (
                  <>
                    <GameResultSummary result={attemptSummary ?? result} gameName={selectedGame.name} resultMetric={selectedGame.resultMetric} waitingForRival={result.serverMatch ? result.serverMatch.status === "waiting" : selectedStake > 0 && matchScope === "duel" && selectedMode === "create"} />
                    {runApplied && <RunRewards applied={runApplied} seed={`${selectedGame.id}-${gameKey}-${runApplied.state.runs}`} unlocked={runApplied.state.unlocked} onPick={takeChest} />}
                  </>
                )}
                <fieldset className="resultActions" disabled={!resultActionsReady} aria-label="Acciones del resultado">
                  {matchScope === "group" && groupCompetition ? (
                    <>
                      {groupCompetition.type === "quick" ? (
                        <button
                          className="rematchAction"
                          disabled={groupCompetition.stake > balance}
                          onClick={repeatOrContinueGroupCompetition}
                        >
                          REPETIR
                        </button>
                      ) : groupCanAdvance ? (
                        <button
                          className="rematchAction"
                          onClick={repeatOrContinueGroupCompetition}
                        >
                          {groupCompetition.type === "league"
                            ? "SIGUIENTE JORNADA"
                            : "SIGUIENTE RONDA"}
                        </button>
                      ) : (
                        <button
                          className="rematchAction"
                          onClick={() => navigate("group")}
                        >
                          VOLVER AL GRUPO
                        </button>
                      )}
                      <button
                        className="mainAction"
                        onClick={() => navigate("group")}
                      >
                        {groupCompetition.type === "quick"
                          ? "VOLVER AL GRUPO"
                          : groupCanAdvance
                            ? "SALIR A GRUPO"
                            : "NUEVA COMPETICIÓN"}
                      </button>
                    </>
                  ) : (
                    <>
                      <GameActionButton className="rematchAction" onActivate={source => {
                        if (resultActionsReady && (source === "click" || resultPointerReadyRef.current)) startMatch();
                      }}>
                        OTRA VEZ
                      </GameActionButton>
                      <GameActionButton className="mainAction" onActivate={source => {
                        if (resultActionsReady && (source === "click" || resultPointerReadyRef.current)) navigate("home");
                      }}>
                        CAMBIAR
                      </GameActionButton>
                    </>
                  )}
                </fieldset>
              </div>
            )}
          </section>
        )}

        {screen === "profile" && (
          <section className={`simpleScreen ${shellStyles.accountView}`} aria-label="Perfil local">
            <h1>Tu avatar</h1>
            <nav className="avatarSections" aria-label="Secciones de avatar">
              <button type="button" aria-pressed={avatarSection === "profile"} onClick={() => setAvatarSection("profile")}>Perfil</button>
              <button type="button" aria-pressed={avatarSection === "ranking"} onClick={() => setAvatarSection("ranking")}>Ranking</button>
            </nav>
            {avatarSection === "ranking" ? <GlobalRanking embedded /> : <>
            <p className={shellStyles.demoNote}>Identidad local · saldo y premios ficticios</p>
            <div className="profileStrip"><img src={avatarSrc} alt="Avatar" /><div><strong>{playerName}</strong><span>Cuenta local · sin posición real</span></div><b className={netEarnings < 0 ? "negative" : ""}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</b></div>

            <section className="accountWalletCard">
              <div>
                <small>SALDO FICTICIO</small>
                <strong>{euro(balance)}</strong>
              </div>
              <div className="walletActions">
                <button onClick={() => {
                  setBalance((b) => b + 10);
                  setMovements((m) => [{ label: "Ingreso ficticio", amount: 10 }, ...m]);
                }}>Añadir 10 € ficticios</button>
                <button
                  disabled={balance < 10}
                  onClick={() => {
                    setBalance((b) => Number((b - 10).toFixed(2)));
                    setMovements((m) => [{ label: "Retirada ficticia", amount: -10 }, ...m]);
                  }}
                >Retirar 10 € ficticios</button>
              </div>
              <div className="miniMovementList" aria-live="polite">
                {movements.length === 0 && <p className={shellStyles.emptyNote}>Sin movimientos</p>}
                {movements.slice(0, 3).map((movement, index) => (
                  <div key={`${movement.label}-${index}`}>
                    <span>{movement.label.replace(/\bdemo\b/gi, "ficticio")}</span>
                    <b className={movement.amount < 0 ? "negative" : ""}>
                      {movement.amount > 0 ? "+" : ""}{euro(movement.amount)}
                    </b>
                  </div>
                ))}
              </div>
            </section>

            {persistentTraining && <RecentAttempts />}
            <div className="chartPanel">
              <div className="chartHead"><span>BENEFICIO NETO FICTICIO</span><strong>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</strong></div>
              <svg className="earningsChart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Beneficio neto ficticio de partidas a lo largo del tiempo">
                <line x1="0" y1="50" x2="100" y2="50" className="zeroLine" />
                <polyline points={chartPoints} className="profitLine" />
              </svg>
              <div className="chartAxis"><span>INICIO</span><span>AHORA</span></div>
            </div>
            <div className="settingsList">
              <button aria-pressed={musicOn} onClick={toggleSound}><span>Sonido</span><b>{musicOn ? "ON" : "OFF"}</b></button>
              <button onClick={() => { setAvatarEditorOpen(true); setAvatarError(""); navigate("avatar-setup"); }}><span>Nombre y avatar</span><b>→</b></button>
              <button onClick={resetAvatar}><span>Reiniciar perfil local</span><b aria-hidden="true">↺</b></button>
              <button onClick={() => navigate("legal")}><span>Información de la aplicación</span><b aria-hidden="true">→</b></button>
              <button onClick={logoutDemo}><span>Cerrar sesión local</span><b>×</b></button>
            </div>
            </>}
          </section>
        )}

        {screen === "legal" && (
          <section className={`simpleScreen ${shellStyles.legalView}`}>
            <button className="textBack" aria-label="Volver al perfil" onClick={() => navigate("profile")}>← Tu perfil</button>
            <h1>Información de la aplicación</h1>
            <p className={shellStyles.demoNote}>GALACTIC GAMES · sin dinero real</p>
            <div className="legalTabs">
              <button aria-pressed={legalTab === "terms"} className={legalTab === "terms" ? "active" : ""} onClick={() => setLegalTab("terms")}>Términos</button>
              <button aria-pressed={legalTab === "privacy"} className={legalTab === "privacy" ? "active" : ""} onClick={() => setLegalTab("privacy")}>Privacidad</button>
              <button aria-pressed={legalTab === "cookies"} className={legalTab === "cookies" ? "active" : ""} onClick={() => setLegalTab("cookies")}>Cookies</button>
              <button aria-pressed={legalTab === "rules"} className={legalTab === "rules" ? "active" : ""} onClick={() => setLegalTab("rules")}>Reglas</button>
            </div>
            <article className="legalCopy">
              <h2>{legalTab === "terms" ? "Términos y condiciones" : legalTab === "privacy" ? "Privacidad" : legalTab === "cookies" ? "Cookies" : "Reglas de competición"}</h2>
              {legalTab === "terms" && <>
                <p>Esta versión permite entrenar y probar partidas con saldo ficticio. Añadir o retirar saldo ficticio no mueve dinero real ni genera pagos.</p>
                <p>La competición con dinero real no está disponible. Esta información describe la versión actual; no sustituye los términos jurídicos revisados que necesitará el servicio definitivo.</p>
              </>}
              {legalTab === "privacy" && <>
                <p>Tu nombre, avatar, preferencias y estadísticas locales se guardan en este navegador. Las partidas verificadas envían sus inputs al servidor para reconstruir el resultado, asociados a un identificador anónimo de sesión; el nombre y el avatar no se envían.</p>
                <p>El proveedor de alojamiento puede tratar datos técnicos de conexión (como la dirección IP) en sus registros para operar y proteger el servicio.</p>
                <p>La aplicación no solicita documentos de identidad ni datos de pago. Cerrar sesión elimina el perfil local de este navegador; no equivale a una solicitud de borrado de registros del servidor.</p>
                <p>Antes de crear cuentas reales, se publicarán la política de privacidad, los plazos de conservación y los medios para ejercer tus derechos.</p>
              </>}
              {legalTab === "cookies" && <>
                <p>La aplicación utiliza almacenamiento local del navegador para recordar el perfil local y las preferencias. Si lo borras, tendrás que configurar la entrada de nuevo.</p>
                <p>Además usa cookies técnicas estrictamente necesarias, propias y no publicitarias: <code>arena_match_training</code> (identifica de forma anónima tu sesión de partidas; caduca a las 24 horas) y, solo en Mine Grid, una cookie de sesión de 30 minutos. No se usan cookies de analítica ni de publicidad.</p>
                <p>La información definitiva sobre cookies y servicios de alojamiento estará disponible antes de activar cuentas reales. Esta versión no presenta un consentimiento de producción.</p>
              </>}
              {legalTab === "rules" && <>
                <p>Entrenamiento gratis te permite aprender cada juego sin usar saldo ficticio. Las otras modalidades utilizan saldo ficticio y rivales simulados.</p>
                <p>En juegos con verificación, el servidor reconstruye la partida a partir del escenario y los inputs y calcula el resultado. Si la verificación falla, no se confirma una victoria.</p>
                <p>El ranking de ejemplo es una muestra independiente: sus jugadores y beneficios son ficticios. El ranking real solo mostrará datos de servidor cuando el servicio esté configurado.</p>
              </>}
            </article>
          </section>
        )}
      </div>

      {screen !== "game" && screen !== "legal" && (
        <nav className="bottomNav bottomNavThree" aria-label="Navegación principal">
          <button className={screen === "home" ? "active" : ""} aria-current={screen === "home" ? "page" : undefined} onClick={() => navigate("home")}>
            <span>▶</span>JUEGOS
          </button>
          <button className={screen === "group" ? "active" : ""} aria-current={screen === "group" ? "page" : undefined} onClick={() => navigate("group")}>
            <span>◉</span>GRUPO
          </button>
          <button className={screen === "profile" ? "active" : ""} aria-current={screen === "profile" ? "page" : undefined} onClick={() => navigate("profile")}>
            <img src={avatarSrc} alt="" /><em className="navName">{playerName || "AVATAR"}</em>
          </button>
        </nav>
      )}
    </main>
  );
}
