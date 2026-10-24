"use client";
import { COSMETICS, levelOf, missionLabel, type MissionId, type ProgressState } from "@/lib/progression";

export default function PlayerProgress({ progress, onClaim, onEquip }: { progress: ProgressState; onClaim(id: MissionId): void; onEquip(id: string): void }) {
  const lvl = levelOf(progress.xp);
  const owned = [...COSMETICS.frames, ...COSMETICS.themes].filter((c) => progress.unlocked.includes(c.id));
  return (
    <section className="playerProgress" aria-label="Tu progreso">
      <div className="ppTop">
        <div className="ppBadge" aria-label={`Nivel ${lvl.level}`}><span>{lvl.level}</span></div>
        <div className="ppInfo">
          <strong>{lvl.name}</strong>
          <div className="ppBar" role="progressbar" aria-valuemin={0} aria-valuemax={lvl.need} aria-valuenow={lvl.into}><i style={{ width: `${Math.round((lvl.into / lvl.need) * 100)}%` }} /></div>
          <small>{lvl.into} / {lvl.need} XP</small>
        </div>
        <div className="ppStats">
          <span title="Racha diaria">🔥 {progress.streak}</span>
          <span title="Estrellas">⭐ {progress.stars}</span>
        </div>
      </div>
      <ul className="ppMissions" aria-label="Misiones de hoy">
        {progress.missions.map((m) => {
          const done = m.progress >= m.goal;
          return (
            <li key={m.id} className={done ? "done" : ""}>
              <span>{missionLabel(m.id)}</span>
              <em>{Math.min(m.progress, m.goal)}/{m.goal}</em>
              {m.claimed ? <b className="ppClaimed">✓</b> : <button type="button" disabled={!done} className={done ? "ready" : ""} onClick={() => onClaim(m.id)}>{done ? `+${m.reward} ⭐` : `${m.reward} ⭐`}</button>}
            </li>
          );
        })}
      </ul>
      {owned.length > 0 && (
        <div className="ppCosmetics" aria-label="Cosméticos">
          {owned.map((c) => {
            const active = progress.frame === c.id || progress.theme === c.id;
            const color = "color" in c ? c.color : c.accent;
            return <button key={c.id} type="button" aria-pressed={active} title={c.name} style={{ ["--c" as string]: color }} onClick={() => onEquip(c.id)}>{c.name}</button>;
          })}
        </div>
      )}
    </section>
  );
}
