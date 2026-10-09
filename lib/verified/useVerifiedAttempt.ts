"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameId } from "@/lib/games";
import type {
  AttemptTicket,
  AttemptRecordResponse,
  MatchManifest,
  VerifiedAttemptResult,
} from "./contracts";
import type { ReplayInput } from "./inputValidation";
import { SubmissionGate } from "./submissionGate";

type AttemptState =
  | { status: "idle" }
  | { status: "starting" }
  | {
      status: "ready";
      manifest: MatchManifest;
      ticket: AttemptTicket;
    }
  | {
      status: "verifying";
      manifest: MatchManifest;
      ticket: AttemptTicket;
    }
  | {
      status: "verified";
      manifest: MatchManifest;
      ticket: AttemptTicket;
      result: VerifiedAttemptResult;
    }
  | {
      status: "rejected";
      reason: string;
      manifest?: MatchManifest;
      ticket?: AttemptTicket;
    };

type Options = {
  active: boolean;
  gameId: GameId;
  stakeMinor: number;
  targetScore: number;
};

type Session = {
  manifest: MatchManifest;
  ticket: AttemptTicket;
};

export function useVerifiedAttempt<TInput extends ReplayInput>({
  active,
  gameId,
  stakeMinor,
  targetScore,
}: Options) {
  const [state, setState] = useState<AttemptState>({ status: "idle" });
  const [resumeToken, setResumeToken] = useState(0);
  const optionsKey = JSON.stringify([
    active,
    gameId,
    stakeMinor,
    targetScore,
    resumeToken,
  ]);
  const [stateKey, setStateKey] = useState(optionsKey);
  const currentState: AttemptState =
    stateKey === optionsKey ? state : { status: "idle" };
  const sessionRef = useRef<Session | null>(null);
  const inputsRef = useRef<TInput[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const submissionRef = useRef(new SubmissionGate<VerifiedAttemptResult>());
  const closedRef = useRef(false);
  const checkpointRef = useRef<{ tick: number; terminal: boolean } | null>(
    null,
  );

  // One transport/gate for terminal replays and abandoned prefixes. Both freeze
  // their body before yielding; only terminal verification may publish a result.
  const commitRecord = useCallback(
    (finalTick: number, abandoned: boolean): Promise<VerifiedAttemptResult> => {
      const session = sessionRef.current;
      if (!session)
        return Promise.resolve({
          ok: false,
          verified: false,
          error: "INVALID_TICKET",
        });
      const generation = generationRef.current;
      closedRef.current = true;
      const body = JSON.stringify({
        manifest: session.manifest,
        ticket: session.ticket,
        inputs: inputsRef.current.map((input) => ({ ...input })),
        final_tick: finalTick,
        ...(abandoned ? { record_kind: "abandoned" } : {}),
      });
      const cancelled = (): VerifiedAttemptResult => ({
        ok: false,
        verified: false,
        error: "VERIFICATION_ABORTED",
      });
      return submissionRef.current
        .run(session.ticket.attempt_id, async (signal) => {
          if (signal.aborted) return cancelled();
          if (!abandoned && generation === generationRef.current)
            setState({ status: "verifying", ...session });
          try {
            const response = await fetch("/api/verified-match/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              signal,
              // Browser keepalive has a bounded aggregate quota. Larger histories
              // use normal transport; durable delivery remains a separate concern.
              keepalive: new TextEncoder().encode(body).byteLength <= 60_000,
            });
            const result = (await response.json()) as AttemptRecordResponse;
            if (generation !== generationRef.current || signal.aborted)
              return cancelled();
            // An abandonment receipt is never a competitive result or a UI failure.
            if (abandoned)
              return { ok: response.ok && result.ok, verified: false };
            if (!response.ok || !result.ok || !result.verified) {
              const reason =
                "error" in result
                  ? (result.error ?? "REPLAY_MISMATCH")
                  : "REPLAY_MISMATCH";
              setState({ status: "rejected", reason, ...session });
              return { ok: false, verified: false, error: reason };
            }
            setState({ status: "verified", ...session, result });
            return result;
          } catch (error) {
            if (generation !== generationRef.current || signal.aborted)
              return cancelled();
            const reason =
              error instanceof Error ? error.message : "VERIFIER_UNAVAILABLE";
            if (!abandoned)
              setState({ status: "rejected", reason, ...session });
            return { ok: false, verified: false, error: reason };
          }
        })
        .catch(() => cancelled());
    },
    [],
  );

  const commitCheckpoint = useCallback(() => {
    const checkpoint = checkpointRef.current;
    if (!closedRef.current && sessionRef.current && checkpoint)
      void commitRecord(checkpoint.tick, !checkpoint.terminal);
  }, [commitRecord]);

  const recordCheckpoint = useCallback(
    (
      tick: number,
      status: "running" | "won" | "failed",
      attemptId: string | undefined,
    ) => {
      if (
        !sessionRef.current ||
        sessionRef.current.ticket.attempt_id !== attemptId ||
        closedRef.current ||
        !Number.isInteger(tick) ||
        tick < 0
      )
        return;
      if (checkpointRef.current && tick < checkpointRef.current.tick) return;
      checkpointRef.current = { tick, terminal: status !== "running" };
      // Inputs may resolve the core before the next RAF. Commit before any
      // sound/render callback, and let the terminal frame reuse this same flight.
      if (status !== "running") void commitRecord(tick, false);
    },
    [commitRecord],
  );

  const verifyAttempt = useCallback(
    (finalTick: number) => commitRecord(finalTick, false),
    [commitRecord],
  );

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setStateKey(optionsKey);
    submissionRef.current.reset();
    closedRef.current = false;

    requestRef.current?.abort();
    requestRef.current = null;
    sessionRef.current = null;
    inputsRef.current = [];
    checkpointRef.current = null;

    if (!active) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "starting" });

    void (async () => {
      try {
        const response = await fetch("/api/verified-match/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: gameId,
            stake_minor: stakeMinor,
            target_score: targetScore,
          }),
          signal: controller.signal,
        });

        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          manifest?: MatchManifest;
          ticket?: AttemptTicket;
        };

        if (generation !== generationRef.current || controller.signal.aborted) {
          return;
        }

        if (!response.ok || !data.ok || !data.manifest || !data.ticket) {
          setState({
            status: "rejected",
            reason: data.error ?? "MATCH_START_REJECTED",
          });
          return;
        }

        const session = {
          manifest: data.manifest,
          ticket: data.ticket,
        };
        sessionRef.current = session;
        inputsRef.current = [];
        setState({ status: "ready", ...session });
      } catch (error) {
        if (generation !== generationRef.current || controller.signal.aborted) {
          return;
        }

        setState({
          status: "rejected",
          reason: error instanceof Error ? error.message : "MATCH_START_FAILED",
        });
      }
    })();

    const pagehide = () => {
      commitCheckpoint();
      generationRef.current += 1;
      submissionRef.current.detach();
      controller.abort();
    };
    const pageshow = (event: PageTransitionEvent) => {
      // BFCache restores the component too. A committed record cannot resume:
      // request a fresh attempt instead of appending inputs to its old snapshot.
      if (event.persisted) setResumeToken((token) => token + 1);
    };
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);

    return () => {
      // Capture the last actually simulated tick before dropping this session.
      // A terminal detected by an input/sync before RAF takes the terminal path.
      // A request already committed wins; cleanup cannot submit a second record.
      commitCheckpoint();
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      generationRef.current += 1;
      submissionRef.current.detach();
      controller.abort();
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [active, gameId, stakeMinor, targetScore, optionsKey, commitCheckpoint]);

  const recordInput = useCallback(
    (input: Omit<TInput, "seq">, attemptId?: string) => {
      const session = sessionRef.current;
      if (
        !session ||
        closedRef.current ||
        (attemptId !== undefined && session.ticket.attempt_id !== attemptId)
      )
        return false;

      const previous = inputsRef.current[inputsRef.current.length - 1];
      const tick = (input as { tick?: unknown }).tick;
      const action = (input as { action?: unknown }).action;

      if (
        !Number.isInteger(tick) ||
        (tick as number) < 0 ||
        typeof action !== "string" ||
        inputsRef.current.length >=
          session.manifest.input_protocol.max_inputs ||
        (previous && (tick as number) <= previous.tick) ||
        !session.manifest.input_protocol.allowed_actions.includes(action)
      ) {
        return false;
      }

      const next = {
        ...input,
        seq: inputsRef.current.length,
      } as TInput;

      inputsRef.current.push(next);
      return true;
    },
    [],
  );

  return {
    state: currentState,
    manifest:
      currentState.status === "ready" ||
      currentState.status === "verifying" ||
      currentState.status === "verified"
        ? currentState.manifest
        : undefined,
    recordInput,
    recordCheckpoint,
    verifyAttempt,
    inputCount: inputsRef.current.length,
  };
}
