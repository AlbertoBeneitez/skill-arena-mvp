"use client";
import GameResultSummary from "./GameResultSummary";
import { safeStorage } from "@/lib/safeStorage";
import GameActionButton from "./GameActionButton";
import CatalogBrowser, { CATEGORY_ACCENTS } from "./CatalogBrowser";
import shellStyles from "./ProductShell.module.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePublicMatchAvailability, usePendingMatchResolution } from "@/lib/usePublicMatchState";
import GalacticMark from "./GalacticMark";
import { PRODUCT_NAME } from "@/lib/productIdentity";
import GameLoader from "./GameLoader";
import RecentAttempts from "./RecentAttempts";
import GroupHub from "./GroupHub";
import { GAMES, STAKES, modeForStake, prizeForStake, type GameMeta, type MatchMode, type Stake } from "@/lib/games";
import { competitionProgressLabel, createDemoClosedGroup, joinDemoClosedGroup, groupPot, groupTargetScore, payoutLabel, type ClosedGroup, type GroupCompetitionConfig } from "@/lib/groupPlay";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic, setGameSoundEnabled, startGameMusic, stopGameMusic } from "@/lib/gameFeedback";
import { formatMoney, formatNumber, initLocale, setLocale, t, useI18n, LOCALE_STORAGE_KEY, type MessageKey, type Vars } from "@/lib/i18n";
import { matchLocale } from "@/lib/i18n/locales";
import { gameCategory, gameName, gameSkill, gameTagline } from "@/lib/i18n/games";
import type { DocId } from "@/lib/i18n/docs";
import { initSettings, resetSettings, useSettings, SETTINGS_STORAGE_KEY } from "@/lib/settings";
import DocSheet from "./DocSheet";
import SettingsScreen from "./SettingsScreen";
import ConfirmDialog from "./ConfirmDialog";
import LanguagePicker from "./LanguagePicker";
import LeagueResult from "./LeagueResult";
import RankingHub from "./GameRanking";
import { emptyLeague, isLeagueState, leagueRival, recordLeagueResult, LEAGUE_COLORS, LEAGUE_ICONS, type LeagueRecord, type LeagueRival, type LeagueState, type LeagueTier } from "@/lib/leagues";

type Screen = "welcome" | "avatar-setup" | "home" | "group" | "game" | "profile" | "legal" | "ranking" | "settings";
type Provider = "google" | "apple" | null;
type Turn = "create" | "existing";
type MatchScope = "duel" | "group";

type EarningsPoint = { label: string; value: number };
/** `label` is the stored fallback; new entries also carry a message key so they follow the language. */
type Movement = { label: string; amount: number; key?: MessageKey; vars?: Vars; gameId?: string };

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
  leagues?: LeagueState;
  bestScores?: Record<string, number>;
};

const VALID_SCREENS: Screen[] = ["welcome", "avatar-setup", "home", "group", "game", "profile", "legal", "ranking", "settings"];

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
  return formatMoney(value);
}

