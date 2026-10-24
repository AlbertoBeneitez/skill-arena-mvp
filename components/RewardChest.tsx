"use client";
import { useMemo, useState } from "react";
import { rollChest, type ChestCard } from "@/lib/progression";

/** Pick 1 of 3 face-down cards; the other two are revealed afterwards (so near-misses are visible). */
export default function RewardChest({ seed, unlocked, met, onPick }: { seed: string; unlocked: readonly string[]; met: boolean; onPick(card: ChestCard): void }) {
  const cards = useMemo(() => rollChest(seed, unlocked, met), [seed, unlocked, met]);
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <section className="rewardChest" aria-label="Cofre de recompensa">
      <h3>{picked === null ? "ELIGE UNA CARTA" : cards[picked].kind === "dust" ? "SOLO POLVO ESTELAR…" : "¡RECOMPENSA!"}</h3>
      <div>
        {cards.map((card, i) => {
          const open = picked !== null;
          return (
            <button key={i} type="button" disabled={open} data-kind={open ? card.kind : "hidden"} className={`chestCard ${open ? "open" : ""} ${picked === i ? "chosen" : ""}`} aria-label={open ? card.label : `Carta ${i + 1}`} style={{ animationDelay: `${i * 90}ms` }} onClick={() => { setPicked(i); onPick(card); }}>
              <span className="face front" aria-hidden="true">?</span>
              <span className="face back"><i>{card.icon}</i><b>{card.label}</b></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
