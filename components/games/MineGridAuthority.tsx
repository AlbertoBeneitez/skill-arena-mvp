"use client";
import { useEffect, useRef, useState } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { useHiddenAttempt } from "@/lib/verified/useHiddenAttempt";
import { mineAction } from "@/lib/verified/mineGridProtocol.v1";
import type { MinePublicViewV2 } from "@/lib/verified/mineGridProtocol.v2";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { t as tx, formatNumber, useI18n } from "@/lib/i18n";
export default function MineGridAuthority(props: GameRuntimeProps) {
  useI18n();
  const { session, phase, send } = useHiddenAttempt<MinePublicViewV2>({
      active: props.active,
      gameId: "mine-grid",
    }),
    [flagMode, setFlagMode] = useState(false),
    [dismissed, setDismissed] = useState(false),
    hold = useRef<{ timer: number; index: number; fired: boolean } | null>(null);
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
    setDismissed(false);
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
    // Won: carry on automatically. Lost: the board stays until the player continues.
    if (session.status === "won" && session.verified && !finished.current) {
      const timer = setTimeout(() => {
        finished.current = true;
        finish.current({
          won: session.status === "won",
          score: session.score,
          timeMs: 0,
          verified: true,
          height: session.view.reach,
          failureReason: session.failure,
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [session]);
  const finishNow = () => {
    if (!session || finished.current) return;
    finished.current = true;
    finish.current({
      won: session.status === "won",
      score: session.score,
      timeMs: 0,
      verified: true,
      height: session.view.reach,
      failureReason: session.failure,
    });
  };
  if (phase === "unavailable")
    return (
      <div className="hiddenMineEmpty">
        <h2>{tx("mine.unavailable")}</h2>
      </div>
    );
  if (phase === "error")
    return (
      <div className="hiddenMineEmpty" role="alert">
        <h2>{tx("mine.recoverError")}</h2>

      </div>
    );
  if (!session)
    return (
      <div className="hiddenMineEmpty" role="status">
        {tx("mine.preparing")}
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
          aria-label={tx("mine.field")}
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
              aria-label={value === null ? tx("mine.cellHidden", { n: index + 1 }) : value === -1 ? tx("mine.cellMine", { n: index + 1 }) : tx("mine.cellValue", { n: index + 1, v: value })}
              onPointerDown={() => {
                if (!view.started || busy || session.status !== "running" || value !== null) return;
                if (hold.current) window.clearTimeout(hold.current.timer);
                const h = { index, fired: false, timer: 0 };
                h.timer = window.setTimeout(() => {
                  h.fired = true;
                  haptic([6, 20, 6]);
                  void send(mineAction("FLAG", index));
                }, 380);
                hold.current = h;
              }}
              onPointerUp={() => hold.current && window.clearTimeout(hold.current.timer)}
              onPointerLeave={() => {
                if (hold.current && !hold.current.fired) window.clearTimeout(hold.current.timer);
              }}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => {
                if (hold.current?.fired && hold.current.index === index) {
                  hold.current = null;
                  return;
                }
                void send(mineAction(flagMode ? "FLAG" : "OPEN", index));
              }}
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
          {tx("mine.open")}
        </button>
        <button
          type="button"
          aria-pressed={flagMode}
          disabled={!view.started}
          onClick={() => setFlagMode(true)}
        >
          {tx("mine.flag")}
        </button>
      </div>
      {session.status === "failed" && !dismissed ? (
        <div className="mineAuthorityModes">
          <button type="button" aria-pressed="true" onClick={finishNow}>
            {tx("mine.seeResult")}
          </button>
        </div>
      ) : null}
      <p className="mineAuthorityDemo">{tx("mine.serverResult")}</p>
    </div>
  );
}
