"use client";
/*
 * v211 · "Juego grupal" in the Groups tab (online groups). The group builds ONE Stack tower: each turn continues the
 * tower of the turn before. Only one member plays at a time: whoever starts later is told at once who is playing and
 * since when; a late or out-of-time turn does not count and its player is told why. Everything is decided by the
 * server (/api/groups/relay); this panel shows the state and starts turns.
 */
import { useCallback, useEffect, useState } from "react";
import { STACK_RELAY_RULES_V1 } from "@/lib/verified/stackRelay.v1";
import { t, useI18n, type MessageKey } from "@/lib/i18n";
import StackRelayPlay, { type RelayTurn, type RelayTurnOutcome } from "./games/StackRelayPlay";
import hub from "./GroupHub.module.css";
import st from "./ServerGroups.module.css";

export type RelayView = {
  relayId: string; status: "open" | "finished" | "cancelled"; blocksPerTurn: number; height: number; score: number; turns: number;
  failure: string | null; createdByMe: boolean;
  lock: { name: string | null; mine: boolean; since: string; until: string } | null;
  players: { accountId: string; name: string; blocks: number; turns: number }[];
  recent: { turnNo: number; accountId: string; name: string; placed: number; ended: boolean; at: string }[];
  myRefusal: { reason: string; holder: string | null; at: string } | null;
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Why a turn did not count, in words (the one who came later is told who and since when). */
export function refusalText(code: string, holder: string | null | undefined, since?: string | null): string {
  const key: MessageKey = code === "RELAY_BUSY" ? "relay.busy" : code === "TURN_TAKEN" ? (holder ? "relay.taken" : "relay.moved")
    : code === "LEASE_EXPIRED" ? "relay.late" : code === "TOO_FAST" ? "relay.tooFast" : code.startsWith("INVALID_TURN") ? "relay.invalid"
    : code === "RELAY_CLOSED" ? "relay.closed" : "relay.error";
  return t(key, { name: holder ?? "", time: since ? hhmmss(since) : "", code });
}

export default function GroupRelay({ groupId, accountId, relay, reload }: { groupId: string; accountId: string; relay: RelayView | null; reload(): Promise<void> | void }) {
  useI18n();
  const [blocks, setBlocks] = useState<number>(STACK_RELAY_RULES_V1.defaultBlocksPerTurn);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [turn, setTurn] = useState<RelayTurn | null>(null);

  // While the panel is on screen, follow the turn (who holds it, when it frees up).
  useEffect(() => {
    if (!relay || relay.status !== "open" || turn) return;
    const id = setInterval(() => void reload(), 8_000);
    return () => clearInterval(id);
  }, [relay, turn, reload]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/groups/relay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  }, []);

  async function create() {
    if (busy) return;
    setBusy(true); setNote("");
    try {
      const { ok, data } = await post({ action: "create", groupId, blocksPerTurn: blocks });
      if (!ok) setNote(refusalText(String(data.error), null));
      else setOpen(false);
    } catch { setNote(t("relay.error", { code: "NETWORK" })); }
    setBusy(false);
    await reload();
  }
  async function start() {
    if (busy || !relay) return;
    setBusy(true); setNote("");
    try {
      const { ok, data } = await post({ action: "start", relayId: relay.relayId });
      if (ok) setTurn(data as unknown as RelayTurn);
      else { setNote(refusalText(String(data.error), data.holder as string | null, data.since as string | null)); await reload(); }
    } catch { setNote(t("relay.error", { code: "NETWORK" })); }
    setBusy(false);
  }
  async function cancel() {
    if (busy || !relay) return;
    setBusy(true);
    try { await post({ action: "cancel", relayId: relay.relayId }); } catch { /* shown by reload */ }
    setBusy(false);
    await reload();
  }
  function finished(outcome: RelayTurnOutcome) {
    setTurn(null);
    if (outcome.kind === "accepted") setNote(outcome.ended ? t("relay.youEnded", { h: outcome.height }) : t("relay.placed", { n: outcome.placed, h: outcome.height }));
    else if (outcome.kind === "refused") setNote(refusalText(outcome.error, outcome.holder));
    else setNote("");
    void reload();
  }

  if (turn) return <StackRelayPlay turn={turn} onDone={finished} />;

  const inPlay = relay?.status === "open" ? relay : null;
  const lastMine = inPlay?.recent[0]?.accountId === accountId;
  return (
    <div className={hub.panel}>
      <h2 className={hub.formTitle}>{t("relay.title")}</h2>
      {inPlay ? (
        <>
          <p className={st.relayTower}><strong>{t("relay.height", { n: inPlay.height })}</strong><span>{t("relay.turns", { n: inPlay.turns, b: inPlay.blocksPerTurn })}</span></p>
          {inPlay.lock && !inPlay.lock.mine ? (
            <p className={hub.hint} role="status">{t("relay.playing", { name: inPlay.lock.name ?? "", time: hhmm(inPlay.lock.since) })}</p>
          ) : (
            <button type="button" className={hub.primary} disabled={busy} onClick={() => void start()}>
              {inPlay.lock?.mine ? t("relay.resume") : t("relay.play", { n: inPlay.blocksPerTurn })}
            </button>
          )}
          {!inPlay.lock && lastMine && <p className={hub.hint}>{t("relay.lastWasYou")}</p>}
          {inPlay.createdByMe && <button type="button" className={hub.secondary} disabled={busy} onClick={() => void cancel()}>{t("relay.cancel")}</button>}
        </>
      ) : (
        <>
          {relay && relay.status === "finished" && <p className={st.relayTower}><strong>{t("relay.final", { n: relay.height })}</strong><span>{t("relay.turnsOnly", { n: relay.turns })}</span></p>}
          {!open ? (
            <button type="button" className={hub.primary} onClick={() => setOpen(true)}>{t("relay.button")}</button>
          ) : (
            <>
              <p className={hub.hint}>{t("relay.lead")}</p>
              <div className={st.seg} role="group" aria-label={t("relay.blocksPerTurn")}>
                {STACK_RELAY_RULES_V1.blocksPerTurnOptions.map((n) => (
                  <button key={n} type="button" aria-pressed={blocks === n} onClick={() => setBlocks(n)}>{t("relay.blocksN", { n })}</button>
                ))}
              </div>
              <button type="button" className={hub.primary} disabled={busy} onClick={() => void create()}>{t("relay.create")}</button>
            </>
          )}
        </>
      )}
      {note && <p className={hub.hint} role="status">{note}</p>}
      {!note && relay?.myRefusal && <p className={hub.hint} role="status">{refusalText(relay.myRefusal.reason, relay.myRefusal.holder)}</p>}
      {relay && relay.players.length > 0 && (
        <ol className={st.relayPlayers} aria-label={t("relay.points")}>
          {relay.players.map((p) => (
            <li key={p.accountId}><span>{p.accountId === accountId ? t("relay.you", { name: p.name }) : p.name}</span><b>{p.blocks}</b></li>
          ))}
        </ol>
      )}
    </div>
  );
}
