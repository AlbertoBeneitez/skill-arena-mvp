"use client";

import { useEffect, useMemo, useState } from "react";
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

type Props = {
  group: ClosedGroup | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  onCreateGroup: (name: string, stake: number) => void;
  onSetStake: (stake: number) => void;
  onStartCompetition: (
    game: GameMeta,
    config: GroupCompetitionConfig
  ) => void;
};

type GroupTab = "group" | "create-match";
type LeagueGameMode = "manual" | "random";

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

export default function GroupHub({
  group,
  balance,
  playerName,
  avatarSrc,
  onCreateGroup,
  onSetStake,
  onStartCompetition,
}: Props) {
  const [draftName, setDraftName] = useState("Mi grupo");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<GroupTab>("group");

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
    useState<LeagueGameMode>("manual");
  const [leagueGameIds, setLeagueGameIds] = useState<
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
  const rivals = Math.max(0, (group?.members.length ?? 1) - 1);
  const maxEliminated = Math.max(
    0,
    (group?.members.length ?? 1) - 2
  );

  const payoutOptions = group
    ? maxUsefulPayout(group)
    : (["winner-takes-all"] as PotDistribution[]);

  const pot = group
    ? groupPot(group, entryPriceNumber)
    : 0;

  const leagueScheduleComplete =
    competitionType !== "league" ||
    (leagueRounds >= 1 &&
      leagueGameIds.length === leagueRounds);

  const tournamentRulesValid =
    competitionType !== "tournament" ||
    (eliminatedPerRound >= 1 &&
      eliminatedPerRound <= maxEliminated);

  const leagueRulesValid =
    competitionType !== "league" ||
    (leagueRounds >= 1 && leagueRounds <= 50);

  const priceValid =
    entryPriceNumber >= 0 &&
    entryPriceNumber <= balance;

  const allMembersReady = Boolean(
    group &&
      ready &&
      group.members.length > 1 &&
      priceValid &&
      leagueRulesValid &&
      tournamentRulesValid &&
      leagueScheduleComplete
  );

  useEffect(() => {
    if (competitionType !== "league") return;

    if (leagueGameMode === "manual") {
      setLeagueGameIds((current) =>
        current.slice(0, Math.max(0, leagueRounds))
      );
      return;
    }

    if (!group || leagueRounds < 1 || leagueRounds > 50) {
      setLeagueGameIds([]);
      return;
    }

    const rng = createRng(
      `${group.code}:league:${leagueRounds}:games`
    );

    setLeagueGameIds(
      Array.from({ length: leagueRounds }, () => {
        return playableGames[
          rng.nextInt(playableGames.length)
        ].id;
      })
    );
  }, [
    competitionType,
    group,
    leagueGameMode,
    leagueRounds,
    playableGames,
  ]);

  async function copyCode() {
    if (!group) return;

    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
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

    const parsed = moneyValue(value);
    onSetStake(parsed);
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

  function clearLastLeagueGame() {
    setLeagueGameIds((current) => current.slice(0, -1));
    setReady(false);
  }

  function buildConfig(): GroupCompetitionConfig {
    if (competitionType === "league") {
      return {
        type: "league",
        stake: entryPriceNumber,
        rounds: leagueRounds,
        distribution,
        gameSelectionMode: leagueGameMode,
        gameIds: leagueGameIds,
      };
    }

    if (competitionType === "tournament") {
      return {
        type: "tournament",
        stake: entryPriceNumber,
        eliminatedPerRound,
        distribution,
        gameIds: [selectedGame.id],
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
        <div
          className="groupSubtabs"
          role="tablist"
          aria-label="Secciones del grupo"
        >
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="active"
          >
            MI GRUPO
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            title="Crea primero el grupo cerrado"
          >
            CREAR PARTIDA
          </button>
        </div>

        <div className="groupHero">
          <span>GRUPO CERRADO</span>
          <h1>Compite con tu gente</h1>
          <p>
            Crea una sala privada. Las reglas económicas se
            fijan después al crear cada competición.
          </p>
        </div>

        <div className="groupSetupCard">
          <label>
            <span>NOMBRE DEL GRUPO</span>
            <input
              value={draftName}
              maxLength={24}
              onChange={(event) =>
                setDraftName(event.target.value)
              }
              placeholder="Mi grupo"
            />
          </label>

          <div className="groupSetupPreview">
            <img src={avatarSrc} alt="" />
            <div>
              <small>CREADOR</small>
              <strong>{playerName || "TÚ"}</strong>
            </div>
            <b>PRIVADO</b>
          </div>

          <button
            className="groupPrimaryAction"
            type="button"
            onClick={() => onCreateGroup(draftName, 0)}
          >
            CREAR GRUPO CERRADO
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="groupScreen">
      <div
        className="groupSubtabs"
        role="tablist"
        aria-label="Secciones del grupo"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "group"}
          className={tab === "group" ? "active" : ""}
          onClick={() => setTab("group")}
        >
          MI GRUPO
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create-match"}
          className={tab === "create-match" ? "active" : ""}
          onClick={() => setTab("create-match")}
        >
          CREAR PARTIDA
        </button>
      </div>

      {tab === "group" ? (
        <>
          <div className="groupHeaderCard">
            <div>
              <small>GRUPO CERRADO</small>
              <h1>{group.name}</h1>
            </div>
            <button
              type="button"
              onClick={() => void copyCode()}
            >
              {copied ? "COPIADO" : group.code}
            </button>
          </div>

          <div className="groupMembersCard">
            <div className="groupSectionTitle">
              <span>INTEGRANTES</span>
              <small>{group.members.length} JUGADORES</small>
            </div>

            <div className="groupMembers">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className={member.isYou ? "you" : ""}
                >
                  <img src={member.avatar} alt="" />
                  <span>{member.name}</span>
                  {member.isYou && <b>TÚ</b>}
                </div>
              ))}
            </div>
          </div>

          <button
            className="groupPrimaryAction groupCreateMatchShortcut"
            type="button"
            onClick={() => setTab("create-match")}
          >
            CREAR PARTIDA
          </button>
        </>
      ) : (
        <>
          <div className="groupMatchSetupHead">
            <small>NUEVA COMPETICIÓN</small>
            <h1>Define las reglas</h1>
            <p>
              El creador fija formato, entrada y estructura
              antes de que los jugadores confirmen.
            </p>
          </div>

          <div className="competitionTypeGrid">
            <button
              type="button"
              className={
                competitionType === "quick" ? "active" : ""
              }
              onClick={() => chooseCompetition("quick")}
            >
              <strong>PARTIDA RÁPIDA</strong>
              <span>Una partida</span>
            </button>

            <button
              type="button"
              className={
                competitionType === "league" ? "active" : ""
              }
              onClick={() => chooseCompetition("league")}
            >
              <strong>LIGA</strong>
              <span>Varias jornadas</span>
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
              <strong>TORNEO</strong>
              <span>Eliminatorias</span>
            </button>
          </div>

          <div className="competitionConfigCard numericConfigCard">
            <label>
              <span>PRECIO DE ENTRADA POR JUGADOR</span>
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
            <small>
              Máximo disponible: {balance.toFixed(2)}€
            </small>
          </div>

          {competitionType === "league" && (
            <>
              <div className="competitionConfigCard numericConfigCard">
                <label>
                  <span>NÚMERO DE JORNADAS</span>
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
                <small>Entre 1 y 50 jornadas.</small>
              </div>

              <div className="competitionConfigCard">
                <span>JUEGOS DE LA LIGA</span>

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
                    ELEGIR JUEGOS
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
                    ALEATORIO
                  </button>
                </div>

                {leagueGameMode === "manual" && (
                  <>
                    <div className="leagueScheduleStatus">
                      <strong>
                        {leagueGameIds.length}/{leagueRounds || 0}
                      </strong>
                      <span>
                        Pulsa juegos hasta completar todas
                        las jornadas.
                      </span>
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
                          <img
                            src={game.cover}
                            alt={game.name}
                          />
                          <strong>{game.name}</strong>
                        </button>
                      ))}
                    </div>

                    {leagueGameIds.length > 0 && (
                      <button
                        type="button"
                        className="secondaryScheduleAction"
                        onClick={clearLastLeagueGame}
                      >
                        BORRAR ÚLTIMO
                      </button>
                    )}
                  </>
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
                        <span>J{index + 1}</span>
                        <strong>
                          {game?.name ?? "PENDIENTE"}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {competitionType === "tournament" && (
            <div className="competitionConfigCard numericConfigCard">
              <label>
                <span>ELIMINADOS POR RONDA</span>
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

              <small>
                Debe ser menor que jugadores − 1.
                Con {group.members.length} jugadores:
                máximo {maxEliminated}.
              </small>
            </div>
          )}

          {competitionType !== "league" && (
            <>
              <div className="groupSectionTitle groupGameTitle">
                <span>ELIGE JUEGO</span>
                <small>
                  {competitionType === "quick"
                    ? "PARTIDA ÚNICA"
                    : "MISMO JUEGO POR RONDA"}
                </small>
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
                    <img
                      src={game.cover}
                      alt={game.name}
                    />
                    <strong>{game.name}</strong>
                  </button>
                ))}
              </div>
            </>
          )}

          {competitionType !== "quick" && (
            <div className="competitionConfigCard">
              <span>REPARTO DEL BOTE</span>

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
              <span>JUGADORES</span>
              <strong>{group.members.length}</strong>
            </div>
            <div>
              <span>BOTE</span>
              <strong>
                {pot === 0 ? "—" : `${pot.toFixed(2)}€`}
              </strong>
            </div>
          </div>

          <div className="readyRoomCard">
            <div className="groupSectionTitle">
              <span>SALA DE ESPERA</span>
              <small>
                {ready
                  ? `${group.members.length}/${group.members.length} LISTOS`
                  : `${group.members.length - 1}/${group.members.length} LISTOS`}
              </small>
            </div>

            <div className="readyMemberList">
              {group.members.map((member) => {
                const memberReady = !member.isYou || ready;

                return (
                  <div key={member.id}>
                    <img src={member.avatar} alt="" />
                    <strong>{member.name}</strong>
                    <span
                      className={
                        memberReady ? "ready" : ""
                      }
                    >
                      {memberReady
                        ? "LISTO"
                        : "PENDIENTE"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              className={`readyToggle ${ready ? "ready" : ""}`}
              type="button"
              disabled={
                !priceValid ||
                !leagueRulesValid ||
                !tournamentRulesValid ||
                !leagueScheduleComplete
              }
              onClick={() =>
                setReady((value) => !value)
              }
            >
              {ready ? "✓ ESTÁS LISTO" : "ESTOY LISTO"}
            </button>

            <button
              className="groupPrimaryAction"
              type="button"
              disabled={!allMembersReady}
              onClick={startCompetition}
            >
              {competitionType === "quick"
                ? "EMPEZAR PARTIDA"
                : competitionType === "league"
                  ? "EMPEZAR LIGA"
                  : "EMPEZAR TORNEO"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
