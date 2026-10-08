import type { GameResult } from "@/lib/types";
const causes: Readonly<Record<string, string>> = {
  OUT_OF_BOUNDS: "Has salido del corredor. Ajusta el ritmo de los impulsos.",
  SHOTS_EXHAUSTED:
    "Se han agotado los tiros. Busca una trayectoria más precisa.",
  LOW_SCORE: "Practica los objetivos y el timing para mejorar tu puntuación.",
  RECOGNITION_SCORE:
    "Necesitas al menos seis aciertos y 2500 puntos. Cada prueba cuenta.",
  BOARD_OVERFLOW: "Los orbes han alcanzado la línea límite.",
  SELF_COLLISION: "La cabeza ha tocado tu propio recorrido.",
  AIM_TIMEOUT: "Se agotó el tiempo para preparar el tiro.",
  PURSUER_COLLISION: "Se agotaron los escudos. Anticipa los giros y usa los pulsos verdes para protegerte.",
  BALL_LOST: "Se agotaron las vidas. Anticipa el regreso y orienta el rebote con los bordes de la pala.",
  FALLEN: "Se agotaron las recuperaciones. Anticipa el siguiente apoyo y usa las balizas.",
  TIME_LIMIT: "Has llegado al límite de tiempo del reto.",
  TOP_OUT: "Deja espacio para las siguientes piezas. Usa la silueta de apoyo y completa filas.",
  HULL_EXHAUSTED: "Se agotaron los escudos. Lee las amenazas y busca una ruta segura.",
  MINES: "Se han agotado los escudos del campo.",
};
export default function GameResultSummary({
  result,
  gameName,
  waitingForRival = false,
}: {
  result: GameResult;
  gameName: string;
  waitingForRival?: boolean;
}) {
  const seconds = Math.max(0, Math.round(result.timeMs / 1000)),
    duration =
      seconds < 60
        ? `${seconds} s`
        : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return (
    <section className="gameResultSummary" aria-label="Resumen del intento">
      <span className="resultSourceBadge">
        {result.verified === true
          ? "DEMO · REPLAY DE SERVIDOR"
          : "DEMO · RESULTADO LOCAL"}
      </span>
      <p className="resultGameName">{gameName}</p>
      <h2>
        {waitingForRival
          ? "Marca registrada"
          : result.won
            ? "Reto superado"
            : "Inténtalo de nuevo"}
      </h2>
      <dl className="resultFacts">
        <div>
          <dt>Puntos</dt>
          <dd aria-label="Puntuación del intento">
            {result.score.toLocaleString("es-ES")}
          </dd>
        </div>
        <div>
          <dt>Tiempo de juego</dt>
          <dd>{duration}</dd>
        </div>
      </dl>
      <p className="resultLearningNote">
        {waitingForRival
          ? "Marca demo guardada. El duelo todavía espera a un rival."
          : result.won
            ? "Buen trabajo. Prueba otro escenario o mejora tu marca."
            : (result.failureReason && causes[result.failureReason]) ||
              "Cada intento te ayuda a dominar la mecánica."}
      </p>
    </section>
  );
}