function movementLabel(movement: Movement) {
  if (!movement.key) return movement.label.replace(/\bdemo\b/gi, "ficticio");
  const game = movement.gameId ? GAMES.find((item) => item.id === movement.gameId) : undefined;
  return t(movement.key, { ...movement.vars, ...(game ? { game: gameName(game) } : {}) });
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
  // Any script (Latin, Cyrillic, Arabic, Devanagari, Han…): names stay local to this browser.
  if (!/^[\p{L}\p{M}\p{N}_ ]{2,18}$/u.test(clean) || /\s{2,}/.test(clean)) return false;
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
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarSection, setAvatarSection] = useState<"profile" | "ranking">("profile");
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Avatar dropdown: the 15 alternatives open as a grid under the portrait (no vertical scroll).
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarMenuTop, setAvatarMenuTop] = useState<number | undefined>(undefined);
  const avatarCardRef = useRef<HTMLElement>(null);
  const avatarPortraitRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!avatarMenuOpen) return;
    const place = () => {
      const card = avatarCardRef.current, portrait = avatarPortraitRef.current, menu = avatarMenuRef.current;
      if (!card || !portrait || !menu) return;
      const c = card.getBoundingClientRect(), p = portrait.getBoundingClientRect();
      const wanted = p.bottom - c.top + 10;
      const max = c.height - menu.offsetHeight - 12;
      setAvatarMenuTop(Math.max(12, Math.min(wanted, max)));
    };
    place();
    avatarMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [avatarMenuOpen]);
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
  const [leagues, setLeagues] = useState<LeagueState>({});
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  /** Simulated rival for the match in progress (demo leagues); null outside league duels. */
  const [leagueMatch, setLeagueMatch] = useState<{ gameId: string; rival: LeagueRival; tier: LeagueTier } | null>(null);
  const [leagueOutcome, setLeagueOutcome] = useState<{ won: boolean; record: LeagueRecord; rival: LeagueRival; score: number } | null>(null);
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
  useI18n();
  const settings = useSettings();
  const [doc, setDoc] = useState<DocId | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "delete">(null);
  const [notice, setNotice] = useState("");
  // Responsible play: optional reminder after N minutes in the app (Settings).
  const [reminderDue, setReminderDue] = useState(false);
  const reminderAnchorRef = useRef(0);
  useEffect(() => {
    initLocale();
    initSettings();
    reminderAnchorRef.current = Date.now();
  }, []);
  useEffect(() => {
    if (!settings.reminderMinutes) {
      setReminderDue(false);
      return undefined;
    }
    const check = () => {
      if (Date.now() - reminderAnchorRef.current >= settings.reminderMinutes * 60_000) setReminderDue(true);
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [settings.reminderMinutes]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
        if (isLeagueState(data.leagues)) setLeagues(data.leagues);
        if (data.bestScores && typeof data.bestScores === "object") {
          setBestScores(Object.fromEntries(Object.entries(data.bestScores).filter(([, v]) => typeof v === "number" && Number.isFinite(v))));
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
      leagues,
      bestScores,
    };
    try {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be full on mobile; gameplay must continue even if persistence fails.
    }
  }, [isLoaded, onboarded, provider, playerName, avatarId, avatarSrc, balance, netEarnings, nextTurn, musicOn, earnings, movements, tutorialSeen, wins, losses, streak, group, leagues, bestScores]);

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
          key: "move.refund" as const,
          gameId: selectedGame.id,
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
      setAvatarError(t("identity.imageTooBig"));
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


  function startMatch(gameOverride?: GameMeta) {
    const game = gameOverride ?? selectedGame;
    const stake = selectedStake;
    const mode = persistentTraining ? (liveModes[game.id]??"create") : modeForStake(game, stake as Stake, nextTurn);

    if (matchStartLockRef.current || stake > balance) return;
    if(persistentTraining && stake>0 && game.competition.verification!=="server-replay"){
      setMatchStartError(t("home.localOnly"));return;
    }
    setMatchStartError("");

    matchStartLockRef.current = true;
    setStartingGameId(game.id);

    setSelectedGame(game);
    setSelectedStake(stake);
    setSelectedMode(mode);
    setGhostEnabled(mode === "existing");
    setMatchScope("duel");
    setLeagueOutcome(null);
    if (!persistentTraining) {
      // Demo league matchmaking: a simulated rival of the player's tier in this game.
      const record = leagues[game.id] ?? emptyLeague();
      const rival = leagueRival(game, record);
      setLeagueMatch({ gameId: game.id, rival, tier: record.tier });
      setMatchTargetScore(rival.balanceGoal ? game.rivalScore : rival.target);
    } else {
      setLeagueMatch(null);
      setMatchTargetScore(1_000_000_000);
    }
    setShowWinAnimation(false);
    setExitConfirmOpen(false);

    setBalance((b) => Number((b - stake).toFixed(2)));
    if (stake > 0) {
      setMovements((items) => [
        { label: `${game.name} · entrada`, amount: -stake, key: "move.entry" as const, gameId: game.id },
        ...items,
      ].slice(0, 20));
    }

    setResult(null);
    setAttemptSummary(null);
    setActiveGame(false);
    setGameKey((k) => k + 1);
    setCountdown(3);
    gameTone("countdown");
    haptic(12);
    navigate("game");
  }

  function settleLeague(won: boolean, score: number) {
    if (!leagueMatch) return;
    const { gameId, rival } = leagueMatch;
    const record = recordLeagueResult(leagues[gameId] ?? emptyLeague(), won);
    setLeagues((all) => ({ ...all, [gameId]: record }));
    setLeagueOutcome({ won, record, rival, score });
    setLeagueMatch(null);
  }

  function finishMatch(gameResult: GameResult) {
    resultPointerReadyRef.current = false;
    matchStartLockRef.current = false;
    setStartingGameId(null);
    setActiveGame(false);

    if (selectedGame.competition.verification === "server-replay" && gameResult.verified !== true) {
      // A started attempt is lost on disconnect/failed verification, never refunded by UI.
      setLosses(value=>value+1);setStreak(0);
      if (leagueMatch && matchScope === "duel") settleLeague(false, 0);
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

    // Demo league duel: training matches are decided against the simulated rival of the player's tier.
    const leagueDuel = !gameResult.serverMatch && matchScope === "duel" && leagueMatch !== null && leagueMatch.gameId === selectedGame.id;
    const beatLeagueRival = leagueDuel && gameResult.score >= leagueMatch!.rival.target;
    const didWin = gameResult.serverMatch
      ? gameResult.serverMatch.winnerSlot === gameResult.serverMatch.slot
      : selectedStake === 0
        ? leagueDuel ? beatLeagueRival : gameResult.won
        : matchScope === "group"
          ? gameResult.won || gameResult.score >= matchTargetScore
          : replyAttempt
            ? gameResult.won || gameResult.score >= matchTargetScore
            : false;
    const resolvedResult = { ...gameResult, won: didWin };
    if (gameResult.verified !== false && !gameResult.forfeited && Number.isFinite(gameResult.score)) {
      setBestScores((best) => (gameResult.score > (best[selectedGame.id] ?? -1) ? { ...best, [selectedGame.id]: gameResult.score } : best));
    }
    const leagueResolved = leagueDuel && (selectedStake === 0 || replyAttempt);
    if (leagueResolved && gameResult.serverMatch?.reason !== "exact-tie") settleLeague(didWin, gameResult.score);
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
            key: "move.groupPrize" as const,
            vars: { group: group.name, split: payoutLabel(groupCompetition.distribution) },
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
        { label: `${selectedGame.name} · premio`, amount: prize, key: "move.prize" as const, gameId: selectedGame.id },
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
      playerName: playerName || t("common.you"),
      avatar: avatarSrc,
    });
    setGroup(next);
    gameTone("good");
    haptic(8);
  }

  function joinClosedGroup(code: string) {
    const next = joinDemoClosedGroup({
      code,
      playerName: playerName || t("common.you"),
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
    if(persistentTraining!==false){setMatchStartError(t("home.groupsUnavailable"));return;}
    setMatchStartError("");
    const nextStage = options?.nextStage ?? 1;

    matchStartLockRef.current = true;
    setStartingGameId(game.id);
    setSelectedGame(game);
    setSelectedStake(config.stake);
    setSelectedMode("create");
    setGhostEnabled(false);
    setMatchScope("group");
    setLeagueMatch(null);
    setLeagueOutcome(null);
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
          key: (config.type === "quick" ? "move.groupQuick" : config.type === "league" ? "move.groupLeague" : "move.groupTournament") as MessageKey,
          vars: { group: group.name },
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

  function editProfile() {
    setAvatarEditorOpen(true);
    setAvatarError("");
    navigate("avatar-setup");
  }

  /** Settings › Reset statistics: keeps name, avatar and balance. */
  function resetStats() {
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    setWins(0);
    setLosses(0);
    setStreak(0);
    setLeagues({});
    setBestScores({});
    setConfirmAction(null);
    setNotice(t("settings.resetStatsDone"));
  }

  /** Settings › Delete all my local data: profile, wallet, history, group, settings and language. */
  function deleteAllLocalData() {
    safeStorage
      .keys()
      .filter((key) => key.startsWith("skill-arena-") || key.startsWith("galactic-") || key === SETTINGS_STORAGE_KEY || key === LOCALE_STORAGE_KEY || key.startsWith("ga-"))
      .forEach((key) => safeStorage.removeItem(key));
    resetSettings();
    void setLocale(matchLocale(typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]), false);
    setConfirmAction(null);
    logoutDemo();
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
          <div className="welcomeTopBar"><LanguagePicker compact /></div>
          <GalacticMark className="galacticWelcomeMark" />
          <h1 className="wordmark">{PRODUCT_NAME}</h1>
          <div className="authStack">

            <div className="galacticProviderRow">
              <button className="authButton google" disabled aria-label={t("welcome.soon", { provider: "Google" })}><span aria-hidden="true">G</span>Google</button>
              <button className="authButton apple" disabled aria-label={t("welcome.soon", { provider: "Apple" })}><span aria-hidden="true">●</span>Apple</button>
            </div>
            <button className="authButton guest galacticEntryAction" aria-label={t("welcome.loginAria")} onClick={continueWithoutProvider}><span>{t("welcome.login")}</span><small>{t("welcome.loginLocal")}</small></button>
          </div>
          <p className="welcomeLegal">
            {t("identity.terms", { terms: "\u0001", privacy: "\u0002" }).split(/(\u0001|\u0002)/).map((part, index) =>
              part === "\u0001" ? <button key={index} type="button" className="inlineLink" onClick={() => setDoc("terms")}>{t("identity.termsLink")}</button>
              : part === "\u0002" ? <button key={index} type="button" className="inlineLink" onClick={() => setDoc("privacy")}>{t("identity.privacyLink")}</button>
              : <span key={index}>{part}</span>)}
          </p>
        </section>
        {doc && <DocSheet doc={doc} onClose={() => setDoc(null)} />}
      </main>
    );
  }

  if (screen === "avatar-setup") {
    return (
      <main className="onboarding arenaOnboarding">
        <section ref={avatarCardRef} className={`setupCard avatarSetupCard avatarSetupMinimal galacticAvatarSetup ${avatarMenuOpen ? "avatarMenuIsOpen" : ""}`}>
          <small className="galacticSetupBrand">{PRODUCT_NAME}</small>
          <div className="avatarPortraitWrap">
            <div className="avatarPortrait" ref={avatarPortraitRef}>
              <button
                type="button"
                className="avatarPortraitTrigger"
                aria-haspopup="dialog"
                aria-expanded={avatarMenuOpen}
                aria-controls="avatar-menu"
                aria-label={t("identity.chooseAvatar")}
                onClick={() => setAvatarMenuOpen((open) => !open)}
              >
                <img src={avatarSrc} alt="" />
                <span className="avatarMenuChevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </button>
              <button
                className={`avatarChangeButton ${avatarEditorOpen ? "open" : ""}`}
                type="button"
                onClick={() => { setAvatarError(""); fileInputRef.current?.click(); }}
                aria-label={t("identity.uploadPhoto")}
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

          {avatarMenuOpen && (
            <>
              <button type="button" className="avatarMenuScrim" aria-label={t("identity.closeAvatars")} tabIndex={-1} onClick={() => setAvatarMenuOpen(false)} />
              <div
                id="avatar-menu"
                ref={avatarMenuRef}
                className="avatarMenu"
                role="dialog"
                aria-label={t("identity.avatarMenu")}
                style={{ top: avatarMenuTop }}
                onKeyDown={(event) => { if (event.key === "Escape") setAvatarMenuOpen(false); }}
              >
                <div className="avatarMenuGrid" role="group" aria-label={t("identity.availableAvatars")}>
                  {AVATARS.map((src, index) => {
                    const current = src === avatarSrc;
                    return (
                      <button
                        key={src}
                        type="button"
                        className={current ? "current" : undefined}
                        aria-pressed={current}
                        aria-label={t("identity.avatarN", { n: index + 1 })}
                        onClick={() => { setAvatarId(index); setAvatarSrc(src); setAvatarMenuOpen(false); }}
                      >
                        <img src={avatarThumb(src)} alt="" width={96} height={96} decoding="async" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <input
            autoComplete="nickname"
            id="avatar-name"
            className="nameInput"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={18}
            placeholder={t("identity.namePlaceholder")}
            aria-label={t("identity.nameAria")}
          />
          <div className={`nameAvailability ${nameAvailable ? "available" : "unavailable"}`}>
            {playerName.trim().length === 0 ? "" : nameAvailable ? t("identity.nameAvailable") : t("identity.nameUnavailable")}
          </div>

          {avatarError && <div className="avatarError" role="alert">{avatarError}</div>}

          <button className="mainAction" onClick={completeAvatar} disabled={!nameAvailable}>{t("common.continue")}</button>

          {cropSource && (
            <div className="avatarCropOverlay" role="dialog" aria-modal="true" aria-label={t("identity.cropAria")}>
              <div className="avatarCropCard">
                <div className="cropTitle">
                  <strong>{t("identity.cropTitle")}</strong>
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
                  <span>{t("identity.zoom")}</span>
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
                  <button type="button" onClick={() => setCropSource(null)}>{t("common.cancel").toUpperCase()}</button>
                  <button type="button" className="primary" onClick={() => void applyAvatarCrop()}>{t("identity.usePhoto")}</button>
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
          <button className="logoButton" onClick={() => navigate("home")}><span>{PRODUCT_NAME}</span></button>
          <div className="appHeaderActions">
            <button
              className={`soundToggle ${musicOn ? "on" : "off"}`}
              type="button"
              aria-label={musicOn ? t("common.soundOff") : t("common.soundOn")}
              aria-pressed={musicOn}
              onClick={toggleSound}
            >
              {musicOn ? "🔊" : "🔇"}
            </button>
            <button className="balanceChip" aria-label={t("shell.fictitiousBalance", { amount: euro(balance) })} onClick={() => navigate("profile")}><small>{t("shell.balanceLabel")}</small><b>{euro(balance)}</b></button>
            <button className="settingsGear" type="button" aria-label={t("common.settings")} onClick={() => navigate("settings")}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/></svg>
            </button>
          </div>
        </header>
      )}

      <div className={`appBody ${screen === "game" ? "gameBody" : ""}`}>
        {screen === "home" && (
          <section className="catalogScreen playCatalogSimple homePlayMerged">
            <div className="homePlayHeading">
              <h1>{t("home.title")}</h1>
              <button type="button" className="globalRankingShortcut" aria-label={t("home.rankingAria")} onClick={()=>navigate("ranking")}>{t("home.ranking")} <span aria-hidden="true" className="dirArrow">→</span></button>
            </div>


            {matchStartError && <p role="status">{matchStartError}</p>}
            <CatalogBrowser serverOnly={persistentTraining === true} modes={persistentTraining ? liveModes : undefined} stake={selectedStake as Stake} balance={balance} nextTurn={nextTurn} startingGameId={startingGameId} ghostEnabled={ghostEnabled} onToggleGhost={()=>setGhostEnabled(value=>!value)} onPlay={startMatch} leagues={persistentTraining ? undefined : leagues} />
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
          <section className="gameScreen" dir="ltr">
            <div className="mobileGameHeader">
              <GameActionButton
                className="mobileGameBack"
                onActivate={requestExitGame}
                aria-label={t("common.back")}
              >
                ←
              </GameActionButton>
              <div>
                <strong>{gameName(selectedGame)}</strong>
                <small>
                  {matchScope === "group" && groupCompetition && group
                    ? competitionProgressLabel(groupCompetition, groupStage, group.members.length)
                    : selectedStake === 0
                      ? t("game.training")
                      : t("game.duel", { n: selectedStake })}
                </small>
              </div>
              <div className="gameHeaderActions">
                <GameActionButton
                  className={`gameSoundToggle ${musicOn ? "on" : "off"}`}
                  type="button"
                  aria-label={musicOn ? t("common.soundOff") : t("common.soundOn")}
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
                    aria-label={t("catalog.ghost")}
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
                <div
                  className={`countdownOverlay gxIntro ${countdown === 0 ? "go" : ""}`}
                  role="status"
                  aria-live="polite"
                  style={{ ["--accent" as string]: CATEGORY_ACCENTS[selectedGame.category] ?? "#7fe3ee" }}
                >
                  <div className="gxIntroStage" aria-hidden="true">
                    <div className="gxIntroArt"><img src={selectedGame.cover} alt="" /></div>
                  </div>
                  <p className="gxIntroTagline" dir="auto">{gameTagline(selectedGame)}</p>
                  <div className="gxIntroChips" aria-hidden="true">
                    {!gameSkill(selectedGame).includes(gameCategory(selectedGame)) && <span>{gameCategory(selectedGame)}</span>}
                    <span>{gameSkill(selectedGame)}</span>
                  </div>
                  {leagueMatch && leagueMatch.gameId === selectedGame.id && (
                    <div className="gxIntroRival" style={{ ["--tier" as string]: LEAGUE_COLORS[leagueMatch.tier] }}>
                      <img src={leagueMatch.rival.avatar} alt="" width={40} height={40} />
                      <span>
                        <small>{LEAGUE_ICONS[leagueMatch.tier]} {t("league.rivalOf", { tier: t(`league.tier${leagueMatch.tier}` as MessageKey) })}</small>
                        <b>{leagueMatch.rival.name}</b>
                      </span>
                      <strong>{leagueMatch.rival.balanceGoal ? t("league.goalChips", { n: formatNumber(leagueMatch.rival.target / 100) }) : formatNumber(leagueMatch.rival.target)}</strong>
                    </div>
                  )}
                  <div className="gxIntroCount" key={countdown}>
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle className="track" cx="60" cy="60" r="52" />
                      <circle className="arc" cx="60" cy="60" r="52" pathLength={100} />
                    </svg>
                    <b aria-label={countdown > 0 ? t("game.startsIn", { n: countdown }) : t("game.goAria")}>{countdown > 0 ? countdown : t("game.go")}</b>
                  </div>
                </div>
              )}
            </div>

            {exitConfirmOpen && (
              <div className="gameExitOverlay" role="dialog" aria-modal="true" aria-label={t("game.exitTitle")} dir="auto">
                <div className="gameExitCard">
                  <strong>{t("game.exitTitle")}</strong>
                  <p>
                    {activeGame
                      ? t("game.exitLost")
                      : t("game.exitCancel")}
                  </p>
                  <div>
                    <button type="button" onClick={() => setExitConfirmOpen(false)}>{t("game.keepPlaying")}</button>
                    <button type="button" className="danger" onClick={leaveGameNow}>{t("game.exit")}</button>
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
                {result.forfeited ? <GameResultSummary result={result} gameName={gameName(selectedGame)} resultMetric={selectedGame.resultMetric} /> : result.verified === false ? (
                  <>
                    <div className="resultIcon">⚠</div>
                    <b>{t("game.unverifiedTitle")}</b>
                    <p className="resultNote">{t("game.unverifiedBody")}</p>
                  </>
                ) : (
                  <>
                    <GameResultSummary result={attemptSummary ?? result} gameName={gameName(selectedGame)} resultMetric={selectedGame.resultMetric} waitingForRival={result.serverMatch ? result.serverMatch.status === "waiting" : selectedStake > 0 && matchScope === "duel" && selectedMode === "create"} />
                    {leagueOutcome && <LeagueResult outcome={leagueOutcome} />}
                  </>
                )}
                <fieldset className="resultActions" disabled={!resultActionsReady} aria-label={t("game.resultActions")}>
                  {matchScope === "group" && groupCompetition ? (
                    <>
                      {groupCompetition.type === "quick" ? (
                        <button
                          className="rematchAction"
                          disabled={groupCompetition.stake > balance}
                          onClick={repeatOrContinueGroupCompetition}
                        >
                          {t("game.repeat")}
                        </button>
                      ) : groupCanAdvance ? (
                        <button
                          className="rematchAction"
                          onClick={repeatOrContinueGroupCompetition}
                        >
                          {groupCompetition.type === "league"
                            ? t("game.nextMatchday")
                            : t("game.nextRound")}
                        </button>
                      ) : (
                        <button
                          className="rematchAction"
                          onClick={() => navigate("group")}
                        >
                          {t("game.backToGroup")}
                        </button>
                      )}
                      <button
                        className="mainAction"
                        onClick={() => navigate("group")}
                      >
                        {groupCompetition.type === "quick"
                          ? t("game.backToGroup")
                          : groupCanAdvance
                            ? t("game.leaveToGroup")
                            : t("game.newCompetition")}
                      </button>
                    </>
                  ) : (
                    <>
                      <GameActionButton className="rematchAction" onActivate={source => {
                        if (resultActionsReady && (source === "click" || resultPointerReadyRef.current)) startMatch();
                      }}>
                        {t("game.again")}
                      </GameActionButton>
                      <GameActionButton className="mainAction" onActivate={source => {
                        if (resultActionsReady && (source === "click" || resultPointerReadyRef.current)) navigate("home");
                      }}>
                        {t("game.change")}
                      </GameActionButton>
                    </>
                  )}
                </fieldset>
              </div>
            )}
          </section>
        )}

        {screen === "profile" && (
          <section className={`simpleScreen ${shellStyles.accountView}`} aria-label={t("profile.aria")}>
            <h1>{t("profile.title")}</h1>
            <nav className="avatarSections" aria-label={t("profile.sections")}>
              <button type="button" aria-pressed={avatarSection === "profile"} onClick={() => setAvatarSection("profile")}>{t("profile.tabProfile")}</button>
              <button type="button" aria-pressed={avatarSection === "ranking"} onClick={() => setAvatarSection("ranking")}>{t("profile.tabRanking")}</button>
            </nav>
            {avatarSection === "ranking" ? <RankingHub bestScores={bestScores} leagues={leagues} playerName={playerName} avatarSrc={avatarSrc} showLeagues={!persistentTraining} /> : <>
            <p className={shellStyles.demoNote}>{t("profile.note")}</p>
            <div className="profileStrip"><img src={avatarSrc} alt="" /><div><strong>{playerName}</strong><span>{t("profile.localAccount")}</span></div><b className={netEarnings < 0 ? "negative" : ""} dir="ltr">{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</b></div>

            <div className="profileStats" aria-label={t("profile.stats")}>
              <div><b>{matchesPlayed}</b><span>{t("profile.played")}</span></div>
              <div><b>{wins}</b><span>{t("profile.wins")}</span></div>
              <div><b>{winRate}%</b><span>{t("profile.winRate")}</span></div>
              <div><b>{streak}</b><span>{t("profile.streak")}</span></div>
            </div>

            <section className="accountWalletCard">
              <div>
                <small>{t("profile.balance")}</small>
                <strong dir="ltr">{euro(balance)}</strong>
              </div>
              <div className="walletActions">
                <button onClick={() => {
                  setBalance((b) => b + 10);
                  setMovements((m) => [{ label: "Ingreso ficticio", amount: 10, key: "move.deposit" as const }, ...m]);
                }}>{t("profile.add")}</button>
                <button
                  disabled={balance < 10}
                  onClick={() => {
                    setBalance((b) => Number((b - 10).toFixed(2)));
                    setMovements((m) => [{ label: "Retirada ficticia", amount: -10, key: "move.withdraw" as const }, ...m]);
                  }}
                >{t("profile.withdraw")}</button>
              </div>
              <div className="miniMovementList" aria-live="polite">
                {movements.length === 0 && <p className={shellStyles.emptyNote}>{t("profile.noMovements")}</p>}
                {movements.slice(0, 3).map((movement, index) => (
                  <div key={`${movement.label}-${index}`}>
                    <span>{movementLabel(movement)}</span>
                    <b className={movement.amount < 0 ? "negative" : ""} dir="ltr">
                      {movement.amount > 0 ? "+" : ""}{euro(movement.amount)}
                    </b>
                  </div>
                ))}
              </div>
            </section>

            {persistentTraining && <RecentAttempts />}
            <div className="chartPanel">
              <div className="chartHead"><span>{t("profile.netProfit")}</span><strong dir="ltr">{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</strong></div>
              <svg className="earningsChart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={t("profile.chartAria")}>
                <line x1="0" y1="50" x2="100" y2="50" className="zeroLine" />
                <polyline points={chartPoints} className="profitLine" />
              </svg>
              <div className="chartAxis" dir="ltr"><span>{t("profile.chartStart")}</span><span>{t("profile.chartNow")}</span></div>
            </div>
            <div className="settingsList">
              <button onClick={() => navigate("settings")}><span>{t("profile.settings")}</span><b aria-hidden="true" className="dirArrow">→</b></button>
              <button onClick={editProfile}><span>{t("profile.editProfile")}</span><b aria-hidden="true" className="dirArrow">→</b></button>
              <button onClick={logoutDemo}><span>{t("profile.logout")}</span><b aria-hidden="true">×</b></button>
            </div>
            </>}
          </section>
        )}

        {(screen === "settings" || screen === "legal") && (
          <SettingsScreen
            soundOn={musicOn}
            onToggleSound={toggleSound}
            onEditProfile={editProfile}
            onResetStats={() => setConfirmAction("reset")}
            onDeleteData={() => setConfirmAction("delete")}
            onLogout={logoutDemo}
            onOpenDoc={setDoc}
            onBack={() => navigate("profile")}
          />
        )}
      </div>

      {screen !== "game" && screen !== "legal" && screen !== "settings" && (
        <nav className="bottomNav bottomNavThree" aria-label={t("nav.main")}>
          <button className={screen === "home" ? "active" : ""} aria-current={screen === "home" ? "page" : undefined} onClick={() => navigate("home")}>
            <span>▶</span>{t("nav.games")}
          </button>
          <button className={screen === "group" ? "active" : ""} aria-current={screen === "group" ? "page" : undefined} onClick={() => navigate("group")}>
            <span>◉</span>{t("nav.group")}
          </button>
          <button className={screen === "profile" ? "active" : ""} aria-current={screen === "profile" ? "page" : undefined} onClick={() => navigate("profile")}>
            <img src={avatarSrc} alt="" /><em className="navName">{playerName || t("nav.avatar")}</em>
          </button>
        </nav>
      )}
      {doc && <DocSheet doc={doc} onClose={() => setDoc(null)} />}
      {confirmAction === "reset" && (
        <ConfirmDialog title={t("settings.resetStatsTitle")} body={t("settings.resetStatsBody")} onConfirm={resetStats} onCancel={() => setConfirmAction(null)} />
      )}
      {confirmAction === "delete" && (
        <ConfirmDialog danger title={t("settings.deleteDataTitle")} body={t("settings.deleteDataBody")} confirmLabel={t("settings.deleteDataConfirm")} onConfirm={deleteAllLocalData} onCancel={() => setConfirmAction(null)} />
      )}
      {reminderDue && !activeGame && countdown === null && (
        <ConfirmDialog
          title={t("game.reminderTitle", { n: settings.reminderMinutes })}
          body={t("game.reminderBody")}
          confirmLabel={t("game.reminderContinue")}
          onConfirm={() => { reminderAnchorRef.current = Date.now(); setReminderDue(false); }}
          onCancel={() => { reminderAnchorRef.current = Date.now(); setReminderDue(false); if (screen === "game") leaveGameNow(); }}
        />
      )}
      {notice && <div className="appToast" role="status">{notice}</div>}
    </main>
  );
}
