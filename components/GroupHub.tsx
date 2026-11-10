"use client";
/*
 * Groups (v128, reworked v166): create or join a group, invite through one share button, set up a competition in
 * three numbered steps and play it through. The rules — rounds, duels, eliminations, votes, the pot and its split —
 * live in lib/groupCompetition.ts (pure); this screen only collects the choices and shows the state.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClosedGroup } from "@/lib/groupPlay";
import { DEFAULT_SPLITS, MAX_PAID_PLACES, groupMoney, groupStandings, nextGroupMatch, rebalanceSplit, type GroupCompetition, type GroupConfig, type GroupFormat } from "@/lib/groupCompetition";
import { createRng } from "@/lib/deterministic/seeded";
import { GAMES, type GameMeta } from "@/lib/games";
import { formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { portraitSrc } from "@/lib/avatars";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

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

/** Where an invite can go. Plain web share intents only: nothing is sent until the player confirms in that app. */
type ShareTarget = { id: string; label: string; icon: UiIconName; tone: string; href: (text: string, url: string) => string };
const SHARE_TARGETS: readonly ShareTarget[] = [
  { id: "whatsapp", label: "WhatsApp", icon: "chat", tone: "#25d366", href: (text, url) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { id: "telegram", label: "Telegram", icon: "send", tone: "#2aa3df", href: (text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "x", label: "X", icon: "share", tone: "#e7e9ea", href: (text, url) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { id: "facebook", label: "Facebook", icon: "group", tone: "#3b82f6", href: (_text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: "email", label: "Email", icon: "mail", tone: "#f3c55a", href: (text, url) => `mailto:?subject=${encodeURIComponent("GALACTIC GAMES")}&body=${encodeURIComponent(`${text}\n${url}`)}` },
  { id: "sms", label: "SMS", icon: "phone", tone: "#7fe3ee", href: (text, url) => `sms:?&body=${encodeURIComponent(`${text} ${url}`)}` },
];

export default function GroupHub({ group, competition, balance, playerName, avatarSrc, initialJoinCode = "", onCreateGroup, onJoinGroup, onCreateCompetition, onPlay, onVote, onClearCompetition }: Props) {
  useI18n();
  const [entryMode, setEntryMode] = useState<"create" | "join">(initialJoinCode ? "join" : "create");
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const mountedRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("league");
  const [duels, setDuels] = useState(false);
  const [gameId, setGameId] = useState<string>(MIXED);
  const [entry, setEntry] = useState("5");
  const [byVote, setByVote] = useState(false);
  const [rounds, setRounds] = useState(5);
  const players = group?.members.length ?? 0;
  /** At least one player goes home without a prize; never more than MAX_PAID_PLACES places. */
  const maxPlaces = Math.max(1, Math.min(MAX_PAID_PLACES, players - 1));
  /** The organiser's split; null means the default for the places this group allows (70 · 20 · 10 with four or more). */
  const [shares, setShares] = useState<readonly number[] | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current); };
  }, []);
  useEffect(() => {
    if (!initialJoinCode || group) return;
    setEntryMode("join");
    setJoinCode(normalizeJoinCode(initialJoinCode));
  }, [group, initialJoinCode]);
  useEffect(() => {
    if (!sheetOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);
  const playable = useMemo(() => GAMES.filter((game) => game.enabled), []);

  async function copyText(value: string, which: "code" | "link") {
    setShareError(""); setShareFallback(""); setCopied("");
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      if (!mountedRef.current) return;
      setCopied(which);
      copyTimerRef.current = setTimeout(() => { setCopied(""); copyTimerRef.current = null; }, 2000);
    } catch {
      if (!mountedRef.current) return;
      setShareError(t("group.copyFailed")); setShareFallback(value);
    }
  }
  function inviteLink() {
    const url = new URL(window.location.href);
    url.search = ""; url.searchParams.set("join", group!.code); url.hash = "group";
    return url.toString();
  }
  async function shareMore() {
    if (!group) return;
    try {
      await navigator.share({ title: "GALACTIC GAMES", text: t("group.shareText", { name: group.name, code: group.code }), url: inviteLink() });
      if (mountedRef.current) setSheetOpen(false);
    } catch {
      // Cancelled or not allowed: the sheet stays open with the other options.
    }
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
          {/* v139: the crew instead of three numbered steps; one line says it all. */}
          <div className="groupHeroCrew" aria-hidden="true">
            {[avatarSrc, portraitSrc(2, "-s"), portraitSrc(5, "-s"), portraitSrc(9, "-s")].map((src, i) => <img key={i} src={src} alt="" width={46} height={46} />)}
          </div>
          <span>{t("group.heroTag")}</span>
          <h1>{t("group.heroTitle")}</h1>
          <p className="groupHeroLead">{t("group.heroLead")}</p>
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
            </div>
            <button className="groupPrimaryAction" type="button"
              onClick={() => onCreateGroup(playerName ? t("group.defaultName", { name: playerName }) : t("group.myGroup"), 0)}>
              {t("group.createButton")}
            </button>
          </div>
        ) : (
          <form className="groupSetupCard groupJoinCard groupJoinRow" onSubmit={(event) => { event.preventDefault(); submitJoin(); }}>
            <input
              aria-label={t("group.codeField")}
              value={joinCode}
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
              onPaste={(event) => {
                const normalized = normalizeJoinCode(event.clipboardData.getData("text"));
                if (normalized) { event.preventDefault(); setJoinCode(normalized); }
              }}
              placeholder={t("group.codePlaceholder")}
              dir="ltr"
            />
            <button className="groupPrimaryAction" type="submit" disabled={joinCode.length < 4}>{t("group.joinButton")}</button>
          </form>
        )}
      </section>
    );
  }

  const entryMinor = Math.max(0, Math.round(Number(entry.replace(",", ".")) * 100) || 0);
  const format: GroupFormat = kind === "league" ? (duels ? "league-duels" : "league-rounds") : kind;
  // Fewer players than the chosen paid places: back to the default for as many places as the group allows.
  const split = shares && shares.length <= maxPlaces ? shares : DEFAULT_SPLITS[Math.min(3, maxPlaces)];
  const money = groupMoney({ config: { entryMinor } as GroupConfig, players: group.members });
  const affordable = entryMinor <= Math.round(balance * 100);
  function buildConfig(): GroupConfig {
    const ids = gameId !== MIXED ? [gameId] : (() => {
      const rng = createRng(`${group!.code}:${format}:games`), pool = playable.map((g) => g.id);
      return Array.from({ length: 12 }, () => pool[rng.nextInt(pool.length)]);
    })();
    return {
      format, entryMinor, split: [...split], gameIds: ids,
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
      <button type="button" className={`groupCodeButton ${copied === "code" ? "copied" : ""}`} aria-label={t("group.copyCodeAria", { code: group.code })}
        onClick={() => void copyText(group.code, "code")}>
        <small>{copied === "code" ? <><UiIcon name="check" size={12} />{t("group.codeCopiedShort")}</> : <><UiIcon name="copy" size={12} />{t("group.codeTitle")}</>}</small>
        <b dir="ltr">{group.code}</b>
      </button>
    </div>
  );
  const feedback = (
    <div className="groupShareFeedback" role="status" aria-live="polite">
      {shareError || (copied === "code" ? t("group.codeCopiedMsg") : copied === "link" ? t("group.linkCopiedMsg") : "")}
      {shareFallback && <input aria-label={t("group.copyManual")} value={shareFallback} readOnly onFocus={(event) => event.target.select()} />}
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
        {feedback}
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
                  <span>{p.name}</span>
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
          <p className="groupResumeNote">{t("group.resume")}</p>
        </div>
      </section>
    );
  }

  const seg = <T extends string | boolean>(value: T, current: T, set: (v: T) => void, label: string, sub?: string) => (
    <button type="button" className={value === current ? "active" : ""} aria-pressed={value === current} onClick={() => set(value)}>
      <strong>{label}</strong>{sub ? <span>{sub}</span> : null}
    </button>
  );
  const shareText = t("group.shareText", { name: group.name, code: group.code });
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <section className="groupScreen">
      {header}
      {feedback}

      <div className="groupInviteCard">
        <div className="groupSectionTitle">
          <span>{t("group.inviteTitle")}</span>
          <small>{t("group.playersCount", { n: players })}</small>
        </div>
        <ul className="groupCrewRow" aria-label={t("group.members")}>
          {group.members.map((member) => (
            <li key={member.id} className={member.isYou ? "you" : ""}>
              <img src={member.avatar} alt="" />
              <span>{member.isYou ? t("common.you") : member.name}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="groupShareButton" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <UiIcon name="share" size={20} />
          <span>{t("group.share")}</span>
        </button>
      </div>

      <div className="groupFormCard">
        <h2 className="groupFormTitle">{t("group.newTitle")}</h2>
        <ol className="groupSteps">
          <li>
            <span className="groupFormLabel">{t("group.format")}</span>
            <div className="competitionTypeGrid">
              {seg<Kind>("single", kind, setKind, t("group.singleMatch"), t("group.quickSub"))}
              {seg<Kind>("league", kind, setKind, t("group.league"), t("group.leagueSub"))}
              {seg<Kind>("tournament", kind, setKind, t("group.tournament"), t("group.tournamentSub"))}
            </div>
            {kind === "league" && (
              <div className="groupLeagueOptions">
                <span className="groupFormSub">{t("group.leagueMode")}</span>
                <div className="competitionTypeGrid two">
                  {seg(false, duels, setDuels, t("group.modeRounds"), t("group.modeRoundsSub"))}
                  {seg(true, duels, setDuels, t("group.modeDuels"), t("group.modeDuelsSub"))}
                </div>
                <span className="groupFormSub">{t("group.end")}</span>
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
              </div>
            )}
          </li>
          <li>
            <label className="groupField">
              <span className="groupFormLabel">{t("group.stepGame")}</span>
              <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
                {kind !== "single" && <option value={MIXED}>{t("group.random")}</option>}
                {playable.map((g: GameMeta) => <option key={g.id} value={g.id}>{gameName(g)}</option>)}
              </select>
            </label>
          </li>
          <li>
            <span className="groupFormLabel">{t("group.stepEntry")}</span>
            <label className="groupField">
              <span className="groupFormSub">{t("group.entryPrice")}</span>
              <div className="numberInputWithUnit">
                <input type="number" min="0" max={balance} step="0.5" inputMode="decimal" value={entry} onChange={(event) => setEntry(event.target.value)} />
                <b>€</b>
              </div>
              <small>{t("group.entryOnce")} {t("group.available", { amount: formatMoney(balance) })}</small>
            </label>
            <div className="groupPotSummary">
              <span>{t("group.prizes")}</span>
              <b>{euros(money.prize)}</b>
              <small>{t("group.potLine", { pot: euros(money.pot), fee: euros(money.commission), prize: euros(money.prize) })}</small>
            </div>
            <details className="groupPrizeDetails">
              <summary>
                <span>{t("group.split")}</span>
                <b dir="ltr">{split.join(" · ")} %</b>
                <UiIcon name="chevronDown" size={18} />
              </summary>
              <div className="groupPrizeBody">
                <div className="groupPlacesRow">
                  <span className="groupFormSub">{t("group.prizePlaces")}</span>
                  <div className="groupPlacesPick" role="group" aria-label={t("group.prizePlaces")}>
                    {Array.from({ length: maxPlaces }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" className={split.length === n ? "active" : ""} aria-pressed={split.length === n} onClick={() => setShares(DEFAULT_SPLITS[n])}>{n}</button>
                    ))}
                  </div>
                </div>
                <ul className="groupPrizeBars">
                  {split.map((pct, i) => (
                    <li key={i} className={`place${i + 1}`}>
                      <span className="groupPrizePlace">{t("group.placeN", { n: i + 1 })}</span>
                      <input type="range" min={1} max={100} step={1} value={pct} disabled={split.length === 1}
                        style={{ "--fill": `${pct}%` } as CSSProperties}
                        aria-label={`${t("group.placeN", { n: i + 1 })} · ${pct} %`}
                        onChange={(event) => setShares(rebalanceSplit(split, i, Number(event.target.value)))} />
                      <b dir="ltr">{pct} %</b>
                      <small dir="ltr">{euros(Math.round((money.prize * pct) / 100))}</small>
                    </li>
                  ))}
                </ul>
                {split.length > 1 && <p className="groupPrizeHint">{t("group.splitHint")}</p>}
              </div>
            </details>
          </li>
        </ol>
        <button className="groupPrimaryAction" type="button" disabled={!affordable || (kind === "single" && gameId === MIXED)}
          onClick={() => onCreateCompetition(buildConfig())}>
          {t("group.payAndStart", { amount: euros(entryMinor) })}
        </button>
      </div>

      {sheetOpen && (
        <div className="groupShareBackdrop" onClick={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}>
          <div className="groupShareSheet" role="dialog" aria-modal="true" aria-labelledby="groupShareTitle" ref={sheetRef}>
            <div className="groupShareHead">
              <strong id="groupShareTitle">{t("group.shareTitle")}</strong>
              <button type="button" className="groupShareClose" aria-label={t("common.close")} onClick={() => setSheetOpen(false)}><UiIcon name="close" size={18} /></button>
            </div>
            <div className="groupShareGrid">
              {SHARE_TARGETS.map((target) => (
                <a key={target.id} href={target.href(shareText, inviteLink())} target="_blank" rel="noopener noreferrer" style={{ "--tone": target.tone } as CSSProperties}
                  onClick={() => setSheetOpen(false)}>
                  <span className="groupShareIcon"><UiIcon name={target.icon} size={22} /></span>
                  <span>{target.label}</span>
                </a>
              ))}
              <button type="button" style={{ "--tone": "#eaf4ff" } as CSSProperties} onClick={() => { void copyText(inviteLink(), "link"); setSheetOpen(false); }}>
                <span className="groupShareIcon"><UiIcon name="link" size={22} /></span>
                <span>{t("group.shareCopy")}</span>
              </button>
              {canNativeShare && (
                <button type="button" style={{ "--tone": "#b9a8ff" } as CSSProperties} onClick={() => void shareMore()}>
                  <span className="groupShareIcon"><UiIcon name="grid" size={22} /></span>
                  <span>{t("group.shareMore")}</span>
                </button>
              )}
            </div>
            <p className="groupShareLink" dir="ltr">{inviteLink()}</p>
          </div>
        </div>
      )}
    </section>
  );
}
