/** v218 · Labels of group competitions shared by the Groups tab and the avatar tab. */
import { t } from "@/lib/i18n";
import { isInterGroup, type GroupCompetition, type GroupStanding } from "@/lib/groupCompetition";

export const MODALITY_LABEL = { "all-vs-all": "group.modeAll", "duel-groups": "group.modeDuelGroups", "relay-groups": "group.modeRelay" } as const;
export const pointsLabel = (n: number) => (n === 1 ? t("group.pointOne") : t("group.pointsShort", { n }));
/** Title of a competition: its modality, or the format of one created before v217. */
export function competitionTitle(c: GroupCompetition) {
  const f = c.config.format;
  if (f === "all-vs-all" || f === "duel-groups" || f === "relay-groups") return t(MODALITY_LABEL[f]);
  return t(f === "tournament" ? "group.tournament" : f === "single" ? "group.singleMatch" : "group.league");
}
/** Modalities rank by points; leagues created before v217 by wins; a tournament only by place. */
export function standingValue(c: GroupCompetition, s: GroupStanding) {
  const f = c.config.format;
  if (s.out) return t("group.out");
  if (f === "all-vs-all" || isInterGroup(f)) return pointsLabel(s.points);
  return f === "tournament" ? "" : t("group.winsShort", { n: s.wins });
}
/** «Jornada n» while it runs, «Terminada» at the end. */
export function competitionStatus(c: GroupCompetition) {
  const round = c.matches.reduce((r, m) => Math.max(r, m.round), 0);
  if (c.finished) return t("group.finished");
  return t(c.config.format === "tournament" ? "group.roundN" : "group.matchdayN", { n: Math.max(1, round) });
}
