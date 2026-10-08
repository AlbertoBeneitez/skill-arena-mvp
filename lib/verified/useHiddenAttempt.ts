"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HiddenPublicSession } from "./hiddenCommandContracts";
export function useHiddenAttempt<V>({
  active,
  gameId,
}: {
  active: boolean;
  gameId: string;
}) {
  const [session, setSession] = useState<HiddenPublicSession<V> | null>(null),
    [phase, setPhase] = useState<
      "idle" | "starting" | "ready" | "sending" | "unavailable" | "error"
    >("idle");
  const sessionRef = useRef<HiddenPublicSession<V> | null>(null),
    controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    busy = useRef(false);
  function valid(value: unknown): value is HiddenPublicSession<V> {
    if (!value || typeof value !== "object") return false;
    const v = value as HiddenPublicSession<V>;
    return (
      v.gameId === gameId &&
      typeof v.attemptId === "string" &&
      Number.isSafeInteger(v.revision) &&
      typeof v.score === "number" &&
      v.view !== null &&
      typeof v.view === "object" &&
      ["running", "won", "failed"].includes(v.status) &&
      !("seed" in value) &&
      !("manifest" in value)
    );
  }
  useEffect(() => {
    const epoch = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    sessionRef.current = null;
    setSession(null);
    busy.current = false;
    if (!active) {
      setPhase("idle");
      return;
    }
    setPhase("starting");
    void (async () => {
      try {
        const response = await fetch("/api/hidden-game/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId }),
            signal: request.signal,
            cache: "no-store",
          }),
          value = await response.json();
        if (epoch !== generation.current || request.signal.aborted) return;
        if (value.status === "not-configured") {
          setPhase("unavailable");
          return;
        }
        if (!response.ok || !valid(value)) throw new Error("INVALID_SESSION");
        sessionRef.current = value;
        setSession(value);
        setPhase("ready");
      } catch {
        if (epoch === generation.current && !request.signal.aborted)
          setPhase("error");
      }
    })();
    return () => {
      generation.current++;
      request.abort();
      controller.current?.abort();
      busy.current = false;
    };
  }, [active, gameId]);
  const send = useCallback(
    async (action: string) => {
      const before = sessionRef.current;
      if (!active || !before || before.status !== "running" || busy.current)
        return;
      busy.current = true;
      setPhase("sending");
      const epoch = generation.current,
        request = new AbortController();
      controller.current = request;
      const payload = {
        attemptId: before.attemptId,
        commandId: crypto.randomUUID(),
        expectedRevision: before.revision,
        action,
      };
      try {
        const response = await fetch("/api/hidden-game/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: request.signal,
            cache: "no-store",
          }),
          value = await response.json();
        if (epoch !== generation.current || request.signal.aborted) return;
        if (!response.ok || !valid(value)) {
          // Recover authoritative state after a lost acknowledgement/conflict.
          const resync = await fetch(
              `/api/hidden-game/session?attemptId=${encodeURIComponent(before.attemptId)}`,
              { signal: request.signal, cache: "no-store" },
            ),
            recovered = await resync.json();
          if (epoch !== generation.current || request.signal.aborted) return;
          if (!resync.ok || !valid(recovered))
            throw new Error("RECOVERY_FAILED");
          sessionRef.current = recovered;
          setSession(recovered);
        } else {
          sessionRef.current = value;
          setSession(value);
        }
        setPhase("ready");
      } catch {
        if (epoch === generation.current && !request.signal.aborted) {
          try {
            const response = await fetch(
                `/api/hidden-game/session?attemptId=${encodeURIComponent(before.attemptId)}`,
                { signal: request.signal, cache: "no-store" },
              ),
              value = await response.json();
            if (epoch !== generation.current || request.signal.aborted) return;
            if (!response.ok || !valid(value)) throw new Error();
            sessionRef.current = value;
            setSession(value);
            setPhase("ready");
          } catch {
            if (epoch === generation.current && !request.signal.aborted)
              setPhase("error");
          }
        }
      } finally {
        if (epoch === generation.current) busy.current = false;
      }
    },
    [active, gameId],
  );
  return { session, phase, send };
}
