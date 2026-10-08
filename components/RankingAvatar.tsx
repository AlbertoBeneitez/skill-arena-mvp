import { validRankingAvatar } from "@/lib/ranking";
export default function RankingAvatar({
  name,
  avatarKey,
}: {
  name: string;
  avatarKey?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase("es-ES");
  return (
    <span className="rankingAvatar" aria-hidden="true">
      {validRankingAvatar(avatarKey) ? (
        <img src={`/avatars/${avatarKey}.svg`} alt="" loading="lazy" />
      ) : (
        <span>{initials || "GG"}</span>
      )}
    </span>
  );
}
