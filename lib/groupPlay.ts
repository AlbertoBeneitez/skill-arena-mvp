import type { GameMeta, Stake } from "./games";

export type GroupMember = {
  id: string;
  name: string;
  avatar: string;
  isYou?: boolean;
  scoreFactor: number;
};

export type ClosedGroup = {
  id: string;
  name: string;
  code: string;
  stake: Stake;
  members: GroupMember[];
};

export type CompetitionType = "quick" | "league" | "tournament";
export type PotDistribution = "winner-takes-all" | "top2-70-30" | "top3-60-30-10";

export type GroupCompetitionConfig =
  | {
      type: "quick";
      stake: Stake;
      distribution: "winner-takes-all";
    }
  | {
      type: "league";
      stake: Stake;
      rounds: number;
      distribution: PotDistribution;
    }
  | {
      type: "tournament";
      stake: Stake;
      eliminatedPerRound: number;
      distribution: PotDistribution;
    };

const DEMO_MEMBERS: Omit<GroupMember, "id">[] = [
  { name: "NOVA", avatar: "/avatars/avatar-2.svg", scoreFactor: 0.88 },
  { name: "KAI", avatar: "/avatars/avatar-6.svg", scoreFactor: 0.99 },
  { name: "RHEA", avatar: "/avatars/avatar-4.svg", scoreFactor: 1.08 },
];

function randomCode() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((value) => value.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 7)
      .toUpperCase();
  }
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

export function createDemoClosedGroup(args: {
  name: string;
  stake: Stake;
  playerName: string;
  avatar: string;
}): ClosedGroup {
  return {
    id: randomCode(),
    code: randomCode(),
    name: args.name.trim() || "Mi grupo",
    stake: args.stake,
    members: [
      {
        id: "you",
        name: args.playerName || "TÚ",
        avatar: args.avatar,
        isYou: true,
        scoreFactor: 1,
      },
      ...DEMO_MEMBERS.map((member, index) => ({
        ...member,
        id: `demo-${index + 1}`,
      })),
    ],
  };
}

export function groupTargetScore(group: ClosedGroup, game: GameMeta) {
  return Math.max(
    ...group.members
      .filter((member) => !member.isYou)
      .map((member) => Math.round(game.rivalScore * member.scoreFactor))
  );
}

export function groupPot(group: ClosedGroup, stake: Stake = group.stake) {
  if (stake === 0) return 0;
  return Number((stake * group.members.length).toFixed(2));
}

export function payoutLabel(distribution: PotDistribution) {
  switch (distribution) {
    case "top2-70-30":
      return "1º 70% · 2º 30%";
    case "top3-60-30-10":
      return "1º 60% · 2º 30% · 3º 10%";
    default:
      return "Ganador 100%";
  }
}

export function maxUsefulPayout(group: ClosedGroup) {
  if (group.members.length >= 3) {
    return ["winner-takes-all", "top2-70-30", "top3-60-30-10"] as PotDistribution[];
  }
  if (group.members.length === 2) {
    return ["winner-takes-all", "top2-70-30"] as PotDistribution[];
  }
  return ["winner-takes-all"] as PotDistribution[];
}

export function competitionProgressLabel(
  config: GroupCompetitionConfig,
  current: number,
  memberCount: number
) {
  if (config.type === "league") {
    return `Jornada ${Math.min(current, config.rounds)} de ${config.rounds}`;
  }

  if (config.type === "tournament") {
    const totalRounds = Math.max(
      1,
      Math.ceil((Math.max(2, memberCount) - 1) / Math.max(1, config.eliminatedPerRound))
    );
    return `Ronda ${Math.min(current, totalRounds)} de ${totalRounds}`;
  }

  return "Partida rápida";
}
