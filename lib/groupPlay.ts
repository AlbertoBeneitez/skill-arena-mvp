import { t } from "@/lib/i18n";
import type { GameMeta } from "./games";

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
  stake: number;
  members: GroupMember[];
};

export type CompetitionType = "quick" | "league" | "tournament";
export type PotDistribution =
  | "winner-takes-all"
  | "top2-70-30"
  | "top3-60-30-10";

type CompetitionBase = {
  stake: number;
  distribution: PotDistribution;
  gameIds: GameMeta["id"][];
};

export type GroupCompetitionConfig =
  | (CompetitionBase & {
      type: "quick";
      distribution: "winner-takes-all";
      gameIds: [GameMeta["id"]];
    })
  | (CompetitionBase & {
      type: "league";
      rounds: number;
      gameSelectionMode: "manual" | "random";
    })
  | (CompetitionBase & {
      type: "tournament";
      eliminatedPerRound: number;
      gameSelectionMode: "manual" | "random";
    });

const DEMO_MEMBERS: Omit<GroupMember, "id">[] = [
  {
    name: "NOVA",
    avatar: "/avatars/avatar-2.svg",
    scoreFactor: 0.88,
  },
  {
    name: "KAI",
    avatar: "/avatars/avatar-6.svg",
    scoreFactor: 0.99,
  },
  {
    name: "RHEA",
    avatar: "/avatars/avatar-4.svg",
    scoreFactor: 1.08,
  },
];

function randomCode() {
  if (
    typeof crypto !== "undefined" &&
    "getRandomValues" in crypto
  ) {
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
  stake?: number;
  playerName: string;
  avatar: string;
}): ClosedGroup {
  return {
    id: randomCode(),
    code: randomCode(),
    name: args.name.trim() || "Mi grupo",
    stake: Math.max(0, Number(args.stake ?? 0)),
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

export function joinDemoClosedGroup(args: {
  code: string;
  playerName: string;
  avatar: string;
}): ClosedGroup {
  const code = args.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  return {
    id: code || randomCode(),
    code: code || randomCode(),
    name: code ? `Grupo ${code}` : "Grupo privado",
    stake: 0,
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

export function groupTargetScore(
  group: ClosedGroup,
  game: GameMeta
) {
  const rivals = group.members.filter((member) => !member.isYou);
  // Time-scored games: the strongest rival has the smallest time.
  if (game.resultMetric === "reaction-time-ms")
    return Math.min(...rivals.map((member) => Math.round(game.rivalScore / member.scoreFactor)));
  return Math.max(...rivals.map((member) => Math.round(game.rivalScore * member.scoreFactor)));
}

export function groupPot(
  group: ClosedGroup,
  stake: number = group.stake
) {
  if (stake <= 0) return 0;
  return Number((stake * group.members.length).toFixed(2));
}

export function payoutLabel(
  distribution: PotDistribution
) {
  switch (distribution) {
    case "top2-70-30":
      return t("group.split7030");
    case "top3-60-30-10":
      // Historical option, no longer offered for new competitions.
      return t("group.split603010");
    default:
      return t("group.splitWinner");
  }
}

/** Only two pot splits are offered: 70% / 30% (1º and 2º) or 100% to the winner. */
export function maxUsefulPayout(group: ClosedGroup) {
  if (group.members.length >= 2) {
    return [
      "top2-70-30",
      "winner-takes-all",
    ] as PotDistribution[];
  }

  return ["winner-takes-all"] as PotDistribution[];
}

export function competitionProgressLabel(
  config: GroupCompetitionConfig,
  current: number,
  memberCount: number
) {
  if (config.type === "league") {
    return t("group.progressMatchday", { n: Math.min(current, config.rounds), total: config.rounds });
  }

  if (config.type === "tournament") {
    const totalRounds = Math.max(
      1,
      Math.ceil(
        (Math.max(2, memberCount) - 1) /
          Math.max(1, config.eliminatedPerRound)
      )
    );

    return t("group.progressRound", { n: Math.min(current, totalRounds), total: totalRounds });
  }

  return t("group.progressQuick");
}
