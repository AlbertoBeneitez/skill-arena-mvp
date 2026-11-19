"use client";
/*
 * Groups (v128, reworked v166, black and gold v167): create or join a group, invite through one share button, set up
 * a competition in three numbered steps — modality (v217: todos vs todos, 1 vs 1 or relays against other groups),
 * games picked from their covers (played matchday by matchday in the order chosen), entry and prizes — and play it
 * through; the standings sit at the end of the tab. The rules live in lib/groupCompetition.ts
 * (pure); this screen only collects the choices and shows the state. Its look is self-contained in
 * GroupHub.module.css (no shared group classes from globals.css).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ClosedGroup } from "@/lib/groupPlay";
import { defaultSplit, GROUP_COMMISSION_BPS, GROUP_MODALITIES, groupMoney, groupStandings, groupTeamStandings, HOME_TEAM, isInterGroup, nextGroupMatch, RANDOM_GAME, relayTotals, relayWaitingFor, roundAwaitingRival, stepSplit, waitingGroupMatch, type GroupCompetition, type GroupConfig, type GroupModality } from "@/lib/groupCompetition";
import { groupArt } from "@/lib/groupArt";
import { GAMES, playableForMoney } from "@/lib/games";
import { COIN_SYMBOL, formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { portraitSrc } from "@/lib/avatars";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import st from "./GroupHub.module.css";
import { MODALITY_LABEL, competitionTitle, pointsLabel } from "./groupLabels";
import GamePicker from "./GamePicker";

type Props = {
  group: ClosedGroup | null;
  competition: GroupCompetition | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  initialJoinCode?: string;
  onCreateGroup: (name: string, stake: number) => void;
  onJoinGroup: (code: string) => void;
  /** v179: why the last code could not be joined (a group of the other platform). */
  joinError?: string;
  onCreateCompetition: (config: GroupConfig) => void;
  onPlay: () => void;
  onVote: () => void;
  onClearCompetition: () => void;
  /** v192: deletes the group (and gives back the entry of an unfinished competition). */
  onDeleteGroup: () => void;
  /** v171: rename the group or set its picture (a small data URL made from a phone photo). */
  onUpdateGroup: (patch: { name?: string; image?: string | null }) => void;
  /** v204: extra panels of the online screen (an open competition above, challenges and ranking below). */
  top?: ReactNode;
  bottom?: ReactNode;
  /** v204: the group picture lives only on this device; the online screen hides it. */
  allowPhoto?: boolean;
  /** v199: offline (header globe off): invented rivals can be added; competitions are free (no entry, no prizes). */
  offline?: boolean;
  onAddRival?: () => void;
  onRemoveRival?: (id: string) => void;
  /** v217: inter-group modalities — look for a rival group for the matchday (searches until one appears). */
  onFindRival?: () => void;
  onCancelRival?: () => void;
  searchingRival?: boolean;
  /** v217: modalities that cannot be started here (shown, not selectable). */
  unavailableModalities?: readonly GroupModality[];
};
type Kind = GroupModality;
const MODALITY_HINT = { "all-vs-all": "group.modeAllHint", "duel-groups": "group.modeDuelHint", "relay-groups": "group.modeRelayHint" } as const;

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
const MAX_SEQUENCE = 20;
/** A phone photo cut to a centred square and shrunk to `size` px, as a JPEG data URL (stored with the group). */
async function squarePhoto(file: File, size: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("empty image");
    const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("no canvas");
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

/** v177 · Gold, silver and bronze medal for the first three prize places (decorative: the place is written next to it). */
const MEDALS = [["#fff1b8", "#e2b43f", "#8a6416"], ["#ffffff", "#c3c9d2", "#69707c"], ["#ffd2a8", "#c9783a", "#6e3a14"]] as const;
function Medal({ place }: { place: number }) {
  const [hi, mid, lo] = MEDALS[place - 1];
  const id = `medal-${useId().replace(/:/g, "")}`; // one gradient per instance: the open/closed list must not share ids
  return (
    <svg className={st.medal} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={hi} /><stop offset=".55" stopColor={mid} /><stop offset="1" stopColor={lo} /></linearGradient></defs>
      <circle cx="8" cy="8" r="7.2" fill={`url(#${id})`} />
      <circle cx="8" cy="8" r="5" fill="none" stroke={lo} strokeOpacity=".55" strokeWidth=".8" />
      <text x="8" y="10.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={lo} fontFamily="system-ui, sans-serif">{place}</text>
    </svg>
  );
}

export default function GroupHub({ joinError, group, competition, balance, playerName, avatarSrc, initialJoinCode = "", onCreateGroup, onJoinGroup, onCreateCompetition, onPlay, onVote, onClearCompetition, onUpdateGroup, onDeleteGroup, offline = false, onAddRival, onRemoveRival, onFindRival, onCancelRival, searchingRival = false, unavailableModalities = [], allowPhoto = true, top, bottom }: Props) {
  useI18n();
  const competitionRunning = Boolean(competition && !competition.finished);
  const [entryMode, setEntryMode] = useState<"create" | "join">(initialJoinCode ? "join" : "create");
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const mountedRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [kind, setKind] = useState<Kind>("all-vs-all");
  /** v167/v168: the games picked, in play order; the same game may appear several times (a league or a tournament
   * plays them round by round). Empty = random mix. */
  const [picked, setPicked] = useState<string[]>([]);
  const [entry, setEntry] = useState("5");
  const [rounds, setRounds] = useState(5);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [photoError, setPhotoError] = useState("");
  const photoRef = useRef<HTMLInputElement | null>(null);
  const players = group?.members.length ?? 0;
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
  function chooseKind(next: Kind) {
    if (!unavailableModalities.includes(next)) setKind(next);
  }
  /** Every tap adds the game to the end of the order (repeats allowed, up to MAX_SEQUENCE); the small cross on a picked
   * tile removes its last occurrence. Matchday n plays the n-th game (the order starts again when it runs out). */
  function tapGame(id: string) {
    setPicked((list) => list.length >= MAX_SEQUENCE ? list : [...list, id]);
  }
  function unpick(id: string) {
    setPicked((list) => { const last = list.lastIndexOf(id); return last < 0 ? list : list.filter((_, i) => i !== last); });
  }
  function stepEntry(delta: number) {
    const current = Number(entry.replace(",", ".")) || 0;
    const next = Math.min(Math.floor(balance), Math.max(0, Math.round(current) + delta));
    setEntry(String(next));
  }

  if (!group) {
    return (
      <section className={st.screen}>
        <div className={st.hero}>
          <div className={st.crew} aria-hidden="true">
            {[avatarSrc, portraitSrc(2, "-s"), portraitSrc(5, "-s"), portraitSrc(9, "-s")].map((src, i) => <img key={i} src={src} alt="" width={44} height={44} />)}
          </div>
          <h1 className={st.heroTitle}>{t("group.heroTitle")}</h1>
        </div>

        {/* v192: «Crear un grupo» creates it at once and the group opens right below; no second button. */}
        <div className={st.choice} role="tablist" aria-label={t("group.entryTabs")}>
          <button type="button" role="tab" aria-selected={false} aria-expanded={false}
            onClick={() => onCreateGroup(playerName ? t("group.defaultName", { name: playerName }) : t("group.myGroup"), 0)}>
            <UiIcon name="plus" size={20} />
            <span>{t("group.create")}</span>
          </button>
          <button type="button" role="tab" aria-selected={entryMode === "join"} aria-expanded={entryMode === "join"} onClick={() => setEntryMode(entryMode === "join" ? "create" : "join")}>
            <UiIcon name="enter" size={20} mirrorRtl />
            <span>{t("group.join")}</span>
          </button>
        </div>

        {entryMode === "join" && (
          <form className={`${st.panel} ${st.joinRow}`} onSubmit={(event) => { event.preventDefault(); submitJoin(); }}>
            <input
              className={st.codeInput}
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
            <button className={st.primary} type="submit" disabled={joinCode.length < 4}>{t("group.joinButton")}</button>
            {joinError && <p className={st.joinError} role="alert">{joinError}</p>}
          </form>
        )}
      </section>
    );
  }

  // v217: against other groups nobody pays an entry (lib/groupCompetition: inter-group modalities move no money).
  const versus = isInterGroup(kind);
  const entryMinor = offline || versus ? 0 : Math.max(0, Math.round(Number(entry.replace(",", ".")) * 100) || 0);
  // Fewer players than the chosen paid places: back to the default for as many places as the group allows.
  const split = shares && shares.length === Math.max(1, players) ? shares : defaultSplit(players);
  const paidSplit = split.filter((x) => x > 0);
  const money = groupMoney({ config: { entryMinor, commissionBps: GROUP_COMMISSION_BPS }, players: group.members });
  // v189: with an entry fee the group plays for money, so games of chance (no licence) are left out.
  const forMoney = entryMinor > 0;
  const pickable = forMoney ? playable.filter(playableForMoney) : playable;
  const affordable = entryMinor <= Math.round(balance * 100);
  const chosen = picked.filter((id) => id === RANDOM_GAME || pickable.some((g) => g.id === id));
  function buildConfig(): GroupConfig {
    // Nothing picked: every round is a surprise. Random slots are drawn when their round starts (lib/groupCompetition).
    const ids = chosen.length ? [...chosen] : [RANDOM_GAME];
    return {
      format: kind, entryMinor, split: [...split], gameIds: ids,
      ...(ids.includes(RANDOM_GAME) ? { randomPool: pickable.map((g) => g.id) } : {}),
      lowerWinsGameIds: playable.filter((g) => g.resultMetric === "reaction-time-ms").map((g) => g.id),
      end: { kind: "rounds", rounds },
    };
  }
  async function pickPhoto(file: File | undefined) {
    setPhotoError("");
    if (!file) return;
    try {
      onUpdateGroup({ image: await squarePhoto(file, 192) });
    } catch {
      setPhotoError(t("group.photoFailed"));
    }
  }
  function saveName() {
    const name = nameDraft.trim().replace(/\s+/g, " ").slice(0, 32);
    if (name) onUpdateGroup({ name });
    setEditingName(false);
  }
  const header = (
    <div className={st.head}>
      {allowPhoto ? (
        <button type="button" className={st.groupPic} onClick={() => photoRef.current?.click()} aria-label={t(group.image ? "group.photoChange" : "group.photoAdd")}>
          <img src={group.image || groupArt(group.code || group.id)} alt="" />
          <span className={st.groupPicBadge} aria-hidden="true"><UiIcon name="camera" size={12} /></span>
        </button>
      ) : (
        <span className={st.groupPic} aria-hidden="true"><img src={groupArt(group.code || group.id)} alt="" /></span>
      )}
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      <div className={st.headName}>
        {editingName ? (
          <form className={st.nameForm} onSubmit={(event) => { event.preventDefault(); saveName(); }}>
            <input autoFocus value={nameDraft} maxLength={32} aria-label={t("group.nameField")} onChange={(event) => setNameDraft(event.target.value)} onBlur={saveName} />
          </form>
        ) : (
          <button type="button" className={st.nameBtn} onClick={() => { setNameDraft(group.name); setEditingName(true); }} aria-label={t("group.renameAria", { name: group.name })}>
            <h1>{group.name}</h1>
            <UiIcon name="pencil" size={14} />
          </button>
        )}
        <button type="button" className={st.ticket} data-copied={copied === "code" || undefined} aria-label={t("group.copyCodeAria", { code: group.code })}
          onClick={() => void copyText(group.code, "code")}>
          <small>{copied === "code" ? <><UiIcon name="check" size={12} />{t("group.codeCopiedShort")}</> : <><UiIcon name="copy" size={12} />{t("group.codeTitle")}</>}</small>
          <b dir="ltr">{group.code}</b>
        </button>
      </div>
      <button type="button" className={st.binBtn} aria-label={t("group.deleteAria")} aria-expanded={confirmDelete} onClick={() => setConfirmDelete((v) => !v)}>
        <UiIcon name="trash" size={18} />
      </button>
    </div>
  );
  const feedback = (
    <div className={st.feedback} role="status" aria-live="polite">
      {photoError || shareError || (copied === "code" ? t("group.codeCopiedMsg") : copied === "link" ? t("group.linkCopiedMsg") : "")}
      {shareFallback && <input aria-label={t("group.copyManual")} value={shareFallback} readOnly onFocus={(event) => event.target.select()} />}
    </div>
  );

  /** v175: what the players can win, in large type; v186: the commission row only on older competitions that had one. */
  const prizeBox = (prize: number, commission: number) => (
    <dl className={st.prizeBox}>
      <dt>{t("group.prizes")}</dt>
      <dd dir="ltr">{euros(prize)}</dd>
      {commission > 0 && <>
        <dt>{t("group.commission")}</dt>
        <dd dir="ltr" className={st.fee}>{euros(commission)}</dd>
      </>}
    </dl>
  );

  /** v192 · Red «Borrar» of the leagues and tournaments tab: first tap asks, second deletes (an unfinished competition
   * gives its entry back). Shown under the competition and under the new-competition form. */
  // v218 (owner): no red button at the bottom; a small bin in the header asks first, right under it.
  const deleteBlock = confirmDelete ? (
    <div className={`${st.panel} ${st.dangerZone}`}>
      <p role="alert">{competition && !competition.finished ? t("group.deleteConfirmRefund") : t("group.deleteConfirm")}</p>
      <div className={st.dangerRow}>
        <button type="button" className={st.cancel} onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</button>
        <button type="button" className={st.secondary} onClick={() => { setConfirmDelete(false); onDeleteGroup(); }}>{t("group.deleteYes")}</button>
      </div>
    </div>
  ) : null;

  if (competition) {
    const you = group.members.find((m) => m.isYou)?.id ?? "you";
    const standings = groupStandings(competition), next = nextGroupMatch(competition, you);
    const match = next >= 0 ? competition.matches[next] : null;
    const round = competition.matches.reduce((r, m) => Math.max(r, m.round), 0);
    const format = competition.config.format, interGroup = isInterGroup(format);
    const modality = format === "all-vs-all" || interGroup;
    const everyone = [...competition.players, ...(competition.rivals ?? []).flatMap((r) => r.players)];
    const nameOf = (id: string) => everyone.find((p) => p.id === id)?.name ?? id;
    const opponent = match && (format === "league-duels" || format === "duel-groups") ? match.players.find((p) => p !== you) : undefined;
    const game = match ? playable.find((g) => g.id === match.gameId) : undefined;
    const voting = competition.config.end.kind === "vote" && !competition.finished;
    const voted = competition.votes.includes(you);
    const tournament = format === "tournament";
    const pot = groupMoney(competition);
    // v217: the matchday waiting for a rival group, the rival of the current one, the relay this player waits in.
    const awaiting = roundAwaitingRival(competition);
    const rival = competition.rivals?.find((r) => r.round === round);
    const waitIndex = waitingGroupMatch(competition, you), waitMatch = waitIndex >= 0 ? competition.matches[waitIndex] : null;
    const relayMatch = format === "relay-groups" ? competition.matches.find((m) => m.round === round) : undefined;
    const totals = relayMatch ? relayTotals(competition, relayMatch) : null;
    const relayBefore = waitMatch ? relayWaitingFor(competition, waitMatch, you) : null;
    const roundLabel = round ? t(tournament ? "group.roundN" : "group.matchdayN", { n: awaiting || round }) : t("group.matchdayN", { n: 1 });
    // The group table appears once a relay has been decided.
    const teams = format === "relay-groups" ? groupTeamStandings(competition, group.name) : null;
    const showTeams = !!teams && teams.some((row) => row.played > 0);
    return (
      <section className={st.screen}>
        {header}
        {deleteBlock}
        {top}
        {feedback}
        <div className={st.panel}>
          <div className={st.compTitle}>
            <strong>{competitionTitle(competition)}</strong>
            <span>{competition.finished ? t("group.finished") : awaiting && round === 0 ? t("group.matchdayN", { n: 1 }) : roundLabel}</span>
          </div>
          {!interGroup && prizeBox(pot.prize, pot.commission)}
          {interGroup && rival && !awaiting && !competition.finished && (totals ? (
            <dl className={st.relayBoard}>
              <div data-you><dt>{group.name}</dt><dd dir="ltr">{totals.home}</dd></div>
              <div><dt>{rival.name}</dt><dd dir="ltr">{totals.away}</dd></div>
            </dl>
          ) : <p className={st.versusLine}>{t("group.vsGroup", { name: rival.name })}</p>)}
          {competition.finished ? (
            <button className={st.primary} type="button" onClick={onClearCompetition}>{t("group.newCompetition")}</button>
          ) : awaiting ? (
            searchingRival ? (
              <div className={st.searching} role="status">
                <span className={st.radar} aria-hidden="true" />
                <span>{t("group.searching", { n: competition.players.length })}</span>
                {onCancelRival && <button type="button" className={st.secondary} onClick={onCancelRival}>{t("group.cancelSearch")}</button>}
              </div>
            ) : (
              <button className={st.primary} type="button" disabled={!onFindRival} onClick={onFindRival}>{t("group.findRival")}</button>
            )
          ) : match ? (
            <button className={st.primary} type="button" onClick={onPlay}>
              {t("group.playNext", { game: game ? gameName(game) : match.gameId })}{opponent ? ` · ${t("group.vs", { name: nameOf(opponent) })}` : ""}
            </button>
          ) : (
            <p className={st.note} role="status">{relayBefore ? t("group.relayWait", { name: nameOf(relayBefore) }) : t("group.waitingRound")}</p>
          )}
          {voting && (
            <button className={st.secondary} type="button" disabled={voted} onClick={onVote}>
              {voted ? t("group.voted", { n: competition.votes.length, total: competition.players.length }) : t("group.voteEnd")}
            </button>
          )}
          <p className={st.note}>{t(modality ? MODALITY_HINT[format as GroupModality] : "group.resume", { n: competition.players.length })}</p>
        </div>
        {bottom}
        {/* v217 (owner): the standings, updated matchday after matchday, at the end of the tab. */}
        <div className={st.panel}>
          <div className={st.compTitle}>
            <strong>{t("group.standings")}</strong>
            <span>{t("group.afterMatchdays", { n: Math.max(0, competition.finished ? round : round - 1) })}</span>
          </div>
          {showTeams && teams && (
            <ol className={st.standings} aria-label={t("group.teamTable")}>
              {teams.map((row) => (
                <li key={row.id} data-team data-you={row.id === HOME_TEAM || undefined}>
                  <b>{row.place}</b>
                  <span>{row.name}</span>
                  <em>{pointsLabel(row.points)}</em>
                </li>
              ))}
            </ol>
          )}
          <ol className={st.standings} aria-label={t("group.standings")}>
            {standings.map((s) => {
              const p = competition.players.find((x) => x.id === s.id)!;
              return (
                <li key={s.id} data-you={s.id === you || undefined} data-out={s.out || undefined}>
                  <b>{s.place}</b>
                  <img src={p.avatar} alt="" />
                  <span>{p.name}</span>
                  <em>{competition.payouts && competition.config.entryMinor > 0 ? (competition.payouts[s.id] ? `+${euros(competition.payouts[s.id])}` : "—") : s.out ? t("group.out") : tournament ? "" : modality ? pointsLabel(s.points) : t("group.winsShort", { n: s.wins })}</em>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  }

  const shareText = t("group.shareText", { name: group.name, code: group.code });
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const multi = true;
  /** v175: «Aleatorio» is one more game: it can be picked, repeated and ordered like the others. */
  return (
    <section className={st.screen}>
      {header}
      {deleteBlock}
      {top}
      {feedback}

      <div className={st.panel}>
        <div className={st.panelHead}>
          <h2>{t("group.inviteTitle")}</h2>
          <small>{players === 1 ? t("group.playersOne") : t("group.playersCount", { n: players })}</small>
        </div>
        <ul className={st.members} aria-label={t("group.members")}>
          {group.members.map((member) => (
            <li key={member.id} data-you={member.isYou || undefined} data-invented={member.id.startsWith("bot-") || undefined}>
              <img src={member.avatar} alt="" />
              <span>{member.isYou ? t("common.you") : member.name}</span>
              {offline && member.id.startsWith("bot-") && !competitionRunning && (
                <button type="button" className={st.dropRival} aria-label={t("group.removeRival", { name: member.name })} onClick={() => onRemoveRival?.(member.id)}>
                  <UiIcon name="close" size={12} />
                </button>
              )}
            </li>
          ))}
          {offline && players < 20 && !competitionRunning && (
            <li className={st.addRival}>
              <button type="button" aria-label={t("group.addRival")} onClick={() => onAddRival?.()}><UiIcon name="plus" size={20} /></button>
              <span>{t("group.addRivalShort")}</span>
            </li>
          )}
        </ul>
        {offline
          ? <p className={st.hint}>{t("group.offlineHint")}</p>
          : (
            <button type="button" className={st.secondary} aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
              <UiIcon name="share" size={18} />
              <span>{t("group.share")}</span>
            </button>
          )}
      </div>

      <div className={st.panel}>
        <h2 className={st.formTitle}>{t("group.newTitle")}</h2>
        <ol className={st.steps}>
          <li>
            <span className={`${st.stepLabel} ${st.sc}`}>{t("group.modality")}</span>
            <div className={st.seg3}>
              {GROUP_MODALITIES.map((m) => (
                <button key={m} type="button" aria-pressed={m === kind} disabled={unavailableModalities.includes(m)} onClick={() => chooseKind(m)}>
                  <strong>{t(MODALITY_LABEL[m])}</strong>
                </button>
              ))}
            </div>
            <p className={st.hint}>{t(MODALITY_HINT[kind], { n: Math.max(2, players) })}</p>
            {unavailableModalities.length > 0 && <p className={st.hint}>{t("group.versusOfflineOnly")}</p>}
            <div className={st.sub}>
              <div className={st.counter}>
                <span>{t("group.roundsCount")}</span>
                <div className={st.stepper}>
                  <button type="button" aria-label={t("group.lessRounds")} disabled={rounds <= 1} onClick={() => setRounds((n) => Math.max(1, n - 1))}>−</button>
                  <output aria-live="polite">{rounds}</output>
                  <button type="button" aria-label={t("group.moreRounds")} disabled={rounds >= 30} onClick={() => setRounds((n) => Math.min(30, n + 1))}>+</button>
                </div>
              </div>
            </div>
          </li>
          <li>
            <div className={st.stepHead}>
              <span className={st.stepLabel}>{t(multi ? "group.stepGames" : "group.stepGame")}</span>
              {/* v213: the X sits right after the step title, always there (dimmed when there is nothing to clear). */}
              <button type="button" className={st.clearStep} aria-label={t("group.clearGames")} disabled={picked.length === 0} onClick={() => setPicked((list) => list.slice(0, -1))}>
                <UiIcon name="close" size={16} />
              </button>
            </div>
            <GamePicker games={pickable} picked={chosen} multi withRandom onTap={tapGame} onUnpick={unpick} label={t("group.stepGames")} />
            {forMoney && GAMES.some((g) => !playableForMoney(g)) && <p className={st.hint}>{t("group.chanceExcluded")}</p>}
            <p className={st.hint}>{multi ? (chosen.length ? "" : t("group.gamesPickHint")) : chosen.length ? "" : t("group.pickOne")}</p>
          </li>
          {!offline && !versus && <li>
            <span className={st.stepLabel}>{t("group.stepEntry")}</span>
            <div className={st.field}>
              <label className={st.subLabel} htmlFor="group-entry">{t("group.entryPrice")}</label>
              <div className={st.money}>
                <input id="group-entry" type="number" min="0" max={balance} step="0.5" inputMode="decimal" value={entry} onChange={(event) => setEntry(event.target.value)} />
                <span className={st.euro} aria-hidden="true">{COIN_SYMBOL}</span>
                <span className={st.arrows}>
                  <button type="button" aria-label={t("group.entryUp")} disabled={entryMinor >= Math.floor(balance) * 100} onClick={() => stepEntry(1)}><UiIcon name="chevronUp" size={16} /></button>
                  <button type="button" aria-label={t("group.entryDown")} disabled={entryMinor <= 0} onClick={() => stepEntry(-1)}><UiIcon name="chevronDown" size={16} /></button>
                </span>
              </div>
              <small>{t("group.available", { amount: formatMoney(balance) })}</small>
            </div>
            {prizeBox(money.prize, money.commission)}
            <details className={st.split}>
              <summary>
                <span>{t("group.split")}</span>
                <b dir="ltr" className={st.shares}>{paidSplit.map((pct, i) => <span key={i}>{i < 3 && <Medal place={i + 1} />}{pct} %</span>)}</b>
                <UiIcon name="chevronDown" size={18} />
              </summary>
              <ol className={st.positions}>
                {split.map((pct, i) => {
                  const up = stepSplit(split, i, 1), down = stepSplit(split, i, -1);
                  return (
                    <li key={i} data-place={i + 1} data-zero={pct === 0 || undefined}>
                      <span className={st.place}>{i < 3 && <Medal place={i + 1} />}{t("group.placeN", { n: i + 1 })}</span>
                      <span className={st.posMoney} dir="ltr">{euros(Math.round((money.prize * pct) / 100))}</span>
                      <div className={st.pctStepper}>
                        <button type="button" aria-label={t("group.lessShare", { n: i + 1 })} disabled={!down} onClick={() => down && setShares(down)}>−</button>
                        <output dir="ltr" aria-live="polite">{pct} %</output>
                        <button type="button" aria-label={t("group.moreShare", { n: i + 1 })} disabled={!up} onClick={() => up && setShares(up)}>+</button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {split.length > 1 && <p className={`${st.hint} ${st.splitHint}`}>{t("group.splitHint")}</p>}
            </details>
          </li>}
        </ol>
        {/* v181: no simulated rivals any more — a competition starts once someone else has joined. */}
        {players < 2 && <p className={st.hint} role="status">{t(offline ? "group.needRivals" : "group.needPlayers")}</p>}
        <button className={st.primary} type="button" disabled={players < 2 || !affordable || unavailableModalities.includes(kind)}
          onClick={() => onCreateCompetition(buildConfig())}>
          {offline || entryMinor === 0 ? t("group.startFree") : t("group.payAndStart", { amount: euros(entryMinor) })}
        </button>
      </div>

      {bottom}

      {sheetOpen && (
        <div className={st.backdrop} onClick={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}>
          <div className={st.sheet} role="dialog" aria-modal="true" aria-labelledby="groupShareTitle" ref={sheetRef}>
            <div className={st.sheetHead}>
              <strong id="groupShareTitle">{t("group.shareTitle")}</strong>
              <button type="button" className={st.close} aria-label={t("common.close")} onClick={() => setSheetOpen(false)}><UiIcon name="close" size={18} /></button>
            </div>
            <div className={st.apps}>
              {SHARE_TARGETS.map((target) => (
                <a key={target.id} href={target.href(shareText, inviteLink())} target="_blank" rel="noopener noreferrer" style={{ "--tone": target.tone } as CSSProperties}
                  onClick={() => setSheetOpen(false)}>
                  <span className={st.appIcon}><UiIcon name={target.icon} size={22} /></span>
                  <span>{target.label}</span>
                </a>
              ))}
              <button type="button" style={{ "--tone": "#f0d28f" } as CSSProperties} onClick={() => { void copyText(inviteLink(), "link"); setSheetOpen(false); }}>
                <span className={st.appIcon}><UiIcon name="link" size={22} /></span>
                <span>{t("group.shareCopy")}</span>
              </button>
              {canNativeShare && (
                <button type="button" style={{ "--tone": "#cfc8bb" } as CSSProperties} onClick={() => void shareMore()}>
                  <span className={st.appIcon}><UiIcon name="grid" size={22} /></span>
                  <span>{t("group.shareMore")}</span>
                </button>
              )}
            </div>
            <p className={st.link} dir="ltr">{inviteLink()}</p>
          </div>
        </div>
      )}
    </section>
  );
}
