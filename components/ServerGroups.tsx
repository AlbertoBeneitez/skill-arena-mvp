"use client";
/*
 * v197 · Groups on the server (signed-in players, fictitious balance). v204: the same screen as the offline group
 * (GroupHub), fed by /api/groups, so Online and Offline look identical. Below it: an open competition of the group,
 * challenges between groups and the money ranking of groups, drawn with the same panels. Everything is decided by the
 * server; this screen only collects choices and shows state. Playing the matches from here arrives later.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import GroupHub from "./GroupHub";
import UiIcon from "./UiIcon";
import { GAMES, playableForMoney } from "@/lib/games";
import { portraitSrc } from "@/lib/avatars";
import type { ClosedGroup } from "@/lib/groupPlay";
import type { GroupCompetition, GroupConfig } from "@/lib/groupCompetition";
import { formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import hub from "./GroupHub.module.css";
import st from "./ServerGroups.module.css";

type Group = { id: string; name: string; code: string; ownerId: string; members: number };
type Member = { accountId: string; name: string; avatar: number; role: string };
type Comp = {
  id: string; mode: "group" | "versus-league" | "versus-tournament"; status: "open" | "running" | "finished" | "cancelled";
  entryMinor: number; groupIds: string[]; players: number; potMinor: number; entered?: boolean; state?: unknown;
};
type Overview = {
  groups: Group[]; competitions: Comp[]; open: Comp[];
  ranking: { groupId: string; name: string; netMinor: number; competitions: number }[];
  current: { group: Group; members: Member[] } | null;
};

const money = (minor: number) => formatMoney(minor / 100);
const face = (avatar: unknown) => portraitSrc(Math.max(1, Number(avatar) || 1), "-s");

type Props = { accountId: string; playerName: string; avatarSrc: string; balance: number; onBalanceChanged(): void };

export default function ServerGroups({ accountId, playerName, avatarSrc, balance, onBalanceChanged }: Props) {
  useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [vsMode, setVsMode] = useState<"versus-league" | "versus-tournament">("versus-league");
  const [vsGame, setVsGame] = useState<string>(GAMES.find((g) => g.enabled)?.id ?? "");
  const [vsEntry, setVsEntry] = useState(5);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as Overview);
    } catch { setMessage(t("sg.error", { code: "LOAD" })); }
  }, []);
  useEffect(() => { void load(); }, [load, accountId]);

  async function act(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (busy) return null;
    setBusy(true); setMessage("");
    let out: Record<string, unknown> | null = null;
    try {
      const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json()) as Record<string, unknown>;
      if (!r.ok) setMessage(t("sg.error", { code: String(d.error ?? r.status) }));
      else { out = d; onBalanceChanged(); }
    } catch { setMessage(t("sg.error", { code: "NETWORK" })); }
    setBusy(false);
    await load();
    return out;
  }

  const current = data?.current ?? null;
  const owner = current?.group.ownerId === accountId;
  const group: ClosedGroup | null = useMemo(() => current && {
    id: current.group.id, name: current.group.name, code: current.group.code, stake: 0,
    members: current.members.map((m) => ({ id: m.accountId, name: m.name, avatar: face(m.avatar), isYou: m.accountId === accountId, scoreFactor: 1 })),
  }, [current, accountId]);
  const mine = (data?.competitions ?? []).filter((k) => current && k.mode === "group" && k.groupIds.includes(current.group.id));
  const active = mine.find((k) => (k.status === "running" || k.status === "finished") && !dismissed.includes(k.id) && k.state);
  const waiting = mine.find((k) => k.status === "open");
  const competition: GroupCompetition | null = useMemo(() => {
    const state = active?.state as GroupCompetition | undefined;
    return state ? { ...state, players: state.players.map((p) => ({ ...p, avatar: face(p.avatar) })) } : null;
  }, [active]);

  function createCompetition(config: GroupConfig) {
    if (!current) return;
    void act({
      action: "competition", mode: "group", groupIds: [current.group.id],
      config: {
        format: config.format, entryMinor: config.entryMinor, gameIds: config.gameIds, split: Array.isArray(config.split) ? config.split : undefined,
        rounds: config.end.kind === "rounds" ? config.end.rounds : 1, ...(config.eliminatePerRound ? { eliminatePerRound: config.eliminatePerRound } : {}),
      },
    }).then((out) => {
      const id = (out?.competition as { id?: string } | undefined)?.id;
      if (id) void act({ action: "enter", competitionId: id });
    });
  }

  const top = (message || waiting) ? (
    <>
      {message && <p className={hub.hint} role="alert">{message}</p>}
      {waiting && (
        <div className={hub.panel}>
          <div className={hub.panelHead}>
            <h2>{t("sg.waitingComp")}</h2>
            <small>{t("sg.players", { n: waiting.players })}</small>
          </div>
          <p className={hub.hint}>{t("sg.waitingHint", { n: money(waiting.entryMinor) })}</p>
          {!waiting.entered && <button type="button" className={hub.primary} disabled={busy || waiting.entryMinor / 100 > balance} onClick={() => void act({ action: "enter", competitionId: waiting.id })}>{t("sg.enter", { n: money(waiting.entryMinor) })}</button>}
          {owner && <button type="button" className={hub.primary} disabled={busy || waiting.players < 2} onClick={() => void act({ action: "start", competitionId: waiting.id })}>{t("sg.start")}</button>}
          {owner && <button type="button" className={hub.secondary} disabled={busy} onClick={() => void act({ action: "cancel", competitionId: waiting.id })}>{t("sg.cancel")}</button>}
        </div>
      )}
    </>
  ) : null;

  const challenges = (data?.open ?? []).filter((k) => !k.groupIds.some((id) => (data?.groups ?? []).some((g) => g.id === id)));
  const bottom = (
    <>
      {current && owner && (
        <div className={hub.panel}>
          <h2 className={hub.formTitle}>{t("sg.challengeTitle")}</h2>
          <div className={st.seg} role="group" aria-label={t("sg.mode")}>
            <button type="button" aria-pressed={vsMode === "versus-league"} onClick={() => setVsMode("versus-league")}>{t("sg.vsLeague")}</button>
            <button type="button" aria-pressed={vsMode === "versus-tournament"} onClick={() => setVsMode("versus-tournament")}>{t("sg.vsTournament")}</button>
          </div>
          <label className={st.field}>{t("sg.game")}
            <select className={hub.codeInput} value={vsGame} onChange={(e) => setVsGame(e.target.value)}>
              {/* v205: with an entry, games that never take bets (Roulette and any like it) are not offered. */}
              {GAMES.filter((g) => g.enabled && (vsEntry === 0 || playableForMoney(g))).map((g) => <option key={g.id} value={g.id}>{gameName(g)}</option>)}
            </select>
          </label>
          <label className={st.field}>{t("sg.entry")}
            <input className={hub.codeInput} type="number" inputMode="numeric" min={0} max={100} step={1} value={vsEntry}
              onChange={(e) => setVsEntry(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
          </label>
          <button type="button" className={hub.primary} disabled={busy || !vsGame || (vsEntry > 0 && !playableForMoney(GAMES.find((g) => g.id === vsGame) ?? { playKind: "chance" }))}
            onClick={() => void act({ action: "competition", mode: vsMode, groupIds: [current.group.id], config: { entryMinor: vsEntry * 100, gameIds: [vsGame], rounds: 1 } })}>
            {t("sg.challengeCreate")}
          </button>
        </div>
      )}
      <div className={hub.panel}>
        <h2 className={hub.formTitle}>{t("sg.open")}</h2>
        {challenges.length === 0 ? <p className={hub.hint}>{t("sg.noOpen")}</p> : (
          <ul className={st.list}>
            {challenges.map((k) => (
              <li key={k.id}>
                <div><strong>{t(k.mode === "versus-tournament" ? "sg.mode.versus-tournament" : "sg.mode.versus-league")}</strong><span>{t("sg.players", { n: k.players })} · {money(k.entryMinor)}</span></div>
                {current && owner && <button type="button" className={hub.secondary} disabled={busy} onClick={() => void act({ action: "accept", competitionId: k.id, groupId: current.group.id })}>{t("sg.acceptShort")}</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={hub.panel}>
        <h2 className={hub.formTitle}>{t("sg.ranking")}</h2>
        {(data?.ranking.length ?? 0) === 0 ? <p className={hub.hint}>{t("sg.noRanking")}</p> : (
          <ol className={st.list}>
            {data!.ranking.map((r, i) => (
              <li key={r.groupId}>
                <b className={st.place}>{i + 1}</b>
                <div><strong>{r.name}</strong><span>{t("sg.competitionsPlayed", { n: r.competitions })}</span></div>
                <b>{r.netMinor >= 0 ? "+" : ""}{money(r.netMinor)}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );

  if (!data) return <p className={hub.note} role="status"><UiIcon name="group" size={16} /> {t("sg.loading")}</p>;
  return (
    <GroupHub
      group={group}
      competition={competition}
      balance={balance}
      playerName={playerName}
      avatarSrc={avatarSrc}
      allowPhoto={false}
      joinError={!group ? message : ""}
      onCreateGroup={(name) => void act({ action: "create", name })}
      onJoinGroup={(code) => void act({ action: "join", code })}
      onCreateCompetition={createCompetition}
      onPlay={() => setMessage(t("sg.playSoon"))}
      onVote={() => setMessage(t("sg.playSoon"))}
      onClearCompetition={() => active && setDismissed((d) => [...d, active.id])}
      onUpdateGroup={(patch) => { if (current && patch.name) void act({ action: "rename", groupId: current.group.id, name: patch.name }); }}
      onDeleteGroup={() => { if (current) void act({ action: owner ? "close" : "leave", groupId: current.group.id }); }}
      top={group ? top : null}
      bottom={group ? bottom : null}
    />
  );
}
