"use client";
/*
 * Groups (v128, reworked v166, black and gold v167): create or join a group, invite through one share button, set up
 * a competition in three numbered steps — format, games picked from their covers (a league or a tournament plays
 * several in the order chosen), entry and prizes — and play it through. The rules live in lib/groupCompetition.ts
 * (pure); this screen only collects the choices and shows the state. Its look is self-contained in
 * GroupHub.module.css (no shared group classes from globals.css).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClosedGroup } from "@/lib/groupPlay";
import { defaultSplit, groupMoney, groupStandings, nextGroupMatch, RANDOM_GAME, stepSplit, type GroupCompetition, type GroupConfig, type GroupFormat } from "@/lib/groupCompetition";
import { GAMES } from "@/lib/games";
import { COIN_SYMBOL, formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { portraitSrc } from "@/lib/avatars";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import st from "./GroupHub.module.css";

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
  /** v171: rename the group or set its picture (a small data URL made from a phone photo). */
  onUpdateGroup: (patch: { name?: string; image?: string | null }) => void;
};
type Kind = "single" | "league" | "tournament";

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
/** Search: case and accents ignored. */
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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

export default function GroupHub({ joinError, group, competition, balance, playerName, avatarSrc, initialJoinCode = "", onCreateGroup, onJoinGroup, onCreateCompetition, onPlay, onVote, onClearCompetition, onUpdateGroup }: Props) {
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
  /** v167/v168: the games picked, in play order; the same game may appear several times (a league or a tournament
   * plays them round by round). Empty = random mix. */
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState("5");
  const [rounds, setRounds] = useState(5);
  /** v171: Eliminatorias — players knocked out per round. */
  const [knockout, setKnockout] = useState(1);
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
    setKind(next);
    if (next === "single") setPicked((list) => list.slice(0, 1));
  }
  /** Single match: tap picks or unpicks the one game. League and tournament: every tap adds the game to the end of the
   * order (repeats allowed, up to MAX_SEQUENCE); the small cross on a picked tile removes its last occurrence. */
  function tapGame(id: string) {
    setPicked((list) => kind === "single" ? (list[0] === id ? [] : [id]) : list.length >= MAX_SEQUENCE ? list : [...list, id]);
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
          <span className={st.kicker}>{t("group.heroTag")}</span>
          <h1 className={st.heroTitle}>{t("group.heroTitle")}</h1>
          <p className={st.heroLead}>{t("group.heroLead")}</p>
        </div>

        <div className={st.choice} role="tablist" aria-label={t("group.entryTabs")}>
          <button type="button" role="tab" aria-selected={entryMode === "create"} onClick={() => setEntryMode("create")}>
            <UiIcon name="plus" size={20} />
            <span>{t("group.create")}</span>
          </button>
          <button type="button" role="tab" aria-selected={entryMode === "join"} onClick={() => setEntryMode("join")}>
            <UiIcon name="enter" size={20} mirrorRtl />
            <span>{t("group.join")}</span>
          </button>
        </div>

        {entryMode === "create" ? (
          <div className={st.panel}>
            <div className={st.creator}>
              <img src={avatarSrc} alt="" />
              <div>
                <small>{t("group.creatorLabel")}</small>
                <strong>{playerName || t("common.you")}</strong>
              </div>
            </div>
            <button className={st.primary} type="button"
              onClick={() => onCreateGroup(playerName ? t("group.defaultName", { name: playerName }) : t("group.myGroup"), 0)}>
              {t("group.createButton")}
            </button>
          </div>
        ) : (
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

  const entryMinor = Math.max(0, Math.round(Number(entry.replace(",", ".")) * 100) || 0);
  const format: GroupFormat = kind === "league" ? (duels ? "league-duels" : "league-rounds") : kind;
  // Fewer players than the chosen paid places: back to the default for as many places as the group allows.
  const split = shares && shares.length === Math.max(1, players) ? shares : defaultSplit(players);
  const paidSplit = split.filter((x) => x > 0);
  const maxKnockout = Math.max(1, players - 1);
  const money = groupMoney({ config: { entryMinor } as GroupConfig, players: group.members });
  const affordable = entryMinor <= Math.round(balance * 100);
  const chosen = kind === "single" ? picked.slice(0, 1) : picked;
  function buildConfig(): GroupConfig {
    // Nothing picked: every round is a surprise. Random slots are drawn when their round starts (lib/groupCompetition).
    const ids = chosen.length ? [...chosen] : [RANDOM_GAME];
    return {
      format, entryMinor, split: [...split], gameIds: ids,
      ...(ids.includes(RANDOM_GAME) ? { randomPool: playable.map((g) => g.id) } : {}),
      ...(kind === "tournament" ? { eliminatePerRound: Math.min(knockout, maxKnockout) } : {}),
      lowerWinsGameIds: playable.filter((g) => g.resultMetric === "reaction-time-ms").map((g) => g.id),
      end: { kind: "rounds", rounds: kind === "league" ? rounds : 1 },
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
      <button type="button" className={st.groupPic} onClick={() => photoRef.current?.click()} aria-label={t(group.image ? "group.photoChange" : "group.photoAdd")}>
        {group.image ? <img src={group.image} alt="" /> : <UiIcon name="group" size={24} />}
        <span className={st.groupPicBadge} aria-hidden="true"><UiIcon name="camera" size={12} /></span>
      </button>
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
    </div>
  );
  const feedback = (
    <div className={st.feedback} role="status" aria-live="polite">
      {photoError || shareError || (copied === "code" ? t("group.codeCopiedMsg") : copied === "link" ? t("group.linkCopiedMsg") : "")}
      {shareFallback && <input aria-label={t("group.copyManual")} value={shareFallback} readOnly onFocus={(event) => event.target.select()} />}
    </div>
  );

  /** v175: only what each player can win and what the platform keeps, in large type. */
  const prizeBox = (prize: number, commission: number) => (
    <dl className={st.prizeBox}>
      <dt>{t("group.prizes")}</dt>
      <dd dir="ltr">{euros(prize)}</dd>
      <dt>{t("group.commission")}</dt>
      <dd dir="ltr" className={st.fee}>{euros(commission)}</dd>
    </dl>
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
    const pot = groupMoney(competition);
    return (
      <section className={st.screen}>
        {header}
        {feedback}
        <div className={st.panel}>
          <div className={st.compTitle}>
            <strong>{t(tournament ? "group.tournament" : competition.config.format === "single" ? "group.singleMatch" : "group.league")}</strong>
            <span>{competition.finished ? t("group.finished") : t(tournament ? "group.roundN" : "group.matchdayN", { n: round })}</span>
          </div>
          {prizeBox(pot.prize, pot.commission)}
          <ol className={st.standings} aria-label={t("group.standings")}>
            {standings.map((s) => {
              const p = competition.players.find((x) => x.id === s.id)!;
              return (
                <li key={s.id} data-you={s.id === you || undefined} data-out={s.out || undefined}>
                  <b>{s.place}</b>
                  <img src={p.avatar} alt="" />
                  <span>{p.name}</span>
                  <em>{competition.payouts ? (competition.payouts[s.id] ? `+${euros(competition.payouts[s.id])}` : "—") : s.out ? t("group.out") : tournament ? "" : t("group.winsShort", { n: s.wins })}</em>
                </li>
              );
            })}
          </ol>
          {competition.finished ? (
            <button className={st.primary} type="button" onClick={onClearCompetition}>{t("group.newCompetition")}</button>
          ) : match ? (
            <button className={st.primary} type="button" onClick={onPlay}>
              {t("group.playNext", { game: game ? gameName(game) : match.gameId })}{opponent ? ` · ${t("group.vs", { name: nameOf(opponent) })}` : ""}
            </button>
          ) : (
            <p className={st.note} role="status">{t("group.waitingRound")}</p>
          )}
          {voting && (
            <button className={st.secondary} type="button" disabled={voted} onClick={onVote}>
              {voted ? t("group.voted", { n: competition.votes.length, total: competition.players.length }) : t("group.voteEnd")}
            </button>
          )}
          <p className={st.note}>{t("group.resume")}</p>
        </div>
      </section>
    );
  }

  const seg = <T extends string | boolean>(value: T, current: T, set: (v: T) => void, label: string, sub?: string) => (
    <button type="button" aria-pressed={value === current} onClick={() => set(value)}>
      <strong>{label}</strong>{sub ? <span>{sub}</span> : null}
    </button>
  );
  const shareText = t("group.shareText", { name: group.name, code: group.code });
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const multi = kind !== "single";
  /** v175: «Aleatorio» is one more game: it can be picked, repeated and ordered like the others. */
  const tiles = [{ id: RANDOM_GAME, name: t("group.randomMix"), cover: "" }, ...playable.map((g) => ({ id: g.id, name: gameName(g), cover: g.cover }))]
    .filter((tile) => !query.trim() || fold(tile.name).includes(fold(query.trim())));
  return (
    <section className={st.screen}>
      {header}
      {feedback}

      <div className={st.panel}>
        <div className={st.panelHead}>
          <h2>{t("group.inviteTitle")}</h2>
          <small>{players === 1 ? t("group.playersOne") : t("group.playersCount", { n: players })}</small>
        </div>
        <ul className={st.members} aria-label={t("group.members")}>
          {group.members.map((member) => (
            <li key={member.id} data-you={member.isYou || undefined}>
              <img src={member.avatar} alt="" />
              <span>{member.isYou ? t("common.you") : member.name}</span>
            </li>
          ))}
        </ul>
        <button type="button" className={st.secondary} aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <UiIcon name="share" size={18} />
          <span>{t("group.share")}</span>
        </button>
      </div>

      <div className={st.panel}>
        <h2 className={st.formTitle}>{t("group.newTitle")}</h2>
        <ol className={st.steps}>
          <li>
            <span className={`${st.stepLabel} ${st.sc}`}>{t("group.format")}</span>
            <div className={st.seg3}>
              {seg<Kind>("single", kind, chooseKind, t("group.singleMatch"))}
              {seg<Kind>("league", kind, chooseKind, t("group.league"))}
              {seg<Kind>("tournament", kind, chooseKind, t("group.tournament"))}
            </div>
            {kind === "league" && (
              <div className={st.sub}>
                <span className={st.subLabel}>{t("group.leagueMode")}</span>
                <div className={st.seg2}>
                  {seg(false, duels, setDuels, t("group.modeRounds"))}
                  {seg(true, duels, setDuels, t("group.modeDuels"))}
                </div>
                <span className={st.subLabel}>{t("group.end")}</span>
                <div className={st.counter}>
                  <span>{t("group.roundsCount")}</span>
                  <div className={st.stepper}>
                    <button type="button" aria-label={t("group.lessRounds")} disabled={rounds <= 1} onClick={() => setRounds((n) => Math.max(1, n - 1))}>−</button>
                    <output aria-live="polite">{rounds}</output>
                    <button type="button" aria-label={t("group.moreRounds")} disabled={rounds >= 30} onClick={() => setRounds((n) => Math.min(30, n + 1))}>+</button>
                  </div>
                </div>
              </div>
            )}
            {kind === "tournament" && (
              <div className={st.sub}>
                <div className={st.counter}>
                  <span>{t("group.knockoutPerRound")}</span>
                  <div className={st.stepper}>
                    <button type="button" aria-label={t("group.lessKnockout")} disabled={knockout <= 1} onClick={() => setKnockout((n) => Math.max(1, n - 1))}>−</button>
                    <output aria-live="polite">{Math.min(knockout, maxKnockout)}</output>
                    <button type="button" aria-label={t("group.moreKnockout")} disabled={knockout >= maxKnockout} onClick={() => setKnockout((n) => Math.min(maxKnockout, n + 1))}>+</button>
                  </div>
                </div>
              </div>
            )}
          </li>
          <li>
            <span className={st.stepLabel}>{t(multi ? "group.stepGames" : "group.stepGame")}</span>
            <label className={st.search}>
              <UiIcon name="search" size={18} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("group.searchGames")} aria-label={t("group.searchGames")} enterKeyHint="search" />
            </label>
            <div className={st.games} role="group" aria-label={t(multi ? "group.stepGames" : "group.stepGame")}>
              {tiles.map(({ id, name, cover }) => {
                const numbers = chosen.flatMap((x, i) => (x === id ? [i + 1] : []));
                const label = numbers.length > 3 ? `${numbers.slice(0, 2).join(" ")} +${numbers.length - 2}` : numbers.join(" ");
                return (
                  <div key={id} className={st.tileWrap}>
                    <button type="button" className={st.gameTile} aria-pressed={numbers.length > 0} onClick={() => tapGame(id)}
                      aria-label={numbers.length ? `${name} · ${numbers.join(", ")}` : name}>
                      {cover ? <span className={st.gameArt}><img src={cover} alt="" loading="lazy" decoding="async" /></span>
                        : <span className={st.gameArt} data-random><UiIcon name="dice" size={26} /></span>}
                      <span className={st.gameMark} data-wide={numbers.length > 1 || undefined} aria-hidden="true">{!numbers.length ? null : multi ? label : <UiIcon name="check" size={12} />}</span>
                      <span className={st.gameName}>{name}</span>
                    </button>
                    {numbers.length > 0 && (
                      <span className={st.unpickLayer}>
                        <button type="button" className={st.unpick} onClick={() => unpick(id)}
                          aria-label={t("group.removeFromSequence", { game: name, n: numbers[numbers.length - 1] })}><UiIcon name="close" size={10} /></button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {!tiles.length && <p className={st.hint}>{t("group.noGamesFound")}</p>}
            <p className={st.hint}>{multi ? (chosen.length ? "" : t("group.gamesPickHint")) : chosen.length ? "" : t("group.pickOne")}</p>
          </li>
          <li>
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
          </li>
        </ol>
        {/* v181: no simulated rivals any more — a competition starts once someone else has joined. */}
        {players < 2 && <p className={st.hint} role="status">{t("group.needPlayers")}</p>}
        <button className={st.primary} type="button" disabled={players < 2 || !affordable || (kind === "single" && chosen.length === 0)}
          onClick={() => onCreateCompetition(buildConfig())}>
          {t("group.payAndStart", { amount: euros(entryMinor) })}
        </button>
      </div>

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
