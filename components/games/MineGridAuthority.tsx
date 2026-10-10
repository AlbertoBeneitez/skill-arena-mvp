"use client";
import { useEffect, useRef, useState } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { useHiddenAttempt } from "@/lib/verified/useHiddenAttempt";
import { mineAction } from "@/lib/verified/mineGridProtocol.v1";
import type { MinePublicViewV2 } from "@/lib/verified/mineGridProtocol.v2";
import { gameTone, haptic } from "@/lib/gameFeedback";
export default function MineGridAuthority(props: GameRuntimeProps) {
  const { session, phase, send } = useHiddenAttempt<MinePublicViewV2>({
      active: props.active,
      gameId: "mine-grid",
    }),
    [flagMode, setFlagMode] = useState(false);
  const finish = useRef(props.onFinish),
    finished = useRef(false),
    last = useRef<{ revision: number; score: number } | null>(null);
  useEffect(() => {
    finish.current = props.onFinish;
  }, [props.onFinish]);
  useEffect(() => {
    finished.current = false;
    last.current = null;
    setFlagMode(false);
  }, [props.active]);
  useEffect(() => {
    if (!session) return;
    const previous = last.current;
    last.current = {
      revision: session.revision,
      score: session.score,
    };
    if (previous && session.revision > previous.revision) {
      gameTone(
        session.view.event === "BOMB"
          ? "bad"
          : session.score > previous.score
            ? "good"
            : "tap",
      );
      haptic(session.view.event === "BOMB" ? [12, 12, 18] : 3);
    }
    if (session.status !== "running" && session.verified && !finished.current) {
      const timer = setTimeout(() => {
        finished.current = true;
        finish.current({
          won: session.status === "won",
          score: session.score,
          timeMs: 0,
          verified: true,
          failureReason: session.failure,
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [session]);
  if (phase === "unavailable")
    return (
      <div className="hiddenMineEmpty">
        <h2>Mine Grid está en preparación</h2>
        <p>
          El nuevo campo necesita la conexión de servidor para mantener las
          minas ocultas. No se sustituirá por resultados del cliente.
        </p>
      </div>
    );
  if (phase === "error")
    return (
      <div className="hiddenMineEmpty" role="alert">
        <h2>No se puede recuperar el campo</h2>
        <p>Sal y vuelve a entrar para iniciar otro intento.</p>
      </div>
    );
  if (!session)
    return (
      <div className="hiddenMineEmpty" role="status">
        Preparando el campo orbital…
      </div>
    );
  const view = session.view,
    busy = phase === "sending";
  return (
    <div className="mineAuthoritySurface">
      <div className="mineAuthorityHud">
        <strong>{view.reach} CASILLAS</strong>
        <span>ESCUDOS {view.lives}</span>
      </div>
      <div className="mineAuthorityBoardViewport">
        <div
          className="mineAuthorityBoard"
          style={{
            minWidth: view.cols * 44 + (view.cols - 1) * 4,
            gridTemplateColumns: `repeat(${view.cols},1fr)`,
          }}
          aria-label="Campo orbital"
          aria-busy={busy}
        >
          {view.cells.map((value, index) => (
            <button
              key={index}
              type="button"
              data-index={index}
              data-clue={value}
              className={`mineAuthorityCell ${value !== null ? "open" : ""} ${value === -1 ? "bomb" : ""} ${view.flagged[index] ? "flagged" : ""} ${!view.started && index === view.startIndex ? "opening" : ""}`}
              disabled={
                busy ||
                session.status !== "running" ||
                value !== null ||
                (!view.started && index !== view.startIndex) ||
                (!flagMode && view.flagged[index])
              }
              aria-label={`Casilla ${index + 1}${value === null ? " oculta" : value === -1 ? " mina" : `, ${value} minas cercanas`}`}
              onClick={() =>
                void send(mineAction(flagMode ? "FLAG" : "OPEN", index))
              }
            >
              {value === -1
                ? "✦"
                : view.flagged[index]
                  ? "⚑"
                  : value !== null
                    ? value || ""
                    : !view.started && index === view.startIndex
                      ? "●"
                      : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="mineAuthorityModes">
        <button
          type="button"
          aria-pressed={!flagMode}
          onClick={() => setFlagMode(false)}
        >
          ABRIR
        </button>
        <button
          type="button"
          aria-pressed={flagMode}
          disabled={!view.started}
          onClick={() => setFlagMode(true)}
        >
          MARCAR
        </button>
      </div>
      <p className="mineAuthorityDemo">ENTRENAMIENTO · RESULTADO DE SERVIDOR</p>
    </div>
  );
}
