/**
 * v154 · One scoreboard for every game: the same glass bar, in the same place, with labelled cells. The first cell
 * marked `main` carries the game's score (gold); the others its clock, lives, level… Presentation only — the values
 * come from the state the game already renders, never from authoritative scoring.
 */
export type ScoreCell = Readonly<{ label: string; value: string; main?: boolean; alert?: boolean }>;

export default function GameScoreboard({ cells, className = "" }: { cells: readonly ScoreCell[]; className?: string }) {
  if (!cells.length) return null;
  return (
    <div className={`gxScoreboard ${className}`} role="group" aria-live="off">
      {cells.map((cell) => (
        <span key={cell.label} className={`gxScoreCell${cell.main ? " main" : ""}${cell.alert ? " alert" : ""}${/\p{L}{4,}/u.test(cell.value) ? " word" : ""}`}>
          <small>{cell.label}</small>
          <b>{cell.value}</b>
        </span>
      ))}
    </div>
  );
}
