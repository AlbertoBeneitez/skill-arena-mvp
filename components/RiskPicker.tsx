"use client";
import { RISKS, type RiskId } from "@/lib/progression";

/** Decision before every game: how much to gamble on this run (XP/estrellas only). */
export default function RiskPicker({ value, onChange }: { value: RiskId; onChange(id: RiskId): void }) {
  return (
    <section className="riskPicker" aria-label="Nivel de riesgo">
      <h3>RIESGO</h3>
      <div role="radiogroup" aria-label="Elige el riesgo de la próxima partida">
        {RISKS.map((risk) => (
          <button key={risk.id} type="button" role="radio" aria-checked={value === risk.id} data-risk={risk.id} className={value === risk.id ? "selected" : ""} onClick={() => onChange(risk.id)}>
            <b>×{risk.multiplier}</b>
            <span>{risk.name}</span>
            <small>{risk.need}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
