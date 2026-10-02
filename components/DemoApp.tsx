"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GameLoader from "./GameLoader";
import { GAMES, STAKES, modeForStake, prizeForStake, type GameMeta, type MatchMode, type Stake } from "@/lib/games";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

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
  bestScores: Record<string, number>;
};

const VALID_SCREENS: Screen[] = ["welcome", "avatar-setup", "home", "play", "game", "wallet", "profile", "legal"];

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && VALID_SCREENS.includes(value as Screen);
}

const AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/avatar-${i + 1}.svg`);
const START_BALANCE = 25;

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

const BLOCKED_DEMO_NAMES = new Set(["admin", "skillarena", "skill_arena", "soporte", "support"]);

function isDemoNameAvailable(value: string) {
  const clean = value.trim();
  if (!/^[A-Za-z0-9_]{3,18}$/.test(clean)) return false;
  return !BLOCKED_DEMO_NAMES.has(clean.toLowerCase());
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
  const [activeGame, setActiveGame] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
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
      setAvatarEditorOpen(false);
      setAvatarGenerating(false);
      setAvatarError("");
      setScreen("welcome");
      setTutorialSeen(false);
      setTutorialOpen(false);
      setTutorialStep(0);
      setIsLoaded(true);
      return;
    }

    const raw = localStorage.getItem("skill-arena-v3") ?? localStorage.getItem("skill-arena-v2");
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
        if (typeof data.avatarSrc === "string" && data.avatarSrc) setAvatarSrc(data.avatarSrc);
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.netEarnings === "number") setNetEarnings(data.netEarnings);
        if (data.nextTurn === "create" || data.nextTurn === "existing") setNextTurn(data.nextTurn);
        if (typeof data.musicOn === "boolean") setMusicOn(data.musicOn);
        if (Array.isArray(data.earnings) && data.earnings.length) setEarnings(data.earnings.slice(-20));
        if (Array.isArray(data.movements)) setMovements(data.movements.slice(0, 20));
        if (typeof data.wins === "number") setWins(data.wins);
        if (typeof data.losses === "number") setLosses(data.losses);
        if (typeof data.streak === "number") setStreak(data.streak);
        if (data.bestScores && typeof data.bestScores === "object") setBestScores(data.bestScores);
      } catch {}
    }
    setTutorialSeen(localStorage.getItem("skill-arena-color-tutorial-v1") === "1");
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
      bestScores,
    };
    localStorage.setItem("skill-arena-v3", JSON.stringify(data));
  }, [isLoaded, onboarded, provider, playerName, avatarId, avatarSrc, balance, netEarnings, nextTurn, musicOn, earnings, movements, tutorialSeen, wins, losses, streak, bestScores]);

  useEffect(() => {
    if (!isLoaded) return;

    window.history.replaceState({ skillArenaScreen: screen }, "", `#${screen}`);

    const onPopState = (event: PopStateEvent) => {
      const target = event.state?.skillArenaScreen;
      setActiveGame(false);
      setCountdown(null);
      setResult(null);
      setTutorialOpen(false);
      setScreen(isScreen(target) ? target : onboarded ? "home" : "welcome");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLoaded, onboarded]);

  useEffect(() => {
    if (isLoaded && onboarded && screen === "play" && !tutorialSeen) {
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  }, [isLoaded, onboarded, screen, tutorialSeen]);

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
    if (next === screen) return;
    const state = { skillArenaScreen: next };
    if (replace) window.history.replaceState(state, "", `#${next}`);
    else window.history.pushState(state, "", `#${next}`);
    setScreen(next);
  }

  function advanceTutorial() {
    if (tutorialStep < 2) {
      setTutorialStep((step) => step + 1);
      return;
    }
    localStorage.setItem("skill-arena-color-tutorial-v1", "1");
    setTutorialSeen(true);
    setTutorialOpen(false);
  }

  const rank = rankingFromEarnings(netEarnings);
  const nameAvailable = isDemoNameAvailable(playerName);
  const matchesPlayed = wins + losses;
  const winRate = matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;
  const selectedBest = bestScores[selectedGame.id] ?? 0;

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
    const nextAvatarId = Math.floor(Math.random() * AVATARS.length);
    setAvatarId(nextAvatarId);
    setAvatarSrc(AVATARS[nextAvatarId]);
    setAvatarPrompt("");
    setAvatarEditorOpen(false);
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
      setAvatarSrc(data.image);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "No se pudo generar el avatar.");
    } finally {
      setAvatarGenerating(false);
    }
  }

  function handleAvatarUpload(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarSrc(reader.result);
    };
    reader.readAsDataURL(file);
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
    setSelectedGame(game);
    setSelectedStake(0);
    setSelectedMode(modeForStake(game, 0, nextTurn));
    setResult(null);
    setActiveGame(false);
    navigate("play");
  }

  function selectStake(stake: Stake) {
    haptic(4);
    setSelectedStake(stake);
    setSelectedMode(modeForStake(selectedGame, stake, nextTurn));
  }

  function startMatch() {
    if (selectedStake > balance) return;
    setBalance((b) => Number((b - selectedStake).toFixed(2)));
    if (selectedStake > 0) {
      setMovements((items) => [{ label: `${selectedGame.name} · entrada`, amount: -selectedStake }, ...items].slice(0, 20));
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
    setActiveGame(false);
    const didWin = gameResult.score >= selectedGame.rivalScore;
    const resolvedResult = { ...gameResult, won: didWin };
    setResult(resolvedResult);
    setBestScores((scores) => ({
      ...scores,
      [selectedGame.id]: Math.max(scores[selectedGame.id] ?? 0, gameResult.score),
    }));

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

    if (selectedStake > 0) {
      const nextValue = Number((netEarnings + delta).toFixed(2));
      setNetEarnings(nextValue);
      setEarnings((points) => [...points, { label: `P${points.length}`, value: nextValue }].slice(-20));
    }

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
    navigate("profile");
  }

  function logoutDemo() {
    localStorage.removeItem("skill-arena-v2");
    localStorage.removeItem("skill-arena-v3");
    localStorage.removeItem("skill-arena-color-tutorial-v1");
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
    setBestScores({});
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
          <p className="microcopy">V4 · COMPETITIVE BUILD</p>
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
                  {avatarGenerating ? "GENERANDO..." : "GENERAR"}
                </button>
                <button className="secondaryAction" type="button" onClick={() => fileInputRef.current?.click()}>SUBIR FOTO</button>
              </div>
              {avatarError && <div className="avatarError">{avatarError}</div>}
            </div>
          )}

          <button className="mainAction" onClick={completeAvatar} disabled={!nameAvailable || avatarGenerating}>CONTINUAR</button>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <button className="logoButton" onClick={() => navigate("home")}>SKILL ARENA</button>
        <button className="balanceChip" onClick={() => navigate("wallet")}>{euro(balance)}</button>
      </header>

      <div className="appBody">
        {screen === "home" && (
          <>
            <button className="playerStrip" onClick={() => navigate("profile")}>
              <img src={avatarSrc} alt="Avatar" />
              <strong>{playerName}</strong>
              <span className="rankNumber">#{rank}</span>
              <span className={`moneyNumber ${netEarnings < 0 ? "negative" : ""}`}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</span>
            </button>

            <section className="arenaSummary">
              <div className="arenaSummaryMain">
                <span>ARENA RATING</span>
                <strong>{Math.max(1000, 1200 + wins * 22 - losses * 14)}</strong>
                <small>#{rank} global demo</small>
              </div>
              <div className="arenaMetric"><span>RACHA</span><b>{streak}</b></div>
              <div className="arenaMetric"><span>VICTORIAS</span><b>{wins}</b></div>
              <div className="arenaMetric"><span>WIN RATE</span><b>{winRate}%</b></div>
            </section>

            <section className="homeSection">
              <div className="sectionTitle"><span>ARENAS</span><button onClick={() => navigate("play")}>VER TODAS →</button></div>
              <div className="gameGrid premiumGrid">
                {GAMES.map((game) => (
                  <button className="gameCard premiumGameCard" key={game.id} onClick={() => openGame(game)}>
                    <div className="gameCoverWrap">
                      <img src={game.cover} alt={game.name} />
                      <span className="gameCategory">{game.category}</span>
                      <span className="gameDifficulty">{game.difficulty}</span>
                    </div>
                    <div className="gameCardCopy">
                      <strong>{game.name}</strong>
                      <span>{game.tagline}</span>
                      <small>{game.skillLabel}</small>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="turnPanel competitiveTurn">
              <div>
                <span>PRÓXIMO DUELO</span>
                <strong>{nextTurn === "create" ? "MARCA EL RETO" : "SUPERA UNA MARCA"}</strong>
              </div>
              <div className="turnPulse"><i /> LIVE</div>
              <small>{nextTurn === "create" ? "Juegas primero y dejas una marca que otro jugador tendrá que superar." : "Ya existe una marca. Entra y demuestra que puedes superarla."}</small>
            </section>
          </>
        )}

        {screen === "play" && (
          <section className="catalogScreen">
            <div className="screenTop"><button className="textBack" onClick={() => window.history.back()}>← INICIO</button><span>JUGAR</span></div>
            <div className="gameGrid large">
              {GAMES.map((game) => (
                <button className={`gameCard premiumGameCard ${selectedGame.id === game.id ? "selectedGame" : ""}`} key={game.id} onClick={() => openGame(game)}>
                  <div className="gameCoverWrap">
                    <img src={game.cover} alt={game.name} />
                    <span className="gameCategory">{game.category}</span>
                  </div>
                  <div className="gameCardCopy"><strong>{game.name}</strong><span>{game.skillLabel}</span></div>
                </button>
              ))}
            </div>

            <div className="gameDetail">
              <img className="detailCover" src={selectedGame.cover} alt={selectedGame.name} />
              <div className="detailHeader">
                <div><h2>{selectedGame.name}</h2><p>{selectedGame.tagline}</p></div>
                <span>{selectedGame.difficulty}</span>
              </div>
              <div className="skillChips">
                <span>{selectedGame.category}</span><span>{selectedGame.skillLabel}</span><span>100% SKILL</span><span>HASTA FALLAR</span>
              </div>
              <div className="gameBrief">
                <div><span>CONTROLES</span><p>{selectedGame.instruction}</p></div>
                <div><span>PUNTUACIÓN</span><p>{selectedGame.scoring}</p></div>
              </div>
              <div className="rivalPreview">
                <div className="rivalIdentity"><img src={selectedGame.rivalAvatar} alt="" /><div><small>MARCA A SUPERAR</small><strong>{selectedGame.rivalName}</strong></div></div>
                <b>{selectedGame.rivalScore.toLocaleString("es-ES")} pts</b>
              </div>
              <div className="personalBestLine"><span>TU MEJOR MARCA</span><b>{selectedBest ? `${selectedBest.toLocaleString("es-ES")} pts` : "SIN MARCA"}</b></div>
              <div className="stakesLabel">ELIGE PARTIDA</div>
              <div className="stakesGrid">
                {STAKES.map((stake) => {
                  const mode = modeForStake(selectedGame, stake, nextTurn);
                  return (
                    <button
                      key={stake}
                      className={`stakeButton ${mode} ${selectedStake === stake ? "selected" : ""}`}
                      onClick={() => selectStake(stake)}
                    >
                      {stake}€
                    </button>
                  );
                })}
              </div>
              <div className="modeLegend"><span><i className="dot create" /> inicial</span><span><i className="dot existing" /> existente</span><span><i className="dot waiting" /> sala de espera</span></div>
              <div className="selectedMatchLine">
                <span>{selectedMode === "create" ? "PARTIDA INICIAL" : selectedMode === "existing" ? "JUGADA EXISTENTE" : "RIVAL EN SALA"}</span>
                <strong>{selectedStake === 0 ? "GRATIS" : `PREMIO ${euro(prizeForStake(selectedStake))}`}</strong>
              </div>
              <button className="mainAction duelEntryAction" onClick={startMatch} disabled={selectedStake > balance}>{selectedStake === 0 ? "ENTRENAR GRATIS" : `ENTRAR AL DUELO · ${selectedStake}€`}</button>
            </div>
          </section>
        )}

        {screen === "game" && (
          <section className="gameScreen">
            <div className="screenTop"><button className="textBack" onClick={() => { if (!activeGame && countdown === null) window.history.back(); }}>← {activeGame || countdown !== null ? "DUELO" : "VOLVER"}</button><span>{selectedGame.name.toUpperCase()}</span></div>

            <div className="duelHud">
              <div className="duelist">
                <img src={avatarSrc} alt="" />
                <div><small>TÚ</small><strong>{playerName || "PLAYER"}</strong></div>
              </div>
              <div className="versusBadge">VS</div>
              <div className="duelist rival">
                <div><small>RIVAL</small><strong>{selectedGame.rivalName}</strong></div>
                <img src={selectedGame.rivalAvatar} alt="" />
              </div>
            </div>
            <div className="duelObjective">
              <span>OBJETIVO</span>
              <strong>SUPERA {selectedGame.rivalScore.toLocaleString("es-ES")} PTS</strong>
              <small>{selectedGame.skillLabel} · mismo estado inicial · cero azar · la ronda termina al fallar</small>
            </div>

            <div className="gameArenaWrap">
              <GameLoader game={selectedGame} active={activeGame} instanceKey={gameKey} onFinish={finishMatch} />
              {countdown !== null && (
                <div className="countdownOverlay">
                  <small>PREPÁRATE</small>
                  <b>{countdown > 0 ? countdown : "GO"}</b>
                  <span>{selectedGame.tagline}</span>
                </div>
              )}
            </div>

            {result && (
              <div className={`resultPanel premiumResult ${result.won ? "win" : "loss"}`}>
                <div className="resultIcon">{result.won ? "🏆" : "⚔"}</div>
                <b>{result.won ? "VICTORIA" : "RETO NO SUPERADO"}</b>
                <p>{result.won ? `Has superado la marca de ${selectedGame.rivalName} antes de caer.` : `La ronda terminó al fallar. Te han faltado ${Math.max(0, selectedGame.rivalScore - result.score).toLocaleString("es-ES")} puntos.`}</p>
                <div className="scoreComparison">
                  <div><small>TU MARCA</small><strong>{result.score.toLocaleString("es-ES")}</strong></div>
                  <div className="scoreVs">VS</div>
                  <div><small>{selectedGame.rivalName}</small><strong>{selectedGame.rivalScore.toLocaleString("es-ES")}</strong></div>
                </div>
                {result.score >= selectedBest && <div className="newBestBadge">★ NUEVA MEJOR MARCA</div>}
                <div className="resultMeta">
                  <span>{(result.timeMs / 1000).toFixed(2)} s</span>
                  <span>Rating {result.won ? "+22" : "-14"}</span>
                  <span>Racha {result.won ? streak : 0}</span>
                  <strong>{selectedStake === 0 ? "0,00 €" : result.won ? `+${euro(prizeForStake(selectedStake) - selectedStake)}` : `-${euro(selectedStake)}`}</strong>
                </div>
                <div className="resultActions">
                  <button className="rematchAction" onClick={startMatch}>REVANCHA</button>
                  <button className="mainAction" onClick={() => navigate("play")}>OTRA ARENA</button>
                </div>
              </div>
            )}
          </section>
        )}

        {screen === "wallet" && (
          <section className="simpleScreen">
            <div className="screenTop"><span>WALLET</span></div>
            <div className="walletBalance"><small>SALDO</small><strong>{euro(balance)}</strong></div>
            <div className="walletActions"><button onClick={() => { setBalance((b) => b + 10); setMovements((m) => [{ label: "Ingreso demo", amount: 10 }, ...m]); }}>INGRESAR</button><button disabled>RETIRAR</button></div>
            <div className="movementList"><div className="listTitle">HISTORIAL</div>{movements.length === 0 ? <p className="emptyText">Sin movimientos.</p> : movements.map((m, i) => <div className="movement" key={`${m.label}-${i}`}><span>{m.label}</span><b className={m.amount < 0 ? "negative" : ""}>{m.amount > 0 ? "+" : ""}{euro(m.amount)}</b></div>)}</div>
          </section>
        )}

        {screen === "profile" && (
          <section className="simpleScreen">
            <div className="screenTop"><span>AVATAR</span></div>
            <div className="profileStrip"><img src={avatarSrc} alt="Avatar" /><div><strong>{playerName}</strong><span>#{rank}</span></div><b className={netEarnings < 0 ? "negative" : ""}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</b></div>
            <div className="chartPanel">
              <div className="chartHead"><span>DINERO GANADO</span><strong>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</strong></div>
              <svg className="earningsChart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Dinero ganado en función del tiempo">
                <line x1="0" y1="50" x2="100" y2="50" className="zeroLine" />
                <polyline points={chartPoints} className="profitLine" />
              </svg>
              <div className="chartAxis"><span>INICIO</span><span>AHORA</span></div>
            </div>
            <div className="settingsList">
              <button onClick={() => setMusicOn((v) => !v)}><span>MÚSICA</span><b>{musicOn ? "ON" : "OFF"}</b></button>
              <button onClick={() => { setAvatarEditorOpen(false); setAvatarError(""); navigate("avatar-setup"); }}><span>CAMBIAR NOMBRE / AVATAR</span><b>→</b></button>
              <button onClick={resetAvatar}><span>RESETEAR AVATAR</span><b>0 €</b></button>
              <button onClick={() => navigate("legal")}><span>LEGAL</span><b>→</b></button>
              <button onClick={logoutDemo}><span>CERRAR SESIÓN DEMO</span><b>×</b></button>
            </div>
            <p className="resetNote">Resetear avatar reinicia ranking y resultado competitivo visible. El saldo de wallet no se borra.</p>
          </section>
        )}

        {screen === "legal" && (
          <section className="simpleScreen">
            <div className="screenTop"><button className="textBack" onClick={() => window.history.back()}>← AVATAR</button><span>LEGAL</span></div>
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

      {tutorialOpen && screen === "play" && (
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
        <nav className="bottomNav" aria-label="Navegación principal">
          <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌂</span>INICIO</button>
          <button className={screen === "play" ? "active" : ""} onClick={() => { navigate("play"); setSelectedGame(GAMES[0]); setSelectedStake(0); setSelectedMode(modeForStake(GAMES[0], 0, nextTurn)); }}><span>▶</span>JUGAR</button>
          <button className={screen === "wallet" ? "active" : ""} onClick={() => navigate("wallet")}><span>□</span>WALLET</button>
          <button className={screen === "profile" ? "active" : ""} onClick={() => navigate("profile")}><img src={avatarSrc} alt="" />AVATAR</button>
        </nav>
      )}
    </main>
  );
}
