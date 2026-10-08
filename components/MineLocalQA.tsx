"use client";
import { useState } from "react";
import MineGridAuthority from "./games/MineGridAuthority";
import type { GameResult } from "@/lib/types";
export default function MineLocalQA() {
  const [instance, setInstance] = useState(0),
    [result, setResult] = useState<GameResult | null>(null);
  return (
    <main className="mineAuthorityQA">
      <header>
        <strong>GALACTIC GAMES</strong>
        <span>QA LOCAL · MINE GRID</span>
      </header>
      <MineGridAuthority
        key={instance}
        active={!result}
        stake={0}
        targetScore={1e9}
        ghostEnabled={false}
        seed="unused-server-only"
        onFinish={setResult}
      />
      {result && (
        <section className="mineAuthorityQAResult" role="status">
          <h2>{result.won ? "CAMPO RESUELTO" : "ESCUDOS AGOTADOS"}</h2>
          <p>{result.score} · VERIFICADO POR SERVIDOR</p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setInstance((i) => i + 1);
            }}
          >
            OTRO CAMPO
          </button>
        </section>
      )}
    </main>
  );
}
