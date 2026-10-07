"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameId } from "@/lib/games";
import type {
  AttemptTicket,
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
  const sessionRef = useRef<Session | null>(null);
  const inputsRef = useRef<TInput[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const submissionRef = useRef(new SubmissionGate<VerifiedAttemptResult>());
  const closedRef = useRef(false);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    submissionRef.current.reset();
    closedRef.current = false;

    requestRef.current?.abort();
    requestRef.current = null;
    sessionRef.current = null;
    inputsRef.current = [];

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

        if (
          !response.ok ||
          !data.ok ||
          !data.manifest ||
          !data.ticket
        ) {
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
        if (
          generation !== generationRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        setState({
          status: "rejected",
          reason:
            error instanceof Error
              ? error.message
              : "MATCH_START_FAILED",
        });
      }
    })();

    return () => {
      generationRef.current += 1;
      submissionRef.current.reset();
      controller.abort();
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [active, gameId, stakeMinor, targetScore]);

  const recordInput = useCallback((input: Omit<TInput, "seq">) => {
    const session = sessionRef.current;
    if (!session || closedRef.current) return false;

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
  }, []);

  const verifyAttempt = useCallback((finalTick: number): Promise<VerifiedAttemptResult> => {
    const session = sessionRef.current;
    if (!session) {
      const result: VerifiedAttemptResult = {
        ok: false,
        verified: false,
        error: "INVALID_TICKET",
      };
      setState({ status: "rejected", reason: "INVALID_TICKET" });
      return Promise.resolve(result);
    }

    const generation = generationRef.current;
    closedRef.current = true;
    const inputs = inputsRef.current.map(input => ({ ...input }));
    const cancelled = (): VerifiedAttemptResult => ({ ok: false, verified: false, error: "VERIFICATION_ABORTED" });
    return submissionRef.current.run(session.ticket.attempt_id, async (signal) => {
      if (generation !== generationRef.current || signal.aborted) return cancelled();
      setState({ status: "verifying", ...session });

      try {
        const response = await fetch("/api/verified-match/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifest: session.manifest,
            ticket: session.ticket,
            inputs,
            final_tick: finalTick,
          }),
          signal,
        });

        const result = (await response.json()) as VerifiedAttemptResult;
        if (generation !== generationRef.current || signal.aborted) return cancelled();

        if (!response.ok || !result.ok || !result.verified) {
          setState({
            status: "rejected",
            reason: result.error ?? "REPLAY_MISMATCH",
            ...session,
          });
          return {
            ...result,
            ok: false,
            verified: false,
            error: result.error ?? "REPLAY_MISMATCH",
          };
        }

        setState({
          status: "verified",
          ...session,
          result,
        });
        return result;
      } catch (error) {
        if (generation !== generationRef.current || signal.aborted) return cancelled();
        const reason =
          error instanceof Error
              ? error.message
              : "VERIFIER_UNAVAILABLE";

        setState({ status: "rejected", reason, ...session });
        return {
          ok: false,
          verified: false,
          error: reason,
        } satisfies VerifiedAttemptResult;
      }
    }).catch(() => cancelled());
  }, []);

  return {
    state,
    manifest:
      state.status === "ready" ||
      state.status === "verifying" ||
      state.status === "verified"
        ? state.manifest
        : undefined,
    recordInput,
    verifyAttempt,
    inputCount: inputsRef.current.length,
  };
}
