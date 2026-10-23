import type { GameResult } from "@/lib/types";
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
  const balance = resultMetric === "fictitious-balance";
  const reach =
    result.verified === true &&
    result.height !== undefined &&
    Number.isSafeInteger(result.height) &&
    result.height >= 0
      ? result.height
      : undefined;
  const duration = `${(Math.max(0, result.timeMs) / 1000).toLocaleString(
    "es-ES",
    {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  )} s`;
  return (
    <section className="gameResultSummary" aria-label="Resumen del intento">
      <span className="resultSourceBadge">
        {result.forfeited
          ? "PARTIDA PERDIDA"
          : result.verified === true
          ? "ENTRENAMIENTO · REPLAY DE SERVIDOR"
          : "ENTRENAMIENTO · RESULTADO LOCAL"}
      </span>
      <p className="resultGameName">{gameName}</p>
      <h2>
        {result.forfeited
          ? "Partida perdida"
          : waitingForRival
          ? "Marca registrada"
          : balance
            ? reach === 0
              ? "Sin fichas"
              : "Fichas registradas"
            : result.won
              ? "Reto superado"
              : "Inténtalo de nuevo"}
      </h2>
      <dl className="resultFacts">
        <div>
          <dt>
            {balance
              ? "Fichas finales"
              : reach !== undefined
                ? "Avance alcanzado"
                : "Puntos"}
          </dt>
          <dd
            aria-label={
              balance
                ? "Fichas del intento"
                : reach !== undefined
                  ? "Avance del intento"
                  : "Puntuación del intento"
            }
          >
            {balance
              ? `${((reach ?? result.score) / 100).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} fichas`
              : (reach ?? result.score).toLocaleString("es-ES")}
          </dd>
        </div>
        <div>
          <dt>Tiempo de juego</dt>
          <dd>{duration}</dd>
        </div>
      </dl>
    </section>
  );
}
