"use client";
/*
 * Groups (v128): create or join a local group, set up a competition in one short form and play it through.
 * The rules — rounds, duels, eliminations, votes and the pot — live in lib/groupCompetition.ts (pure); this screen
 * only collects the choices and shows the state. Members other than you are simulated (sample data).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClosedGroup } from "@/lib/groupPlay";
import { GROUP_COMMISSION_BPS, groupMoney, groupStandings, nextGroupMatch, type GroupCompetition, type GroupConfig, type GroupFormat, type GroupSplit } from "@/lib/groupCompetition";
import { createRng } from "@/lib/deterministic/seeded";
import { GAMES, type GameMeta } from "@/lib/games";
import { formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";

type Props = {
  group: ClosedGroup | null;
  competition: GroupCompetition | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  initialJoinCode?: string;
  onCreateGroup: (name: string, stake: number) => void;
  onJoinGroup: (code: string) => void;
  onCreateCompetition: (config: GroupConfig) => void;
  onPlay: () => void;
  onVote: () => void;
  onClearCompetition: () => void;
};
type Kind = "single" | "league" | "tournament";
const MIXED = "mixed";

function normalizeJoinCode(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const code = new URL(trimmed).searchParams.get("join");
      if (code) return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    } catch {
      // Fall through to plain-code normalization.
    }
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
const euros = (minor: number) => formatMoney(minor / 100);

export default function GroupHub({ group, competition, balance, playerName, avatarSrc, initialJoinCode = "", onCreateGroup, onJoinGroup, onCreateCompetition, onPlay, onVote, onClearCompetition }: Props) {
  useI18n();
  const [entryMode, setEntryMode] = useState<"create" | "join">(initialJoinCode ? "join" : "create");
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const mountedRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [kind, setKind] = useState<Kind>("league");
  const [duels, setDuels] = useState(false);
  const [gameId, setGameId] = useState<string>(MIXED);
  const [entry, setEntry] = useState("5");
  const [byVote, setByVote] = useState(false);
  const [rounds, setRounds] = useState(5);
  const [split, setSplit] = useState<GroupSplit>("winner");
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current); };
  }, []);
  useEffect(() => {
    if (!initialJoinCode || group) return;
    setEntryMode("join");
    setJoinCode(normalizeJoinCode(initialJoinCode));
  }, [group, initialJoinCode]);
  const playable = useMemo(() => GAMES.filter((game) => game.enabled), []);

  async function copyShare(value: string, which: "code" | "link") {
    setShareError(""); setShareFallback(""); setCopiedCode(false); setCopiedLink(false);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      if (!mountedRef.current) return;
      setCopiedCode(which === "code"); setCopiedLink(which === "link");
      copyTimerRef.current = setTimeout(() => { setCopiedCode(false); setCopiedLink(false); copyTimerRef.current = null; }, 2000);
    } catch {
      if (!mountedRef.current) return;
      setShareError(t("group.copyFailed")); setShareFallback(value);
    }
  }
  function copyCode() { if (group) void copyShare(group.code, "code"); }
  function copyInviteLink() {
    if (!group) return;
    const url = new URL(window.location.href);
    url.search = ""; url.searchParams.set("join", group.code); url.hash = "group";
    void copyShare(url.toString(), "link");
  }
  function submitJoin() {
    const code = normalizeJoinCode(joinCode);
    if (code.length < 4) return;
    setJoinCode(code); onJoinGroup(code);
  }

  if (!group) {
    return (
      <section className="groupScreen">
        <div className="groupHero">
          <span>{t("group.heroTag")}</span>
          <h1>{t("group.heroTitle")}</h1>
          <p className="groupHeroLead">{t("group.heroLead")}</p>
          <ol className="groupHowTo">
            <li><b>1</b><span>{t("group.step1")}</span></li>
            <li><b>2</b><span>{t("group.step2")}</span></li>
            <li><b>3</b><span>{t("group.step3")}</span></li>
          </ol>
        </div>

        <div className="groupEntryCards" role="tablist" aria-label={t("group.entryTabs")}>
          <button type="button" role="tab" aria-selected={entryMode === "create"} className={entryMode === "create" ? "active" : ""} onClick={() => setEntryMode("create")}>
            <span aria-hidden="true">＋</span>
            <strong>{t("group.create")}</strong>
            <small>{t("group.createSub")}</small>
          </button>
          <button type="button" role="tab" aria-selected={entryMode === "join"} className={entryMode === "join" ? "active" : ""} onClick={() => setEntryMode("join")}>
            <span aria-hidden="true">⇢</span>
            <strong>{t("group.join")}</strong>
            <small>{t("group.joinSub")}</small>
          </button>
        </div>

        {entryMode === "create" ? (
          <div className="groupSetupCard">
            <div className="groupSetupPreview">
              <img src={avatarSrc} alt="" />
              <div>
                <small>{t("group.creator")}</small>
                <strong>{playerName || t("common.you")}</strong>
              </div>
              <b>{t("common.local")}</b>
            </div>

            <button
              className="groupPrimaryAction"
              type="button"
              onClick={() =>
                onCreateGroup(playerName ? t("group.defaultName", { name: playerName }) : t("group.myGroup"), 0)
              }
            >
              {t("group.createButton")}
            </button>
            <p className="groupNextHint">{t("group.createHint")}</p>
          </div>
        ) : (
          <div className="groupSetupCard groupJoinCard">
            <p className="groupStepTitle"><b>{t("group.joinStep")}</b> {t("group.joinStepText")}</p>
            <label>
              <span>{t("group.codeLabel")}</span>
              <input
                value={joinCode}
                maxLength={12}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) =>
                  setJoinCode(
                    normalizeJoinCode(event.target.value)
                  )
                }
                onPaste={(event) => {
                  const pasted =
                    event.clipboardData.getData("text");
                  const normalized =
                    normalizeJoinCode(pasted);

                  if (normalized) {
                    event.preventDefault();
                    setJoinCode(normalized);
                  }
                }}
                placeholder={t("group.codePlaceholder")}
                dir="ltr"
              />
            </label>

            <p className="groupJoinHint">
              {t("group.joinHint")}
            </p>

            <button
              className="groupPrimaryAction"
              type="button"
              disabled={joinCode.length < 4}
              onClick={submitJoin}
            >
              {t("group.open")}
            </button>
          </div>
        )}
      </section>
    );
  }

  const entryMinor = Math.max(0, Math.round(Number(entry.replace(",", ".")) * 100) || 0);
  const format: GroupFormat = kind === "league" ? (duels ? "league-duels" : "league-rounds") : kind;
  const players = group.members.length;
  const effectiveSplit: GroupSplit = players < 3 ? "winner" : split;
  const money = groupMoney({ config: { entryMinor } as GroupConfig, players: group.members });
  const affordable = entryMinor <= Math.round(balance * 100);
  function buildConfig(): GroupConfig {
    const ids = gameId !== MIXED ? [gameId] : (() => {
      const rng = createRng(`${group!.code}:${format}:games`), pool = playable.map((g) => g.id);
      return Array.from({ length: 12 }, () => pool[rng.nextInt(pool.length)]);
    })();
    return {
      format, entryMinor, split: effectiveSplit, gameIds: ids,
      lowerWinsGameIds: playable.filter((g) => g.resultMetric === "reaction-time-ms").map((g) => g.id),
      end: kind === "league" && byVote ? { kind: "vote" } : { kind: "rounds", rounds: kind === "league" ? rounds : 1 },
    };
  }
  const header = (
    <div className="groupHeaderCard groupHeaderSinglePage">
      <div>
        <small>{t("group.local")}</small>
        <h1>{group.name}</h1>
      </div>
      <span className="groupCodeBadge">{group.code}</span>
    </div>
  );

  if (competition) {
    const you = group.members.find((m) => m.isYou)?.id ?? "you";
    const standings = groupStandings(competition), next = nextGroupMatch(competition, you);
    const match = next >= 0 ? competition.matches[next] : null;
    const round = competition.matches.reduce((r, m) => Math.max(r, m.round), 0);
    const nameOf = (id: string) => competition.players.find((p) => p.id === id)?.name ?? id;
    const opponent = match && competition.config.format === "league-duels" ? match.players.find((p) => p !== you) : undefined;
    const game = match ? playable.find((g) => g.id === match.gameId) : undefined;
    const voting = competition.config.end.kind === "vote" && !competition.finished;
    const voted = competition.votes.includes(you);
    const tournament = competition.config.format === "tournament";
    return (
      <section className="groupScreen">
        {header}
        <div className="groupCompCard">
          <div className="groupCompTitle">
            <strong>{t(tournament ? "group.tournament" : competition.config.format === "single" ? "group.singleMatch" : "group.league")}</strong>
            <span>{competition.finished ? t("group.finished") : t(tournament ? "group.roundN" : "group.matchdayN", { n: round })}</span>
          </div>
          <p className="groupCompPot">{t("group.potLine", { pot: euros(groupMoney(competition).pot), fee: euros(groupMoney(competition).commission), prize: euros(groupMoney(competition).prize) })}</p>
          <ol className="groupStandings" aria-label={t("group.standings")}>
            {standings.map((s) => {
              const p = competition.players.find((x) => x.id === s.id)!;
              return (
                <li key={s.id} className={`${s.id === you ? "you" : ""} ${s.out ? "out" : ""}`}>
                  <b>{s.place}</b>
                  <img src={p.avatar} alt="" />
                  <span>{p.name}{p.simulated ? <small>{t("common.simulated")}</small> : null}</span>
                  <em>{competition.payouts ? (competition.payouts[s.id] ? `+${euros(competition.payouts[s.id])}` : "—") : s.out ? t("group.out") : tournament ? "" : t("group.winsShort", { n: s.wins })}</em>
                </li>
              );
            })}
          </ol>
          {competition.finished ? (
            <button className="groupPrimaryAction" type="button" onClick={onClearCompetition}>{t("group.newCompetition")}</button>
          ) : match ? (
            <button className="groupPrimaryAction" type="button" onClick={onPlay}>
              {t("group.playNext", { game: game ? gameName(game) : match.gameId })}{opponent ? ` · ${t("group.vs", { name: nameOf(opponent) })}` : ""}
            </button>
          ) : (
            <p className="groupCompWait" role="status">{t("group.waitingRound")}</p>
          )}
          {voting && (
            <button className="groupVoteAction" type="button" disabled={voted} onClick={onVote}>
              {voted ? t("group.voted", { n: competition.votes.length, total: competition.players.length }) : t("group.voteEnd")}
            </button>
          )}
          <p className="groupDemoNotice">{t("group.resume")} · {t("group.notice")}</p>
        </div>
      </section>
    );
  }

  const seg = <T extends string | boolean>(value: T, current: T, set: (v: T) => void, label: string, sub?: string) => (
    <button type="button" className={value === current ? "active" : ""} aria-pressed={value === current} onClick={() => set(value)}>
      <strong>{label}</strong>{sub ? <span>{sub}</span> : null}
    </button>
  );
  return (
    <section className="groupScreen">
      {header}
      <p className="groupDemoNotice">
        {t("group.notice")}
      </p>
      <div className="groupShareActions">
        <button
          type="button"
          onClick={() => void copyCode()}
        >
          {copiedCode ? t("group.codeCopied") : t("group.copyCode")}
        </button>
        <button
          type="button"
          onClick={() => void copyInviteLink()}
        >
          {copiedLink ? t("group.linkCopied") : t("group.copyLink")}
        </button>
      </div>

      <div className="groupShareFeedback" role="status" aria-live="polite">
        {shareError ||
          (copiedCode
            ? t("group.codeCopiedMsg")
            : copiedLink
              ? t("group.linkCopiedMsg")
              : "")}
        {shareFallback && (
          <input
            aria-label={t("group.copyManual")}
            value={shareFallback}
            readOnly
            onFocus={(event) => event.target.select()}
          />
        )}
      </div>
      <div className="groupMembersCard">
        <div className="groupSectionTitle">
          <span>{t("group.members")}</span>
          <small>{t("group.playersCount", { n: group.members.length })}</small>
        </div>

        <div className="groupMembers">
          {group.members.map((member) => (
            <div
              key={member.id}
              className={member.isYou ? "you" : ""}
            >
              <img src={member.avatar} alt="" />
              <span>{member.name}</span>
              <b>{member.isYou ? t("common.you") : t("common.simulated")}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="groupFormCard">
        <span className="groupFormLabel">{t("group.format")}</span>
        <div className="competitionTypeGrid">
          {seg<Kind>("single", kind, setKind, t("group.singleMatch"), t("group.quickSub"))}
          {seg<Kind>("league", kind, setKind, t("group.league"), t("group.leagueSub"))}
          {seg<Kind>("tournament", kind, setKind, t("group.tournament"), t("group.tournamentSub"))}
        </div>
        {kind === "league" && (
          <>
            <span className="groupFormLabel">{t("group.leagueMode")}</span>
            <div className="competitionTypeGrid two">
              {seg(false, duels, setDuels, t("group.modeRounds"), t("group.modeRoundsSub"))}
              {seg(true, duels, setDuels, t("group.modeDuels"), t("group.modeDuelsSub"))}
            </div>
            <span className="groupFormLabel">{t("group.end")}</span>
            <div className="competitionTypeGrid two">
              {seg(false, byVote, setByVote, t("group.endRounds", { n: rounds }))}
              {seg(true, byVote, setByVote, t("group.endVote"))}
            </div>
            {!byVote && (
              <div className="groupStepperRow">
                <button type="button" aria-label="−" disabled={rounds <= 1} onClick={() => setRounds((n) => Math.max(1, n - 1))}>−</button>
                <output aria-live="polite">{rounds}</output>
                <button type="button" aria-label="+" disabled={rounds >= 20} onClick={() => setRounds((n) => Math.min(20, n + 1))}>+</button>
              </div>
            )}
          </>
        )}
        <label className="groupField">
          <span className="groupFormLabel">{t("group.chooseGame")}</span>
          <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
            {kind !== "single" && <option value={MIXED}>{t("group.random")}</option>}
            {playable.map((g: GameMeta) => <option key={g.id} value={g.id}>{gameName(g)}</option>)}
          </select>
        </label>
        <label className="groupField">
          <span className="groupFormLabel">{t("group.entryPrice")}</span>
          <div className="numberInputWithUnit">
            <input type="number" min="0" max={balance} step="0.5" inputMode="decimal" value={entry} onChange={(event) => setEntry(event.target.value)} />
            <b>€</b>
          </div>
          <small>{t("group.entryOnce")} {t("group.available", { amount: formatMoney(balance) })}</small>
        </label>
        {players >= 3 && (
          <>
            <span className="groupFormLabel">{t("group.split")}</span>
            <div className="competitionTypeGrid two">
              {seg<GroupSplit>("winner", split, setSplit, t("group.splitWinner"))}
              {seg<GroupSplit>("70-30", split, setSplit, t("group.split7030"))}
            </div>
          </>
        )}
        <p className="groupCompPot">{t("group.potLine", { pot: euros(money.pot), fee: euros(money.commission), prize: euros(money.prize) })} · {GROUP_COMMISSION_BPS / 100} %</p>
        <button className="groupPrimaryAction" type="button" disabled={!affordable || (kind === "single" && gameId === MIXED)}
          onClick={() => onCreateCompetition(buildConfig())}>
          {t("group.payAndStart", { amount: euros(entryMinor) })}
        </button>
      </div>
    </section>
  );
}
