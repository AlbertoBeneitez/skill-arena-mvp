"use client";
/*
 * v197 · Groups on the server (signed-in players, fictitious balance): create or join a group, create competitions,
 * find a rival group, enter, and see the money ranking of groups. Everything is decided by /api/groups; this screen only
 * collects choices and shows state. Playing the matches of a competition from here arrives in the next version.
 */
import { useCallback, useEffect, useState } from "react";
import { GAMES } from "@/lib/games";
import { formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import st from "./ServerGroups.module.css";

type Group = { id: string; name: string; code: string; ownerId: string; members: number };
type Comp = { id: string; mode: "group" | "versus-league" | "versus-tournament"; status: "open" | "running" | "finished" | "cancelled"; entryMinor: number; groupIds: string[]; players: number; potMinor: number; entered?: boolean };
type Overview = { groups: Group[]; competitions: Comp[]; open: Comp[]; ranking: { groupId: string; name: string; netMinor: number; competitions: number }[] };

const money = (minor: number) => formatMoney(minor / 100);

export default function ServerGroups({ accountId, onBalanceChanged }: { accountId: string; onBalanceChanged(): void }) {
  useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gameId, setGameId] = useState<string>(GAMES.find((g) => g.enabled)?.id ?? "");
  const [entry, setEntry] = useState(5);
  const [mode, setMode] = useState<Comp["mode"]>("group");
  const [groupId, setGroupId] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as Overview);
    } catch { setMessage(t("sg.error", { code: "LOAD" })); }
  }, []);
  useEffect(() => { void load(); }, [load, accountId]);

  async function act(body: Record<string, unknown>, done?: () => void) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) setMessage(t("sg.error", { code: d.error ?? String(r.status) }));
      else { done?.(); onBalanceChanged(); }
    } catch { setMessage(t("sg.error", { code: "NETWORK" })); }
    setBusy(false);
    await load();
  }

  const mine = data?.groups ?? [];
  const owned = mine.filter((g) => g.ownerId === accountId);
  const chosen = owned.find((g) => g.id === groupId) ?? owned[0];
  const newCompetition = () => {
    if (!chosen) return;
    const config = mode === "group"
      ? { format: "single", entryMinor: Math.round(entry * 100), gameIds: [gameId] }
      : { entryMinor: Math.round(entry * 100), gameIds: [gameId], rounds: 1 };
    void act({ action: "competition", mode, groupIds: [chosen.id], config });
  };
  const card = (k: Comp, mineList: boolean) => {
    const iOwn = k.groupIds.some((id) => owned.some((g) => g.id === id));
    return (
      <li key={k.id} className={st.item}>
        <div><strong>{t(`sg.mode.${k.mode}` as "sg.mode.group")}</strong><span>{t(`sg.status.${k.status}` as "sg.status.open")} · {t("sg.players", { n: k.players })} · {money(k.entryMinor)}</span></div>
        <div className={st.actions}>
          {mineList && k.status === "open" && !k.entered && <button type="button" disabled={busy} onClick={() => void act({ action: "enter", competitionId: k.id })}>{t("sg.enter", { n: money(k.entryMinor) })}</button>}
          {mineList && k.entered && k.status === "open" && <em>{t("sg.entered")}</em>}
          {mineList && k.status === "open" && iOwn && k.groupIds.length === (k.mode === "group" ? 1 : 2) && <button type="button" disabled={busy} onClick={() => void act({ action: "start", competitionId: k.id })}>{t("sg.start")}</button>}
          {mineList && (k.status === "open" || k.status === "running") && iOwn && <button type="button" className={st.quiet} disabled={busy} onClick={() => void act({ action: "cancel", competitionId: k.id })}>{t("sg.cancel")}</button>}
          {!mineList && chosen && !k.groupIds.includes(chosen.id) && <button type="button" disabled={busy} onClick={() => void act({ action: "accept", competitionId: k.id, groupId: chosen.id })}>{t("sg.accept", { group: chosen.name })}</button>}
        </div>
      </li>
    );
  };

  return (
    <section className={st.screen} aria-label={t("sg.title")}>
      {message && <p role="status" className={st.message}>{message}</p>}

      <div className={st.panel}>
        <h2>{t("sg.mine")}</h2>
        {mine.length === 0 && data && <p className={st.hint}>{t("sg.none")}</p>}
        <ul className={st.list}>
          {mine.map((g) => (
            <li key={g.id} className={st.item}>
              <div><strong>{g.name}</strong><span>{t("sg.code")} {g.code} · {t("sg.members", { n: g.members })}</span></div>
              <div className={st.actions}>
                {g.ownerId === accountId
                  ? <button type="button" className={st.quiet} disabled={busy} onClick={() => void act({ action: "close", groupId: g.id })}>{t("sg.close")}</button>
                  : <button type="button" className={st.quiet} disabled={busy} onClick={() => void act({ action: "leave", groupId: g.id })}>{t("sg.leave")}</button>}
              </div>
            </li>
          ))}
        </ul>
        <form className={st.row} onSubmit={(e) => { e.preventDefault(); void act({ action: "create", name }, () => setName("")); }}>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t("sg.name")} aria-label={t("sg.name")} />
          <button type="submit" disabled={busy || name.trim().length < 2}>{t("sg.create")}</button>
        </form>
        <form className={st.row} onSubmit={(e) => { e.preventDefault(); void act({ action: "join", code }, () => setCode("")); }}>
          <input value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("sg.code")} aria-label={t("sg.code")} autoCapitalize="characters" />
          <button type="submit" disabled={busy || code.trim().length < 4}>{t("sg.join")}</button>
        </form>
      </div>

      {chosen && (
        <div className={st.panel}>
          <h2>{t("sg.newComp")}</h2>
          <label>{t("sg.forGroup")}
            <select value={chosen.id} onChange={(e) => setGroupId(e.target.value)}>{owned.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          </label>
          <label>{t("sg.mode")}
            <select value={mode} onChange={(e) => setMode(e.target.value as Comp["mode"])}>
              <option value="group">{t("sg.mode.group")}</option>
              <option value="versus-league">{t("sg.mode.versus-league")}</option>
              <option value="versus-tournament">{t("sg.mode.versus-tournament")}</option>
            </select>
          </label>
          <label>{t("sg.game")}
            <select value={gameId} onChange={(e) => setGameId(e.target.value)}>{GAMES.filter((g) => g.enabled).map((g) => <option key={g.id} value={g.id}>{gameName(g)}</option>)}</select>
          </label>
          <label>{t("sg.entry")}
            <input type="number" inputMode="decimal" min={0} max={100} step={1} value={entry} onChange={(e) => setEntry(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
          </label>
          <button type="button" disabled={busy || !gameId} onClick={newCompetition}>{t("sg.createComp")}</button>
        </div>
      )}

      <div className={st.panel}>
        <h2>{t("sg.competitions")}</h2>
        {(data?.competitions.length ?? 0) === 0 ? <p className={st.hint}>{t("sg.noComps")}</p> : <ul className={st.list}>{data!.competitions.map((k) => card(k, true))}</ul>}
        {(data?.competitions ?? []).some((k) => k.status === "running") && <p className={st.hint}>{t("sg.playSoon")}</p>}
      </div>

      <div className={st.panel}>
        <h2>{t("sg.open")}</h2>
        {(data?.open.length ?? 0) === 0 ? <p className={st.hint}>{t("sg.noOpen")}</p> : <ul className={st.list}>{data!.open.filter((k) => !k.groupIds.some((id) => mine.some((g) => g.id === id))).map((k) => card(k, false))}</ul>}
      </div>

      <div className={st.panel}>
        <h2>{t("sg.ranking")}</h2>
        {(data?.ranking.length ?? 0) === 0 ? <p className={st.hint}>{t("sg.noRanking")}</p> : (
          <ol className={st.list}>
            {data!.ranking.map((r) => <li key={r.groupId} className={st.item}><div><strong>{r.name}</strong><span>{t("sg.competitionsPlayed", { n: r.competitions })}</span></div><b>{r.netMinor >= 0 ? "+" : ""}{money(r.netMinor)}</b></li>)}
          </ol>
        )}
      </div>
    </section>
  );
}

/** Two chips at the top of the group screen: the local group or the online groups (signed-in players only). */
export function GroupTabs({ value, onChange }: { value: "mine" | "online"; onChange(next: "mine" | "online"): void }) {
  useI18n();
  return (
    <div className={st.tabs} role="group" aria-label={t("sg.title")}>
      {(["mine", "online"] as const).map((key) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{t(key === "mine" ? "sg.tab.mine" : "sg.tab.online")}</button>
      ))}
    </div>
  );
}
