"use client";
import { useEffect, useState } from "react";
import { RISKS, levelOf, missionLabel, type ChestCard, type RunApplied } from "@/lib/progression";
import RewardChest from "./RewardChest";

export default function RunRewards({ applied, seed, unlocked, onPick }: { applied: RunApplied; seed: string; unlocked: readonly string[]; onPick(card: ChestCard): void }) {
  const { outcome } = applied;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(outcome.xpGain); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(outcome.xpGain * (1 - (1 - t) * (1 - t))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [outcome.xpGain, seed]);
  const risk = RISKS.find((r) => r.id === outcome.risk)!;
  const after = levelOf(applied.state.xp);
  return (
    <section className="runRewards" aria-label="Recompensas de la partida">
      <div className="rrGain">
        <b>+{shown} XP</b>
        <span>+{outcome.starsGain} ⭐</span>
        {outcome.risk !== "calm" && <em className={outcome.met ? "hit" : "miss"}>{outcome.met ? `${risk.name} ×${risk.multiplier} · ¡cumplido!` : `${risk.name} · no se cumplió, mitad de premio`}</em>}
        {outcome.newBest && outcome.previousBest > 0 && <em className="hit">¡Nuevo récord personal!</em>}
      </div>
      {applied.leveledUp && (
        <div className="levelUp" role="status">
          <div className="lvParticles" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * (360 / 14)}deg`, ["--d" as string]: `${50 + (i % 3) * 18}px` }} />)}</div>
          <strong>NIVEL {after.level}</strong>
          <small>{after.name}</small>
        </div>
      )}
      {applied.missionsDone.length > 0 && <p className="rrMission" role="status">Misión lista: {applied.missionsDone.map(missionLabel).join(" · ")}</p>}
      <RewardChest key={seed} seed={seed} unlocked={unlocked} met={outcome.met} onPick={onPick} />
    </section>
  );
}
