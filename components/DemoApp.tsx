"use client";

import { useEffect, useState } from "react";

const STARTING_BALANCE = 25;

const tournaments = [
  {
    name: "Tap Sprint",
    mode: "8 jugadores · velocidad",
    entry: 3,
    prize: 20,
    players: "5/8",
  },
  {
    name: "Precision Grid",
    mode: "16 jugadores · precisión",
    entry: 2,
    prize: 24,
    players: "11/16",
  },
];

export default function DemoApp() {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [notice, setNotice] = useState(
    "Demo: el saldo son créditos ficticios."
  );

  // Evita sobrescribir localStorage antes de haber recuperado
  // los datos guardados previamente.
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Recuperar el saldo guardado al abrir la web.
  useEffect(() => {
    const saved = localStorage.getItem("skillarena-demo");

    if (saved) {
      try {
        const data = JSON.parse(saved);

        if (typeof data.balance === "number") {
          setBalance(data.balance);
        }
      } catch {
        console.warn("No se pudieron recuperar los datos guardados.");
      }
    }

    setIsLoaded(true);
  }, []);

  // 2. Guardar cambios únicamente después de haber cargado
  // el estado anterior.
  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem("skillarena-demo", JSON.stringify({ balance }));
  }, [balance, isLoaded]);

  function resetDemo() {
    setBalance(STARTING_BALANCE);
    setNotice("Demo restablecida a 25 créditos ficticios.");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SkillArena inicio">
          <span className="brandMark">S</span>
          <span>
            SkillArena <small>BETA</small>
          </span>
        </a>

        <nav className="nav">
          <a href="#lobby">Torneos</a>
          <a href="#wallet">Wallet</a>
        </nav>

        <div className="account">
          <div>
            <span className="muted">Saldo demo</span>
            <strong>{balance.toFixed(2)} cr</strong>
          </div>
          <div className="avatar">AB</div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <div className="eyebrow">COMPITE · DEMUESTRA · GANA</div>

          <h1>
            <span>Torneos de habilidad.</span>
          </h1>

          <p>
            Primera versión de demostración de la plataforma. Los créditos son
            ficticios y todavía no hay juegos publicados.
          </p>

          <div className="heroActions">
            <a className="primary" href="#lobby">
              Ver torneos
            </a>
          </div>
        </div>

        <div className="heroPanel">
          <div className="liveTag">● SIN JUEGOS PUBLICADOS</div>

          <h3>Próximamente</h3>

          <p>
            Cada juego necesita su especificación y una versión registrada
            antes de publicarse.
          </p>
        </div>
      </section>

      <div className="notice">{notice}</div>

      <section className="section" id="lobby">
        <div className="sectionHead">
          <div>
            <span className="eyebrow">LOBBY</span>
            <h2>Torneos disponibles</h2>
          </div>

          <span className="online">● 128 jugadores online</span>
        </div>

        <div className="cards">
          {tournaments.map((t, i) => (
            <article className="tournament" key={t.name}>
              <div className={`gameThumb g${i + 2}`}>
                <span>{i === 0 ? "⚡" : "◎"}</span>
              </div>

              <div className="cardBody">
                <div className="cardTop">
                  <h3>{t.name}</h3>
                  <span>{t.players}</span>
                </div>

                <p>{t.mode}</p>

                <div className="metrics">
                  <span>
                    Entrada <b>{t.entry} cr</b>
                  </span>

                  <span>
                    Premio <b>{t.prize} cr</b>
                  </span>
                </div>

                <button className="cardButton" disabled>
                  Próximamente
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="wallet">
        <div className="panel">
          <span className="eyebrow">WALLET DEMO</span>

          <div className="walletValue">
            {balance.toFixed(2)} <small>cr</small>
          </div>

          <p className="muted">
            Créditos ficticios. En producción esta capa se conectaría al
            ledger y al proveedor financiero.
          </p>

          <div className="walletButtons">
            <button
              onClick={() => {
                setBalance((b) => b + 10);
                setNotice("Depósito simulado: +10 créditos.");
              }}
            >
              +10 cr prueba
            </button>

            <button onClick={resetDemo}>Restablecer</button>
          </div>
        </div>
      </section>

      <section className="section architecture">
        <span className="eyebrow">QUÉ ESTÁ SIMULANDO ESTE MVP</span>

        <div className="flow">
          <div>
            <b>Next.js</b>
            <span>interfaz + juego</span>
          </div>

          <i>→</i>

          <div>
            <b>localStorage</b>
            <span>saldo temporal</span>
          </div>

          <i>→</i>

          <div className="future">
            <b>PostgreSQL</b>
            <span>siguiente fase</span>
          </div>

          <i>→</i>

          <div className="future">
            <b>EMI</b>
            <span>dinero real</span>
          </div>
        </div>
      </section>

      <footer>
        <span>SkillArena MVP · nombre provisional</span>
        <span>Sin pagos reales</span>
      </footer>
    </main>
  );
}