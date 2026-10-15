"use client";
import { useEffect, useRef, useState } from "react";
import type { MatchMode } from "./games";
import type { GameResult } from "./types";
import { ensureAttemptSession } from "./verified/attemptTransport";
/** UI projections only; assignment, verification and resolution remain server-owned. */
export function usePublicMatchAvailability(
  enabled: boolean,
  visible: boolean,
  stake: number,
) {
  const [persistentTraining, setPersistentTraining] = useState<boolean | null>(
    null,
  );
  const [liveModes, setLiveModes] = useState<Record<string, MatchMode>>({});
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void ensureAttemptSession()
      .then((cap) => {
        if (!cancelled) setPersistentTraining(cap.durable);
      })
      .catch(() => {
        if (!cancelled) setPersistentTraining(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  useEffect(() => {
    if (!persistentTraining || !visible) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const r = await fetch(
            `/api/verified-match/availability?stake_minor=${Math.round(stake * 100)}`,
            { signal: controller.signal, cache: "no-store" },
          ),
          data = await r.json();
        if (r.ok && !controller.signal.aborted)
          setLiveModes(
            Object.fromEntries(
              data.games.map((g: { gameId: string; mode: MatchMode }) => [
                g.gameId,
                g.mode,
              ]),
            ),
          );
      } catch {
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [persistentTraining, visible, stake]);
  return { persistentTraining, liveModes };
}
export function usePendingMatchResolution(
  enabled: boolean,
  result: GameResult | null,
  onResolved: (result: GameResult) => void,
) {
  const resolveRef = useRef(onResolved);
  useEffect(() => {
    resolveRef.current = onResolved;
  }, [onResolved]);
  useEffect(() => {
    const match = result?.serverMatch;
    if (!enabled || !result || !match || match.status !== "waiting") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const r = await fetch(
            `/api/verified-match/attempt?attempt_id=${encodeURIComponent(match.attemptId)}`,
            { signal: controller.signal, cache: "no-store" },
          ),
          data = await r.json();
        if (
          r.ok &&
          data.match?.status === "resolved" &&
          !controller.signal.aborted
        ) {
          resolveRef.current({ ...result, serverMatch: data.match });
          return;
        }
      } catch {}
      if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, result]);
}
