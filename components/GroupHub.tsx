"use client";

import { useMemo, useState } from "react";
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
import { GAMES, STAKES, type GameMeta, type Stake } from "@/lib/games";

type Props = {
  group: ClosedGroup | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  onCreateGroup: (name: string, stake: Stake) => void;
  onSetStake: (stake: Stake) => void;
  onStartCompetition: (
    game: GameMeta,
    config: GroupCompetitionConfig
  ) => void;
};

type GroupTab = "group" | "create-match";

const LEAGUE_ROUNDS = [3, 5, 7, 10] as const;
const ELIMINATED_OPTIONS = [1, 2, 3] as const;

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
  const [draftStake, setDraftStake] = useState<Stake>(5);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<GroupTab>("group");

  const [competitionType, setCompetitionType] =
    useState<CompetitionType>("quick");
  const [leagueRounds, setLeagueRounds] = useState(5);
  const [eliminatedPerRound, setEliminatedPerRound] = useState(1);
  const [distribution, setDistribution] =
    useState<PotDistribution>("winner-takes-all");
  const [selectedGameId, setSelectedGameId] = useState(GAMES[0].id);
  const [ready, setReady] = useState(false);

  const activeStake = group?.stake ?? draftStake;
  const rivals = Math.max(0, (group?.members.length ?? 1) - 1);
  const pot = group ? groupPot(group, activeStake) : 0;

  const playableGames = useMemo(
    () => GAMES.filter((game) => game.enabled),
    []
  );

  const selectedGame =
    playableGames.find((game) => game.id === selectedGameId) ??
    playableGames[0];

  const payoutOptions = group
    ? maxUsefulPayout(group)
    : (["winner-takes-all"] as PotDistribution[]);

  const allMembersReady = Boolean(group && ready && group.members.length > 1);

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

  function setStake(stake: Stake) {
    setReady(false);
    onSetStake(stake);
  }

  function buildConfig(): GroupCompetitionConfig {
    if (competitionType === "league") {
      return {
        type: "league",
        stake: activeStake,
        rounds: leagueRounds,
        distribution,
      };
    }

    if (competitionType === "tournament") {
      return {
        type: "tournament",
        stake: activeStake,
        eliminatedPerRound,
        distribution,
      };
    }

    return {
      type: "quick",
      stake: activeStake,
      distribution: "winner-takes-all",
    };
  }

  function startCompetition() {
    if (!selectedGame || !allMembersReady || activeStake > balance) return;
    onStartCompetition(selectedGame, buildConfig());
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
            Crea una sala privada. Solo entra quien tenga el código.
          </p>
        </div>

        <div className="groupSetupCard">
          <label>
            <span>NOMBRE DEL GRUPO</span>
            <input
              value={draftName}
              maxLength={24}
              onChange={(event) => setDraftName(event.target.value)}
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
            onClick={() => onCreateGroup(draftName, draftStake)}
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
            <button type="button" onClick={() => void copyCode()}>
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
                <div key={member.id} className={member.isYou ? "you" : ""}>
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
            <h1>Elige formato</h1>
            <p>
              Define las reglas antes de abrir la sala de espera.
            </p>
          </div>

          <div className="competitionTypeGrid">
            <button
              type="button"
              className={competitionType === "quick" ? "active" : ""}
              onClick={() => chooseCompetition("quick")}
            >
              <strong>PARTIDA RÁPIDA</strong>
              <span>Una partida</span>
            </button>
            <button
              type="button"
              className={competitionType === "league" ? "active" : ""}
              onClick={() => chooseCompetition("league")}
            >
              <strong>LIGA</strong>
              <span>Varias jornadas</span>
            </button>
            <button
              type="button"
              className={competitionType === "tournament" ? "active" : ""}
              onClick={() => chooseCompetition("tournament")}
            >
              <strong>TORNEO</strong>
              <span>Eliminatorias</span>
            </button>
          </div>

          <div className="groupStakeBlock groupStakeCard">
            <span>PRECIO DE ENTRADA POR JUGADOR</span>
            <div className="groupStakeGrid">
              {STAKES.map((stake) => (
                <button
                  key={stake}
                  type="button"
                  className={activeStake === stake ? "selected" : ""}
                  disabled={stake > balance}
                  onClick={() => setStake(stake)}
                >
                  {stake === 0 ? "GRATIS" : `${stake}€`}
                </button>
              ))}
            </div>
          </div>

          {competitionType === "league" && (
            <div className="competitionConfigCard">
              <span>NÚMERO DE JORNADAS</span>
              <div className="compactOptionGrid">
                {LEAGUE_ROUNDS.map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    className={leagueRounds === rounds ? "selected" : ""}
                    onClick={() => {
                      setLeagueRounds(rounds);
                      setReady(false);
                    }}
                  >
                    {rounds}
                  </button>
                ))}
              </div>
            </div>
          )}

          {competitionType === "tournament" && (
            <div className="competitionConfigCard">
              <span>ELIMINADOS POR RONDA</span>
              <div className="compactOptionGrid">
                {ELIMINATED_OPTIONS.filter(
                  (value) => value < group.members.length
                ).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      eliminatedPerRound === value ? "selected" : ""
                    }
                    onClick={() => {
                      setEliminatedPerRound(value);
                      setReady(false);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {competitionType !== "quick" && (
            <div className="competitionConfigCard">
              <span>REPARTO DEL BOTE</span>
              <div className="payoutOptionList">
                {payoutOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={distribution === option ? "selected" : ""}
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
              <strong>{pot === 0 ? "—" : `${pot}€`}</strong>
            </div>
          </div>

          <div className="groupSectionTitle groupGameTitle">
            <span>ELIGE JUEGO</span>
            <small>UNA MARCA POR JUGADOR</small>
          </div>

          <div className="groupGameGrid selectionMode">
            {playableGames.map((game) => (
              <button
                key={game.id}
                type="button"
                className={selectedGameId === game.id ? "selected" : ""}
                onClick={() => {
                  setSelectedGameId(game.id);
                  setReady(false);
                }}
              >
                <img src={game.cover} alt={game.name} />
                <strong>{game.name}</strong>
              </button>
            ))}
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
                    <span className={memberReady ? "ready" : ""}>
                      {memberReady ? "LISTO" : "PENDIENTE"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              className={`readyToggle ${ready ? "ready" : ""}`}
              type="button"
              onClick={() => setReady((value) => !value)}
            >
              {ready ? "✓ ESTÁS LISTO" : "ESTOY LISTO"}
            </button>

            <button
              className="groupPrimaryAction"
              type="button"
              disabled={!allMembersReady || activeStake > balance}
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
