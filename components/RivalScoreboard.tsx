"use client";
import type { ResultMetric } from "@/lib/games";
import { formatNumber, t, useI18n } from "@/lib/i18n";

export type RivalResult = {
  name: string;
  avatar?: string;
  /** The rival's result in the game's own units; null while pending or when the rival has none (forfeit). */
  score: number | null;
  status: "final" | "pending" | "none";
};

function format(score: number, metric?: ResultMetric) {
  if (metric === "fictitious-balance") return t("common.chips", { n: formatNumber(score / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) });
  if (metric === "reaction-time-ms") return t("common.ms", { n: formatNumber(score) });
  return formatNumber(score);
}

/**
 * Head-to-head line on every result screen: the player's result next to the rival's (league rival, online opponent,
 * group target or the result to beat). The winner side is lit; a pending rival shows "waiting".
 */
export default function RivalScoreboard({ you, youAvatar, youName, rival, won, tie = false, metric }: {
  you: number;
  youAvatar?: string;
  youName: string;
  rival: RivalResult;
  won: boolean;
  tie?: boolean;
  metric?: ResultMetric;
}) {
  useI18n();
  const decided = rival.status === "final" && !tie;
  const youWin = decided && won, rivalWin = decided && !won;
  return (
    <section className="rivalBoard" aria-label={t("result.rivalAria")}>
      <div className={`rivalSide you ${youWin ? "win" : ""}`}>
        {youAvatar ? <img src={youAvatar} alt="" width={40} height={40} /> : <span className="rivalInitial" aria-hidden="true">{youName.slice(0, 1).toUpperCase()}</span>}
        <small>{t("result.you")}</small>
        <b>{format(you, metric)}</b>
        {youWin && <i className="rivalWinTag">{t("result.wins")}</i>}
      </div>
      <span className="rivalVs" aria-hidden="true">{tie ? "=" : "VS"}</span>
      <div className={`rivalSide them ${rivalWin ? "win" : ""} ${rival.status !== "final" ? "muted" : ""}`}>
        {rival.avatar ? <img src={rival.avatar} alt="" width={40} height={40} /> : <span className="rivalInitial" aria-hidden="true">{rival.name.slice(0, 1).toUpperCase()}</span>}
        <small>{rival.name}</small>
        <b>{rival.status === "pending" ? t("result.rivalPending") : rival.score === null ? t("result.rivalNoScore") : format(rival.score, metric)}</b>
        {rivalWin && <i className="rivalWinTag">{t("result.wins")}</i>}
      </div>
      {tie && <p className="rivalTie">{t("result.tie")}</p>}
    </section>
  );
}
