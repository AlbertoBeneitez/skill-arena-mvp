"use client";

import { useMemo, useState } from "react";
import type { ClosedGroup } from "@/lib/groupPlay";
import { groupPot } from "@/lib/groupPlay";
import { GAMES, STAKES, type GameMeta, type Stake } from "@/lib/games";

type Props = {
  group: ClosedGroup | null;
  balance: number;
  playerName: string;
  avatarSrc: string;
  onCreateGroup: (name: string, stake: Stake) => void;
  onSetStake: (stake: Stake) => void;
  onPlayGroup: (game: GameMeta) => void;
};

type GroupTab = "group" | "create-match";

export default function GroupHub({
  group,
  balance,
  playerName,
  avatarSrc,
  onCreateGroup,
  onSetStake,
  onPlayGroup,
}: Props) {
  const [draftName, setDraftName] = useState("Mi grupo");
  const [draftStake, setDraftStake] = useState<Stake>(5);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<GroupTab>("group");

  const activeStake = group?.stake ?? draftStake;
  const rivals = Math.max(0, (group?.members.length ?? 1) - 1);
  const pot = group ? groupPot(group) : 0;

  const playableGames = useMemo(
    () => GAMES.filter((game) => game.enabled),
    []
  );

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

  if (!group) {
    return (
      <section className="groupScreen">
        <div className="groupHero">
          <span>GRUPO CERRADO</span>
          <h1>Compite con tu gente</h1>
          <p>
            Crea una sala privada. Solo entra quien tenga el código. El importe
            se fija para todos antes de jugar.
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

          <div className="groupStakeBlock">
            <span>DINERO POR PARTIDA</span>
            <div className="groupStakeGrid">
              {STAKES.map((stake) => (
                <button
                  key={stake}
                  type="button"
                  className={draftStake === stake ? "selected" : ""}
                  disabled={stake > balance}
                  onClick={() => setDraftStake(stake)}
                >
                  {stake === 0 ? "GRATIS" : `${stake}€`}
                </button>
              ))}
            </div>
          </div>

          <div className="groupSetupPreview">
            <img src={avatarSrc} alt="" />
            <div>
              <small>CREADOR</small>
              <strong>{playerName || "TÚ"}</strong>
            </div>
            <b>{draftStake === 0 ? "DEMO" : `${draftStake}€`}</b>
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
      <div className="groupSubtabs" role="tablist" aria-label="Secciones del grupo">
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

          <div className="groupSummaryGrid">
            <div>
              <span>RIVALES</span>
              <strong>{rivals}</strong>
            </div>
            <div>
              <span>POR JUGADOR</span>
              <strong>{activeStake === 0 ? "0€" : `${activeStake}€`}</strong>
            </div>
            <div>
              <span>BOTE DEMO</span>
              <strong>{pot === 0 ? "—" : `${pot}€`}</strong>
            </div>
          </div>

          <div className="groupMembersCard">
            <div className="groupSectionTitle">
              <span>INTEGRANTES</span>
              <small>1 VS TODOS</small>
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
            <small>PARTIDA PRIVADA</small>
            <h1>Configura el enfrentamiento</h1>
            <p>
              Juegas una vez contra la mejor marca del resto del grupo.
            </p>
          </div>

          <div className="groupStakeBlock groupStakeCard">
            <span>DINERO POR JUGADOR</span>
            <div className="groupStakeGrid">
              {STAKES.map((stake) => (
                <button
                  key={stake}
                  type="button"
                  className={activeStake === stake ? "selected" : ""}
                  disabled={stake > balance}
                  onClick={() => onSetStake(stake)}
                >
                  {stake === 0 ? "GRATIS" : `${stake}€`}
                </button>
              ))}
            </div>
          </div>

          <div className="groupMatchSummary">
            <div>
              <span>FORMATO</span>
              <strong>1 VS {rivals}</strong>
            </div>
            <div>
              <span>BOTE DEMO</span>
              <strong>{pot === 0 ? "—" : `${pot}€`}</strong>
            </div>
          </div>

          <div className="groupSectionTitle groupGameTitle">
            <span>ELIGE JUEGO</span>
            <small>MEJOR MARCA GANA</small>
          </div>

          <div className="groupGameGrid">
            {playableGames.map((game) => (
              <article key={game.id}>
                <img src={game.cover} alt={game.name} />
                <div>
                  <strong>{game.name}</strong>
                  <button
                    type="button"
                    disabled={activeStake > balance || rivals < 1}
                    onClick={() => onPlayGroup(game)}
                  >
                    JUGAR 1 VS {rivals}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
