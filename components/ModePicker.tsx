"use client";
import { STAKES, type Stake } from "@/lib/games";

/** Lanzadera (sin dinero) y Saturno (duelos con fichas). Presentation only. */
function Moon() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="moonBody" cx="36%" cy="32%" r="80%">
          <stop offset="0" stopColor="#fbf6e6" />
          <stop offset=".55" stopColor="#cfc9b8" />
          <stop offset="1" stopColor="#7d7a78" />
        </radialGradient>
        <radialGradient id="moonShade" cx="75%" cy="70%" r="70%">
          <stop offset=".35" stopColor="rgba(5,10,30,0)" />
          <stop offset="1" stopColor="rgba(5,10,30,.65)" />
        </radialGradient>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset=".6" stopColor="rgba(200,225,255,.35)" />
          <stop offset="1" stopColor="rgba(200,225,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#moonGlow)" />
      <circle cx="60" cy="60" r="38" fill="url(#moonBody)" />
      {[[44, 48, 8], [70, 42, 5.5], [64, 70, 10], [46, 74, 4.5], [78, 62, 4], [54, 58, 3]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill="rgba(110,105,100,.38)" />
          <circle cx={x - r * 0.18} cy={y - r * 0.18} r={r * 0.78} fill="rgba(235,230,215,.4)" />
        </g>
      ))}
      <circle cx="60" cy="60" r="38" fill="url(#moonShade)" />
    </svg>
  );
}

function Saturn() {
  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="satBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3dca4" />
          <stop offset=".25" stopColor="#d9b574" />
          <stop offset=".5" stopColor="#ecd197" />
          <stop offset=".75" stopColor="#c99a5d" />
          <stop offset="1" stopColor="#8e6a42" />
        </linearGradient>
        <radialGradient id="satShade" cx="30%" cy="28%" r="85%">
          <stop offset=".45" stopColor="rgba(10,10,30,0)" />
          <stop offset="1" stopColor="rgba(10,10,30,.6)" />
        </radialGradient>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(238,214,160,.15)" />
          <stop offset=".5" stopColor="rgba(250,232,185,.95)" />
          <stop offset="1" stopColor="rgba(238,214,160,.15)" />
        </linearGradient>
        <clipPath id="frontHalf"><rect x="0" y="60" width="160" height="60" /></clipPath>
        <clipPath id="backHalf"><rect x="0" y="0" width="160" height="60" /></clipPath>
      </defs>
      <g transform="rotate(-18 80 60)">
        <g clipPath="url(#backHalf)">
          <ellipse cx="80" cy="60" rx="74" ry="17" fill="none" stroke="url(#ring)" strokeWidth="7" />
          <ellipse cx="80" cy="60" rx="60" ry="13" fill="none" stroke="rgba(214,185,130,.55)" strokeWidth="3" />
        </g>
        <circle cx="80" cy="60" r="32" fill="url(#satBody)" />
        <ellipse cx="80" cy="46" rx="30" ry="2.2" fill="rgba(150,105,60,.35)" />
        <ellipse cx="80" cy="74" rx="30" ry="2.6" fill="rgba(150,105,60,.3)" />
        <circle cx="80" cy="60" r="32" fill="url(#satShade)" />
        <g clipPath="url(#frontHalf)">
          <ellipse cx="80" cy="60" rx="74" ry="17" fill="none" stroke="url(#ring)" strokeWidth="7" />
          <ellipse cx="80" cy="60" rx="60" ry="13" fill="none" stroke="rgba(214,185,130,.6)" strokeWidth="3" />
        </g>
      </g>
      <circle cx="136" cy="26" r="3.2" fill="#d8e6f5" />
      <circle cx="18" cy="96" r="2" fill="#bcd0e8" />
    </svg>
  );
}

export default function ModePicker({
  selectedStake,
  balance,
  onSelect,
}: {
  selectedStake: number;
  balance: number;
  onSelect: (stake: Stake) => void;
}) {
  const saturn = selectedStake > 0;
  const paid = STAKES.filter((s) => s > 0);
  return (
    <section className="modePicker" aria-label="Modo de juego">
      <div className="modeStars" aria-hidden="true">
        {Array.from({ length: 26 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
      </div>
      <div className="modeCards">
        <button type="button" className={`modeCard lanzadera${!saturn ? " selected" : ""}`} aria-pressed={!saturn} onClick={() => onSelect(0)}>
          <span className="modeArt"><Moon /></span>
          <strong>Lanzadera</strong>
          <small>Juega gratis y aprende</small>
        </button>
        <button
          type="button"
          className={`modeCard saturno${saturn ? " selected" : ""}`}
          aria-pressed={saturn}
          onClick={() => onSelect((selectedStake > 0 ? selectedStake : paid.find((s) => s <= balance) ?? 1) as Stake)}
        >
          <span className="modeArt"><Saturn /></span>
          <strong>Saturno</strong>
          <small>Duelos con fichas</small>
        </button>
      </div>
      {saturn && (
        <div className="saturnStakes" role="group" aria-label="Fichas del duelo">
          <span>Fichas del duelo</span>
          {paid.map((stake) => (
            <button
              key={stake}
              type="button"
              className={selectedStake === stake ? "selected" : ""}
              aria-pressed={selectedStake === stake}
              aria-label={`Duelo de ${stake} fichas`}
              disabled={stake > balance}
              onClick={() => onSelect(stake as Stake)}
            >
              {stake}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
