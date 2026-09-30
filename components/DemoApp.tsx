"use client";

import { useEffect, useMemo, useState } from "react";
import GameLoader from "./GameLoader";
import { GAMES, STAKES, modeForStake, prizeForStake, type GameMeta, type MatchMode, type Stake } from "@/lib/games";
import type { GameResult } from "@/lib/types";

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
  balance: number;
  netEarnings: number;
  nextTurn: Turn;
  musicOn: boolean;
  earnings: EarningsPoint[];
  movements: Movement[];
  tutorialSeen: boolean;
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

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [onboarded, setOnboarded] = useState(false);
  const [provider, setProvider] = useState<Provider>(null);
  const [playerName, setPlayerName] = useState("PLAYER_001");
  const [avatarId, setAvatarId] = useState(0);
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy" | "cookies" | "rules">("terms");

  useEffect(() => {
    const raw = localStorage.getItem("skill-arena-v3") ?? localStorage.getItem("skill-arena-v2");
    if (raw) {
      try {
        const data = JSON.parse(raw) as Partial<PersistedState>;
        if (data.onboarded) { setOnboarded(true); setScreen("home"); }
        if (data.provider === "google" || data.provider === "apple") setProvider(data.provider);
        if (typeof data.playerName === "string") setPlayerName(data.playerName);
        if (typeof data.avatarId === "number") setAvatarId(Math.max(0, Math.min(AVATARS.length - 1, data.avatarId)));
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.netEarnings === "number") setNetEarnings(data.netEarnings);
        if (data.nextTurn === "create" || data.nextTurn === "existing") setNextTurn(data.nextTurn);
        if (typeof data.musicOn === "boolean") setMusicOn(data.musicOn);
        if (Array.isArray(data.earnings) && data.earnings.length) setEarnings(data.earnings.slice(-20));
        if (Array.isArray(data.movements)) setMovements(data.movements.slice(0, 20));
        if (typeof data.tutorialSeen === "boolean") setTutorialSeen(data.tutorialSeen);
      } catch {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const data: PersistedState = {
      onboarded,
      provider,
      playerName,
      avatarId,
      balance,
      netEarnings,
      nextTurn,
      musicOn,
      earnings,
      movements,
      tutorialSeen,
    };
    localStorage.setItem("skill-arena-v3", JSON.stringify(data));
  }, [isLoaded, onboarded, provider, playerName, avatarId, balance, netEarnings, nextTurn, musicOn, earnings, movements, tutorialSeen]);

  useEffect(() => {
    if (!isLoaded) return;

    window.history.replaceState({ skillArenaScreen: screen }, "", `#${screen}`);

    const onPopState = (event: PopStateEvent) => {
      const target = event.state?.skillArenaScreen;
      setActiveGame(false);
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
    setTutorialSeen(true);
    setTutorialOpen(false);
  }

  const rank = rankingFromEarnings(netEarnings);

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
    setAvatarId(Math.floor(Math.random() * AVATARS.length));
    navigate("avatar-setup");
  }

  function completeAvatar() {
    const clean = playerName.trim().slice(0, 18);
    setPlayerName(clean || "PLAYER_001");
    setOnboarded(true);
    navigate("home", true);
  }

  function openGame(game: GameMeta) {
    setSelectedGame(game);
    setSelectedStake(0);
    setSelectedMode(modeForStake(game, 0, nextTurn));
    setResult(null);
    setActiveGame(false);
    navigate("play");
  }

  function selectStake(stake: Stake) {
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
    setGameKey((k) => k + 1);
    setActiveGame(true);
    navigate("game");
  }

  function finishMatch(gameResult: GameResult) {
    setActiveGame(false);
    setResult(gameResult);
    const prize = prizeForStake(selectedStake);
    const delta = gameResult.won ? prize - selectedStake : -selectedStake;

    if (gameResult.won && prize > 0) {
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
    setAvatarId((avatarId + 1) % AVATARS.length);
    setPlayerName("PLAYER_NEW");
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    navigate("profile");
  }

  function logoutDemo() {
    localStorage.removeItem("skill-arena-v2");
    localStorage.removeItem("skill-arena-v3");
    setOnboarded(false);
    setProvider(null);
    setPlayerName("PLAYER_001");
    setAvatarId(0);
    setBalance(START_BALANCE);
    setNetEarnings(0);
    setNextTurn("create");
    setEarnings([{ label: "Inicio", value: 0 }]);
    setMovements([]);
    navigate("welcome", true);
  }

  if (screen === "welcome") {
    return (
      <main className="onboarding">
        <section className="welcomeCard">
          <div className="wordmark">SKILL ARENA</div>
          <div className="olympus" aria-label="Camino hacia el Olimpo">
            <div className="olympusPeak">OLIMPO</div>
            <div className="mountain mountainLeft" />
            <div className="mountain mountainRight" />
            <div className="pathLine p1" /><div className="pathLine p2" /><div className="pathLine p3" /><div className="pathLine p4" />
            <div className="traveler" />
          </div>
          <div className="welcomeCopy">SUBE. COMPITE. LLEGA ARRIBA.</div>
          <button className="authButton google" onClick={() => chooseProvider("google")}><span>G</span>Continuar con Google</button>
          <button className="authButton apple" onClick={() => chooseProvider("apple")}><span>●</span>Continuar con Apple</button>
          <p className="microcopy">Demo V2 · sin pagos reales</p>
        </section>
      </main>
    );
  }

  if (screen === "avatar-setup") {
    return (
      <main className="onboarding">
        <section className="setupCard">
          <button className="textBack" onClick={() => window.history.back()}>← VOLVER</button>
          <div className="screenCode">02 / AVATAR</div>
          <h1>CONFIGURA TU AVATAR</h1>
          <label className="fieldLabel">NOMBRE</label>
          <input className="nameInput" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={18} />
          <div className="fieldLabel">FOTO</div>
          <div className="avatarGallery">
            {AVATARS.map((avatar, index) => (
              <button key={avatar} className={`avatarChoice ${avatarId === index ? "selected" : ""}`} onClick={() => setAvatarId(index)}>
                <img src={avatar} alt={`Avatar ${index + 1}`} />
              </button>
            ))}
          </div>
          <button className="mainAction" onClick={completeAvatar}>ENTRAR EN SKILL ARENA</button>
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
              <img src={AVATARS[avatarId]} alt="Avatar" />
              <strong>{playerName}</strong>
              <span className="rankNumber">#{rank}</span>
              <span className={`moneyNumber ${netEarnings < 0 ? "negative" : ""}`}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</span>
            </button>

            <section className="homeSection">
              <div className="sectionTitle"><span>JUGAR</span><button onClick={() => navigate("play")}>VER TODOS →</button></div>
              <div className="gameGrid">
                {GAMES.map((game) => (
                  <button className="gameCard" key={game.id} onClick={() => openGame(game)}>
                    <img src={game.cover} alt={game.name} />
                    <div><strong>{game.name}</strong><span>1 VS 1</span></div>
                  </button>
                ))}
              </div>
            </section>

            <section className="turnPanel">
              <span>PRÓXIMA JUGADA</span>
              <strong>{nextTurn === "create" ? "INICIAL" : "CONTRA JUGADA EXISTENTE"}</strong>
              <small>{nextTurn === "create" ? "Tu resultado quedará disponible para otro jugador." : "Ahora tienes derecho a consumir una jugada ya creada."}</small>
            </section>
          </>
        )}

        {screen === "play" && (
          <section className="catalogScreen">
            <div className="screenTop"><button className="textBack" onClick={() => window.history.back()}>← INICIO</button><span>JUGAR</span></div>
            <div className="gameGrid large">
              {GAMES.map((game) => (
                <button className={`gameCard ${selectedGame.id === game.id ? "selectedGame" : ""}`} key={game.id} onClick={() => openGame(game)}>
                  <img src={game.cover} alt={game.name} />
                  <div><strong>{game.name}</strong><span>1 VS 1</span></div>
                </button>
              ))}
            </div>

            <div className="gameDetail">
              <img className="detailCover" src={selectedGame.cover} alt={selectedGame.name} />
              <div className="detailHeader"><h2>{selectedGame.name}</h2><span>1 VS 1</span></div>
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
              <button className="mainAction" onClick={startMatch} disabled={selectedStake > balance}>JUGAR · {selectedStake}€</button>
            </div>
          </section>
        )}

        {screen === "game" && (
          <section className="gameScreen">
            <div className="screenTop"><button className="textBack" onClick={() => { if (!activeGame) window.history.back(); }}>← {activeGame ? "PARTIDA" : "VOLVER"}</button><span>{selectedGame.name.toUpperCase()}</span></div>
            <GameLoader game={selectedGame} active={activeGame} instanceKey={gameKey} onFinish={finishMatch} />
            {result && (
              <div className={`resultPanel ${result.won ? "win" : "loss"}`}>
                <b>{result.won ? "VICTORIA" : "DERROTA"}</b>
                <span>{result.score} pts · {(result.timeMs / 1000).toFixed(2)} s</span>
                <strong>{selectedStake === 0 ? "0,00 €" : result.won ? `+${euro(prizeForStake(selectedStake) - selectedStake)}` : `-${euro(selectedStake)}`}</strong>
                <button className="mainAction" onClick={() => navigate("play")}>VOLVER A JUGAR</button>
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
            <div className="profileStrip"><img src={AVATARS[avatarId]} alt="Avatar" /><div><strong>{playerName}</strong><span>#{rank}</span></div><b className={netEarnings < 0 ? "negative" : ""}>{netEarnings > 0 ? "+" : ""}{euro(netEarnings)}</b></div>
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
              <button onClick={() => navigate("avatar-setup")}><span>CAMBIAR NOMBRE / FOTO</span><b>→</b></button>
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
            <button className="mainAction" onClick={advanceTutorial}>{tutorialStep < 2 ? "SIGUIENTE" : "ENTENDIDO"}</button>
          </div>
        </div>
      )}

      {screen !== "game" && screen !== "legal" && (
        <nav className="bottomNav" aria-label="Navegación principal">
          <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌂</span>INICIO</button>
          <button className={screen === "play" ? "active" : ""} onClick={() => { navigate("play"); setSelectedGame(GAMES[0]); setSelectedStake(0); setSelectedMode(modeForStake(GAMES[0], 0, nextTurn)); }}><span>▶</span>JUGAR</button>
          <button className={screen === "wallet" ? "active" : ""} onClick={() => navigate("wallet")}><span>□</span>WALLET</button>
          <button className={screen === "profile" ? "active" : ""} onClick={() => navigate("profile")}><img src={AVATARS[avatarId]} alt="" />AVATAR</button>
        </nav>
      )}
    </main>
  );
}
