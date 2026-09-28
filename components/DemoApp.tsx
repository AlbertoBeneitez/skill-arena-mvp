"use client";

import { useEffect, useMemo, useState } from "react";
import RunnerGame from "./RunnerGame";

type Result = { won: boolean; score: number; timeMs: number };

const ENTRY = 5;
const PRIZE = 9;
const STARTING_BALANCE = 25;

const tournaments = [
  { name: "Neon Dash", mode: "1 vs 1 · recorrido fijo", entry: 5, prize: 9, players: "1/2", playable: true },
  { name: "Tap Sprint", mode: "8 jugadores · velocidad", entry: 3, prize: 20, players: "5/8", playable: false },
  { name: "Precision Grid", mode: "16 jugadores · precisión", entry: 2, prize: 24, players: "11/16", playable: false },
];

export default function DemoApp() {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [activeGame, setActiveGame] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [notice, setNotice] = useState("Demo: saldo y premios son créditos ficticios.");

  useEffect(() => {
    const saved = localStorage.getItem("skillarena-demo");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (typeof data.balance === "number") setBalance(data.balance);
      if (Array.isArray(data.history)) setHistory(data.history.slice(0, 8));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("skillarena-demo", JSON.stringify({ balance, history }));
  }, [balance, history]);

  const canEnter = balance >= ENTRY && !activeGame;

  const stats = useMemo(() => {
    const wins = history.filter((x) => x.startsWith("Victoria")).length;
    const losses = history.filter((x) => x.startsWith("Derrota")).length;
    return { wins, losses, played: wins + losses };
  }, [history]);

  function enterTournament() {
    if (!canEnter) return;
    setBalance((b) => b - ENTRY);
    setResult(null);
    setGameKey((k) => k + 1);
    setActiveGame(true);
    setNotice(`${ENTRY} créditos bloqueados como entrada. Partida iniciada.`);
  }

  function finishGame(r: Result) {
    setActiveGame(false);
    setResult(r);
    if (r.won) {
      setBalance((b) => b + PRIZE);
      setHistory((h) => [`Victoria · +${PRIZE} cr · ${(r.timeMs / 1000).toFixed(2)} s`, ...h].slice(0, 8));
      setNotice(`Victoria. Premio simulado de ${PRIZE} créditos abonado al ledger demo.`);
    } else {
      setHistory((h) => [`Derrota · -${ENTRY} cr · score ${r.score}`, ...h].slice(0, 8));
      setNotice("Partida finalizada. La entrada queda consumida en esta simulación.");
    }
  }

  function resetDemo() {
    setBalance(STARTING_BALANCE);
    setHistory([]);
    setResult(null);
    setActiveGame(false);
    setNotice("Demo restablecida a 25 créditos ficticios.");
    localStorage.removeItem("skillarena-demo");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SkillArena inicio">
          <span className="brandMark">S</span>
          <span>SkillArena <small>BETA</small></span>
        </a>
        <nav className="nav">
          <a href="#lobby">Torneos</a>
          <a href="#ranking">Ranking</a>
          <a href="#wallet">Wallet</a>
        </nav>
        <div className="account">
          <div><span className="muted">Saldo demo</span><strong>{balance.toFixed(2)} cr</strong></div>
          <div className="avatar">AB</div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <div className="eyebrow">COMPITE · DEMUESTRA · GANA</div>
          <h1>Torneos de habilidad.<br /><span>Sin azar.</span></h1>
          <p>Una primera versión funcional de tu plataforma: eliges torneo, pagas una entrada ficticia, juegas un recorrido determinista y el resultado actualiza tu saldo demo.</p>
          <div className="heroActions">
            <a className="primary" href="#play">Probar torneo</a>
            <a className="secondary" href="#lobby">Ver lobby</a>
          </div>
          <div className="trustRow">
            <span>◉ Resultado por habilidad</span>
            <span>◉ Recorrido idéntico</span>
            <span>◉ Ledger simulado</span>
          </div>
        </div>
        <div className="heroPanel">
          <div className="liveTag">● TORNEO DESTACADO</div>
          <h3>Neon Dash</h3>
          <p>Todos juegan exactamente el mismo recorrido. No existe RNG ni generación aleatoria.</p>
          <div className="prizeGrid">
            <div><span>Entrada</span><b>5 cr</b></div>
            <div><span>Premio</span><b>9 cr</b></div>
            <div><span>Formato</span><b>1 vs 1</b></div>
          </div>
          <button className="primary full" onClick={enterTournament} disabled={!canEnter}>
            {balance < ENTRY ? "Saldo insuficiente" : activeGame ? "Partida en curso" : "Entrar y jugar"}
          </button>
        </div>
      </section>

      <div className="notice">{notice}</div>

      <section className="section" id="lobby">
        <div className="sectionHead">
          <div><span className="eyebrow">LOBBY</span><h2>Torneos disponibles</h2></div>
          <span className="online">● 128 jugadores online</span>
        </div>
        <div className="cards">
          {tournaments.map((t, i) => (
            <article className="tournament" key={t.name}>
              <div className={`gameThumb g${i + 1}`}><span>{i === 0 ? "▶" : i === 1 ? "⚡" : "◎"}</span></div>
              <div className="cardBody">
                <div className="cardTop"><h3>{t.name}</h3><span>{t.players}</span></div>
                <p>{t.mode}</p>
                <div className="metrics"><span>Entrada <b>{t.entry} cr</b></span><span>Premio <b>{t.prize} cr</b></span></div>
                <button className={t.playable ? "cardButton active" : "cardButton"} onClick={t.playable ? enterTournament : undefined} disabled={!t.playable || !canEnter}>
                  {t.playable ? "Jugar demo" : "Próximamente"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section playSection" id="play">
        <div className="sectionHead">
          <div><span className="eyebrow">JUEGO DEMO</span><h2>Neon Dash</h2></div>
          <button className="ghost" onClick={enterTournament} disabled={!canEnter}>Nueva partida · {ENTRY} cr</button>
        </div>
        <RunnerGame key={gameKey} active={activeGame} onFinish={finishGame} />
        {result && (
          <div className={`resultBox ${result.won ? "win" : "loss"}`}>
            <strong>{result.won ? "Victoria" : "Eliminado"}</strong>
            <span>{result.won ? `Tiempo: ${(result.timeMs / 1000).toFixed(2)} s · +${PRIZE} cr` : `Distancia: ${result.score} · -${ENTRY} cr`}</span>
          </div>
        )}
      </section>

      <section className="section split" id="wallet">
        <div className="panel">
          <span className="eyebrow">WALLET DEMO</span>
          <div className="walletValue">{balance.toFixed(2)} <small>cr</small></div>
          <p className="muted">Créditos ficticios. En producción esta capa se conectaría al ledger y al proveedor financiero.</p>
          <div className="walletButtons"><button onClick={() => { setBalance((b) => b + 10); setNotice("Depósito simulado: +10 créditos."); }}>+10 cr prueba</button><button onClick={resetDemo}>Restablecer</button></div>
          <div className="history">
            <h4>Últimos movimientos</h4>
            {history.length === 0 ? <p className="muted">Todavía no hay partidas.</p> : history.map((x, i) => <div className="historyRow" key={`${x}-${i}`}><span>{x}</span><small>ahora</small></div>)}
          </div>
        </div>
        <div className="panel" id="ranking">
          <span className="eyebrow">PERFIL / RANKING</span>
          <div className="profileRow"><div className="avatar big">AB</div><div><h3>Jugador Demo</h3><p className="muted">#247 global</p></div></div>
          <div className="stats"><div><b>{stats.played}</b><span>Partidas</span></div><div><b>{stats.wins}</b><span>Victorias</span></div><div><b>{stats.losses}</b><span>Derrotas</span></div></div>
          <div className="leaderboard">
            <div><b>1</b><span>NovaRunner</span><strong>2.481</strong></div>
            <div><b>2</b><span>Vector9</span><strong>2.344</strong></div>
            <div><b>3</b><span>ByteFox</span><strong>2.201</strong></div>
            <div className="you"><b>247</b><span>Jugador Demo</span><strong>1.180</strong></div>
          </div>
        </div>
      </section>

      <section className="section architecture">
        <span className="eyebrow">QUÉ ESTÁ SIMULANDO ESTE MVP</span>
        <div className="flow">
          <div><b>Next.js</b><span>interfaz + juego</span></div><i>→</i>
          <div><b>localStorage</b><span>saldo temporal</span></div><i>→</i>
          <div className="future"><b>PostgreSQL</b><span>siguiente fase</span></div><i>→</i>
          <div className="future"><b>EMI</b><span>dinero real</span></div>
        </div>
      </section>

      <footer><span>SkillArena MVP · nombre provisional</span><span>Sin pagos reales · sin RNG</span></footer>
    </main>
  );
}
