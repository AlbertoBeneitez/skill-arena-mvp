import type { GameResult } from "@/lib/types";
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
  resultMetric?: "fictitious-balance";
}) {
  const { t } = useI18n();
  const balance = resultMetric === "fictitious-balance";
  const reach =
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
              : reach !== undefined
                ? t("result.reach")
                : t("result.points")}
          </dt>
          <dd
            aria-label={
              balance
                ? t("result.chipsAria")
                : reach !== undefined
                  ? t("result.reachAria")
                  : t("result.pointsAria")
            }
          >
            {balance
              ? t("common.chips", { n: formatNumber((reach ?? result.score) / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) })
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
