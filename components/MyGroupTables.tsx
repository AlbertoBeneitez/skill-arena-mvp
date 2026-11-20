"use client";
/**
 * v218 (owner) · At the bottom of the avatar tab: the standings of every group the player is in — the latest
 * competition of each group (in play or finished), the player's row marked. Read-only; the Groups tab plays them.
 */
import { groupStandings, type GroupCompetition } from "@/lib/groupCompetition";
import { t, useI18n } from "@/lib/i18n";
import { competitionStatus, competitionTitle, standingValue } from "./groupLabels";

export type GroupTable = { id: string; name: string; competition: GroupCompetition | null; you: string };

export default function MyGroupTables({ tables, onOpen }: { tables: readonly GroupTable[] | null; onOpen(): void }) {
  useI18n();
  if (tables === null) return null; // still loading (online) or nothing to show yet
  return (
    <section className="myGroups" aria-label={t("profile.groupsTitle")}>
      <header><h2>{t("profile.groupsTitle")}</h2></header>
      {tables.length === 0 ? (
        <p className="myGroupsEmpty">{t("profile.groupsEmpty")}</p>
      ) : tables.map(({ id, name, competition, you }) => (
        <article key={id} className="myGroup">
          <button type="button" className="myGroupHead" onClick={onOpen}>
            <strong>{name}</strong>
            <span>{competition ? `${competitionTitle(competition)} · ${competitionStatus(competition)}` : t("profile.groupNoComp")}</span>
          </button>
          {competition && <StandingsList competition={competition} you={you} />}
        </article>
      ))}
    </section>
  );
}

/** v220 · The standings of one competition, the player's row marked (avatar tab and the Groups tab online). */
export function StandingsList({ competition, you }: { competition: GroupCompetition; you: string }) {
  useI18n();
  return (
    <ol className="myGroupRows">
      {groupStandings(competition).map((s) => {
        const p = competition.players.find((x) => x.id === s.id);
        return (
          <li key={s.id} data-you={s.id === you || undefined} data-out={s.out || undefined}>
            <b>{s.place}</b>
            {p?.avatar ? <img src={p.avatar} alt="" width={26} height={26} /> : <i aria-hidden="true" />}
            <span>{s.id === you ? t("common.you") : p?.name ?? s.id}</span>
            <em>{standingValue(competition, s)}</em>
          </li>
        );
      })}
    </ol>
  );
}
