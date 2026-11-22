import type { ResultMetric } from "./games";
import { formatNumber, t } from "./i18n";
import { readSolitaireScoreV1 } from "./verified/solitaireProtocol.v1";

/** One place for how a score reads in its game's unit (rival lines, rankings, league targets). */
export function formatScore(score: number, metric?: ResultMetric) {
  if (metric === "fictitious-balance")
    return t("common.chips", { n: formatNumber(score / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) });
  if (metric === "reaction-time-ms") return t("common.ms", { n: formatNumber(score) });
  if (metric === "orbs-eliminated") return t("common.orbs", { n: formatNumber(score) });
  if (metric === "solve-time-or-cards") {
    const read = readSolitaireScoreV1(score);
    return read.solved
      ? t("common.seconds", { n: formatNumber(read.ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
      : t("common.cardsLeft", { n: formatNumber(read.cardsLeft) });
  }
  return formatNumber(score);
}
