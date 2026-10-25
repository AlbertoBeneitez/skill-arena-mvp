import type { GameResult } from "@/lib/types";
import type { ResultMetric } from "@/lib/games";
import { formatNumber, useI18n } from "@/lib/i18n";
export default function GameResultSummary({
  result,
  gameName,
  waitingForRival = false,
  resultMetric,
}: {
  result: GameResult;
  gameName: string;
  waitingForRival?: boolean;
  resultMetric?: ResultMetric;
}) {
  const { t } = useI18n();
  const balance = resultMetric === "fictitious-balance";
  // Time-scored games show the accumulated milliseconds (their "reach" is only the duel mirror).
  const timed = resultMetric === "reaction-time-ms";
  const reach =
    !timed &&
    result.verified === true &&
    result.height !== undefined &&
    Number.isSafeInteger(result.height) &&
    result.height >= 0
      ? result.height
      : undefined;
  const duration = t("common.seconds", { n: formatNumber(Math.max(0, result.timeMs) / 1000, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) });
  return (
    <section className="gameResultSummary" aria-label={t("result.aria")}>
      <span className="resultSourceBadge">
        {result.forfeited
          ? t("result.badgeLost")
          : result.verified === true
          ? t("result.badgeServer")
          : t("result.badgeLocal")}
      </span>
      <p className="resultGameName">{gameName}</p>
      <h2>
        {result.forfeited
          ? t("result.lost")
          : waitingForRival
          ? t("result.registered")
          : balance
            ? reach === 0
              ? t("result.noChips")
              : t("result.chipsRegistered")
            : result.won
              ? t("result.completed")
              : t("result.tryAgain")}
      </h2>
      <dl className="resultFacts">
        <div>
          <dt>
            {balance
              ? t("result.finalChips")
              : timed
                ? t("result.reactionTotal")
                : reach !== undefined
                ? t("result.reach")
                : t("result.points")}
          </dt>
          <dd
            aria-label={
              balance
                ? t("result.chipsAria")
                : timed
                  ? t("result.reactionTotal")
                  : reach !== undefined
                  ? t("result.reachAria")
                  : t("result.pointsAria")
            }
          >
            {balance
              ? t("common.chips", { n: formatNumber((reach ?? result.score) / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) })
              : timed
                ? t("common.ms", { n: formatNumber(result.score) })
                : formatNumber(reach ?? result.score)}
          </dd>
        </div>
        <div>
          <dt>{t("result.playTime")}</dt>
          <dd>{duration}</dd>
        </div>
      </dl>
    </section>
  );
}
