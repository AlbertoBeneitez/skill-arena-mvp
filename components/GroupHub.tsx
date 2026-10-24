"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClosedGroup,
  CompetitionType,
  GroupCompetitionConfig,
  PotDistribution,
} from "@/lib/groupPlay";
import {
  groupPot,
  maxUsefulPayout,
  payoutLabel,
} from "@/lib/groupPlay";
import { createRng } from "@/lib/deterministic/seeded";
import { GAMES, type GameMeta } from "@/lib/games";
import { formatMoney, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";

type Props = {
  group: ClosedGroup | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  initialJoinCode?: string;
  onCreateGroup: (name: string, stake: number) => void;
  onJoinGroup: (code: string) => void;
  onSetStake: (stake: number) => void;
  onStartCompetition: (
    game: GameMeta,
    config: GroupCompetitionConfig
  ) => void;
};

type EntryMode = "create" | "join";
type GameSelectionMode = "manual" | "random";

function moneyValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100) / 100);
}

function integerValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeJoinCode(value: string) {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const code = url.searchParams.get("join");
      if (code) {
        return code
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 12);
      }
    } catch {
      // Fall through to plain-code normalization.
    }
  }

  return trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export default function GroupHub({
  group,
  balance,
  playerName,
  avatarSrc,
  initialJoinCode = "",
  onCreateGroup,
  onJoinGroup,
  onSetStake,
  onStartCompetition,
}: Props) {
  useI18n();
  const [entryMode, setEntryMode] = useState<EntryMode>(
    initialJoinCode ? "join" : "create"
  );
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const mountedRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [competitionType, setCompetitionType] =
    useState<CompetitionType>("quick");
  const [entryPrice, setEntryPrice] = useState("5");
  const [leagueRoundsInput, setLeagueRoundsInput] = useState("5");
  const [eliminatedInput, setEliminatedInput] = useState("1");
  const [distribution, setDistribution] =
    useState<PotDistribution>("winner-takes-all");

  const [selectedGameId, setSelectedGameId] =
    useState<GameMeta["id"]>(GAMES[0].id);

  const [leagueGameMode, setLeagueGameMode] =
    useState<GameSelectionMode>("manual");
  const [leagueGameIds, setLeagueGameIds] = useState<
    GameMeta["id"][]
  >([]);

  const [tournamentGameMode, setTournamentGameMode] =
    useState<GameSelectionMode>("manual");
  const [tournamentGameIds, setTournamentGameIds] = useState<
    GameMeta["id"][]
  >([]);

  const [ready, setReady] = useState(false);

  const playableGames = useMemo(
    () => GAMES.filter((game) => game.enabled),
    []
  );

  const selectedGame =
    playableGames.find((game) => game.id === selectedGameId) ??
    playableGames[0];

  const entryPriceNumber = moneyValue(entryPrice);
  const leagueRounds = integerValue(leagueRoundsInput);
  const eliminatedPerRound = integerValue(eliminatedInput);

  const maxEliminated = Math.max(
    0,
    (group?.members.length ?? 1) - 2
  );

  const tournamentRounds =
    group && eliminatedPerRound >= 1
      ? Math.max(
          1,
          Math.ceil(
            (group.members.length - 1) /
              eliminatedPerRound
          )
        )
      : 0;

  const payoutOptions = group
    ? maxUsefulPayout(group)
    : (["winner-takes-all"] as PotDistribution[]);

  const pot = group
    ? groupPot(group, entryPriceNumber)
    : 0;

  const leagueRulesValid =
    competitionType !== "league" ||
    (leagueRounds >= 1 && leagueRounds <= 50);

  const leagueScheduleComplete =
    competitionType !== "league" ||
    leagueGameMode === "random" ||
    (leagueRounds >= 1 &&
      leagueGameIds.length === leagueRounds);

  const tournamentRulesValid =
    competitionType !== "tournament" ||
    (eliminatedPerRound >= 1 &&
      eliminatedPerRound <= maxEliminated);

  const tournamentScheduleComplete =
    competitionType !== "tournament" ||
    tournamentGameMode === "random" ||
    (tournamentRounds >= 1 &&
      tournamentGameIds.length === tournamentRounds);

  const rawPrice = Number(entryPrice.replace(",", "."));
  const priceValid =
    entryPrice.trim() !== "" &&
    Number.isFinite(rawPrice) &&
    rawPrice >= 0 &&
    rawPrice <= balance;
  const configurationHint = !priceValid
    ? t("group.hintPrice", { max: formatMoney(balance) })
    : !leagueRulesValid
      ? t("group.hintRounds")
      : !leagueScheduleComplete
        ? t("group.hintLeagueMissing", { n: Math.max(0, leagueRounds - leagueGameIds.length) })
        : !tournamentRulesValid
          ? t("group.hintEliminated", { max: maxEliminated })
          : !tournamentScheduleComplete
            ? t("group.hintTournamentMissing", { n: Math.max(0, tournamentRounds - tournamentGameIds.length) })
            : t("group.hintComplete");

  const allMembersReady = Boolean(
    group &&
      ready &&
      group.members.length > 1 &&
      priceValid &&
      leagueRulesValid &&
      leagueScheduleComplete &&
      tournamentRulesValid &&
      tournamentScheduleComplete
  );

  useEffect(() => {
    if (!initialJoinCode || group) return;

    setEntryMode("join");
    setJoinCode(normalizeJoinCode(initialJoinCode));
  }, [group, initialJoinCode]);

  useEffect(() => {
    if (leagueGameMode !== "manual") return;

    setLeagueGameIds((current) =>
      current.slice(0, Math.max(0, leagueRounds))
    );
  }, [leagueGameMode, leagueRounds]);

  useEffect(() => {
    if (tournamentGameMode !== "manual") return;

    setTournamentGameIds((current) =>
      current.slice(0, Math.max(0, tournamentRounds))
    );
  }, [tournamentGameMode, tournamentRounds]);

  function buildRandomSchedule(
    scope: "league" | "tournament",
    count: number
  ) {
    if (!group || count < 1 || !playableGames.length) {
      return [] as GameMeta["id"][];
    }

    const rng = createRng(
      `${group.code}:${scope}:${count}:${entryPriceNumber}:hidden-games`
    );

    return Array.from({ length: count }, () => {
      return playableGames[
        rng.nextInt(playableGames.length)
      ].id;
    });
  }

  async function copyShare(value: string, kind: "code" | "link") {
    setShareError("");
    setShareFallback("");
    setCopiedCode(false);
    setCopiedLink(false);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      if (!mountedRef.current) return;
      setCopiedCode(kind === "code");
      setCopiedLink(kind === "link");
      copyTimerRef.current = setTimeout(() => {
        setCopiedCode(false);
        setCopiedLink(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      if (!mountedRef.current) return;
      setShareError(t("group.copyFailed"));
      setShareFallback(value);
    }
  }

  function copyCode() {
    if (group) void copyShare(group.code, "code");
  }

  function copyInviteLink() {
    if (!group) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("join", group.code);
    url.hash = "group";
    void copyShare(url.toString(), "link");
  }

  function submitJoin() {
    const code = normalizeJoinCode(joinCode);
    if (code.length < 4) return;

    setJoinCode(code);
    onJoinGroup(code);
  }

  function chooseCompetition(next: CompetitionType) {
    setCompetitionType(next);
    setReady(false);

    if (next === "quick") {
      setDistribution("winner-takes-all");
    }
  }

  function changePrice(value: string) {
    setEntryPrice(value);
    setReady(false);
    onSetStake(moneyValue(value));
  }

  function chooseSingleGame(id: GameMeta["id"]) {
    setSelectedGameId(id);
    setReady(false);
  }

  function appendLeagueGame(id: GameMeta["id"]) {
    if (
      leagueGameMode !== "manual" ||
      leagueRounds < 1 ||
      leagueGameIds.length >= leagueRounds
    ) {
      return;
    }

    setLeagueGameIds((current) => [...current, id]);
    setReady(false);
  }

  function appendTournamentGame(id: GameMeta["id"]) {
    if (
      tournamentGameMode !== "manual" ||
      tournamentRounds < 1 ||
      tournamentGameIds.length >= tournamentRounds
    ) {
      return;
    }

    setTournamentGameIds((current) => [...current, id]);
    setReady(false);
  }

  function buildConfig(): GroupCompetitionConfig {
    if (competitionType === "league") {
      const gameIds =
        leagueGameMode === "random"
          ? buildRandomSchedule("league", leagueRounds)
          : leagueGameIds;

      return {
        type: "league",
        stake: entryPriceNumber,
        rounds: leagueRounds,
        distribution,
        gameSelectionMode: leagueGameMode,
        gameIds,
      };
    }

    if (competitionType === "tournament") {
      const gameIds =
        tournamentGameMode === "random"
          ? buildRandomSchedule(
              "tournament",
              tournamentRounds
            )
          : tournamentGameIds;

      return {
        type: "tournament",
        stake: entryPriceNumber,
        eliminatedPerRound,
        distribution,
        gameSelectionMode: tournamentGameMode,
        gameIds,
      };
    }

    return {
      type: "quick",
      stake: entryPriceNumber,
      distribution: "winner-takes-all",
      gameIds: [selectedGame.id],
    };
  }

  function startCompetition() {
    if (!group || !allMembersReady) return;

    const config = buildConfig();
    const firstGameId = config.gameIds[0];
    const firstGame =
      playableGames.find((game) => game.id === firstGameId) ??
      selectedGame;

    onStartCompetition(firstGame, config);
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

  return (
    <section className="groupScreen">
      <div className="groupHeaderCard groupHeaderSinglePage">
        <div>
          <small>{t("group.local")}</small>
          <h1>{group.name}</h1>
        </div>
        <span className="groupCodeBadge">{group.code}</span>
      </div>

      <ol className="groupStepper" aria-label={t("group.steps")}>
        {[
          { label: t("group.stepCreate"), done: true },
          { label: t("group.stepInvite"), done: group.members.length > 1 || copiedCode || copiedLink },
          { label: t("group.stepRules"), done: priceValid && leagueRulesValid && leagueScheduleComplete && tournamentRulesValid && tournamentScheduleComplete },
          { label: t("group.stepPlay"), done: allMembersReady },
        ].map((step, index, all) => {
          const current = !step.done && all.slice(0, index).every((x) => x.done);
          return (
            <li key={step.label} className={step.done ? "done" : current ? "current" : ""} aria-current={current ? "step" : undefined}>
              <b>{step.done ? "✓" : index + 1}</b>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="groupNextStep" role="status">
        {group.members.length < 2 && !copiedCode && !copiedLink
          ? t("group.nextInvite")
          : !allMembersReady
            ? configurationHint
            : t("group.allReady")}
      </p>
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

      <div className="groupMatchSetupHead">
        <small>{t("group.newCompetition")}</small>
        <h1>{t("group.defineRules")}</h1>
      </div>

      <div className="competitionTypeGrid">
        <button
          type="button"
          className={
            competitionType === "quick" ? "active" : ""
          }
          onClick={() => chooseCompetition("quick")}
        >
          <strong>{t("group.quick")}</strong>
          <span>{t("group.quickSub")}</span>
        </button>

        <button
          type="button"
          className={
            competitionType === "league" ? "active" : ""
          }
          onClick={() => chooseCompetition("league")}
        >
          <strong>{t("group.league")}</strong>
          <span>{t("group.leagueSub")}</span>
        </button>

        <button
          type="button"
          className={
            competitionType === "tournament"
              ? "active"
              : ""
          }
          onClick={() => chooseCompetition("tournament")}
        >
          <strong>{t("group.tournament")}</strong>
          <span>{t("group.tournamentSub")}</span>
        </button>
      </div>

      <div className="competitionConfigCard numericConfigCard">
        <label>
          <span>{t("group.entryPrice")}</span>
          <div className="numberInputWithUnit">
            <input
              type="number"
              min="0"
              max={balance}
              step="0.5"
              inputMode="decimal"
              value={entryPrice}
              onChange={(event) =>
                changePrice(event.target.value)
              }
            />
            <b>€</b>
          </div>
        </label>
        <small>{t("group.available", { amount: formatMoney(balance) })}</small>
      </div>

      {competitionType === "league" && (
        <>
          <div className="competitionConfigCard numericConfigCard">
            <label>
              <span>{t("group.rounds")}</span>
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                inputMode="numeric"
                value={leagueRoundsInput}
                onChange={(event) => {
                  setLeagueRoundsInput(event.target.value);
                  setReady(false);
                }}
              />
            </label>
            <small>{t("group.roundsHint")}</small>
          </div>

          <div className="competitionConfigCard">
            <span>{t("group.leagueGames")}</span>

            <div className="leagueModeToggle">
              <button
                type="button"
                className={
                  leagueGameMode === "manual"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setLeagueGameMode("manual");
                  setLeagueGameIds([]);
                  setReady(false);
                }}
              >
                {t("group.pickGames")}
              </button>

              <button
                type="button"
                className={
                  leagueGameMode === "random"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setLeagueGameMode("random");
                  setReady(false);
                }}
              >
                {t("group.random")}
              </button>
            </div>

            {leagueGameMode === "manual" ? (
              <>
                <div className="leagueScheduleStatus">
                  <strong>
                    {leagueGameIds.length}/{leagueRounds || 0}
                  </strong>
                  <span>{t("group.leaguePickHint")}</span>
                </div>

                <div className="groupGameGrid selectionMode leaguePickGrid">
                  {playableGames.map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      disabled={
                        leagueRounds < 1 ||
                        leagueGameIds.length >= leagueRounds
                      }
                      onClick={() =>
                        appendLeagueGame(game.id)
                      }
                    >
                      <img src={game.cover} alt="" />
                      <strong>{gameName(game)}</strong>
                    </button>
                  ))}
                </div>

                {leagueGameIds.length > 0 && (
                  <button
                    type="button"
                    className="secondaryScheduleAction"
                    onClick={() => {
                      setLeagueGameIds((current) =>
                        current.slice(0, -1)
                      );
                      setReady(false);
                    }}
                  >
                    {t("group.deleteLast")}
                  </button>
                )}

                <div className="leagueScheduleList">
                  {Array.from({
                    length: Math.max(0, leagueRounds),
                  }).map((_, index) => {
                    const gameId = leagueGameIds[index];
                    const game = playableGames.find(
                      (item) => item.id === gameId
                    );

                    return (
                      <div
                        key={index}
                        className={game ? "filled" : ""}
                      >
                        <span>{t("group.matchdayShort", { n: index + 1 })}</span>
                        <strong>
                          {game ? gameName(game) : t("common.pending")}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="hiddenGameSchedule">
                <span>🎲</span>
                <strong>{t("group.hiddenGames")}</strong>
              </div>
            )}
          </div>
        </>
      )}

      {competitionType === "tournament" && (
        <>
          <div className="competitionConfigCard numericConfigCard">
            <label>
              <span>{t("group.eliminated")}</span>
              <input
                type="number"
                min="1"
                max={maxEliminated}
                step="1"
                inputMode="numeric"
                value={eliminatedInput}
                onChange={(event) => {
                  setEliminatedInput(event.target.value);
                  setReady(false);
                }}
              />
            </label>

            <small>{t("group.eliminatedHint", { players: group.members.length, max: maxEliminated })}</small>
          </div>

          <div className="competitionConfigCard">
            <span>{t("group.tournamentGames")}</span>

            <div className="leagueModeToggle">
              <button
                type="button"
                className={
                  tournamentGameMode === "manual"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setTournamentGameMode("manual");
                  setTournamentGameIds([]);
                  setReady(false);
                }}
              >
                {t("group.pickGames")}
              </button>

              <button
                type="button"
                className={
                  tournamentGameMode === "random"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setTournamentGameMode("random");
                  setReady(false);
                }}
              >
                {t("group.random")}
              </button>
            </div>

            {tournamentGameMode === "manual" ? (
              <>
                <div className="leagueScheduleStatus">
                  <strong>
                    {tournamentGameIds.length}/{tournamentRounds || 0}
                  </strong>
                  <span>{t("group.tournamentPickHint")}</span>
                </div>

                <div className="groupGameGrid selectionMode leaguePickGrid">
                  {playableGames.map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      disabled={
                        tournamentRounds < 1 ||
                        tournamentGameIds.length >=
                          tournamentRounds
                      }
                      onClick={() =>
                        appendTournamentGame(game.id)
                      }
                    >
                      <img src={game.cover} alt="" />
                      <strong>{gameName(game)}</strong>
                    </button>
                  ))}
                </div>

                {tournamentGameIds.length > 0 && (
                  <button
                    type="button"
                    className="secondaryScheduleAction"
                    onClick={() => {
                      setTournamentGameIds((current) =>
                        current.slice(0, -1)
                      );
                      setReady(false);
                    }}
                  >
                    {t("group.deleteLast")}
                  </button>
                )}

                <div className="leagueScheduleList">
                  {Array.from({
                    length: Math.max(0, tournamentRounds),
                  }).map((_, index) => {
                    const gameId = tournamentGameIds[index];
                    const game = playableGames.find(
                      (item) => item.id === gameId
                    );

                    return (
                      <div
                        key={index}
                        className={game ? "filled" : ""}
                      >
                        <span>{t("group.roundShort", { n: index + 1 })}</span>
                        <strong>
                          {game ? gameName(game) : t("common.pending")}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="hiddenGameSchedule">
                <span>🎲</span>
                <strong>{t("group.hiddenGames")}</strong>
              </div>
            )}
          </div>
        </>
      )}

      {competitionType === "quick" && (
        <>
          <div className="groupSectionTitle groupGameTitle">
            <span>{t("group.chooseGame")}</span>
            <small>{t("group.singleMatch")}</small>
          </div>

          <div className="groupGameGrid selectionMode">
            {playableGames.map((game) => (
              <button
                key={game.id}
                type="button"
                className={
                  selectedGameId === game.id
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  chooseSingleGame(game.id)
                }
              >
                <img src={game.cover} alt="" />
                <strong>{gameName(game)}</strong>
              </button>
            ))}
          </div>
        </>
      )}

      {competitionType !== "quick" && (
        <div className="competitionConfigCard">
          <span>{t("group.split")}</span>

          <div className="payoutOptionList">
            {payoutOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  distribution === option
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setDistribution(option);
                  setReady(false);
                }}
              >
                {payoutLabel(option)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="groupMatchSummary">
        <div>
          <span>{t("group.players")}</span>
          <strong>{group.members.length}</strong>
        </div>
        <div>
          <span>{t("group.pot")}</span>
          <strong dir="ltr">{pot === 0 ? "—" : formatMoney(pot)}</strong>
        </div>
      </div>

      <div className="readyRoomCard">
        <div className="groupSectionTitle">
          <span>{t("group.prep")}</span>
          <small>
            {t("group.readyCount", { n: ready ? group.members.length : group.members.length - 1, total: group.members.length })}
          </small>
        </div>

        <div className="readyMemberList">
          {group.members.map((member) => {
            const memberReady = !member.isYou || ready;

            return (
              <div key={member.id}>
                <img src={member.avatar} alt="" />
                <strong>{member.name}</strong>
                <span className={memberReady ? "ready" : ""}>
                  {memberReady
                    ? member.isYou
                      ? t("common.ready")
                      : t("common.simulated")
                    : t("common.pending")}
                </span>
              </div>
            );
          })}
        </div>

        <p className="groupConfigurationHint" role="status" aria-live="polite">
          {configurationHint}
        </p>
        <button
          className={`readyToggle ${ready ? "ready" : ""}`}
          type="button"
          disabled={
            !priceValid ||
            !leagueRulesValid ||
            !leagueScheduleComplete ||
            !tournamentRulesValid ||
            !tournamentScheduleComplete
          }
          onClick={() =>
            setReady((value) => !value)
          }
        >
          {ready ? t("group.youReady") : t("group.imReady")}
        </button>

        <button
          className="groupPrimaryAction"
          type="button"
          disabled={!allMembersReady}
          onClick={startCompetition}
        >
          {competitionType === "quick"
            ? t("group.startQuick")
            : competitionType === "league"
              ? t("group.startLeague")
              : t("group.startTournament")}
        </button>
      </div>
    </section>
  );
}
