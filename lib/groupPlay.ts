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
  /** v171: group picture chosen by the organiser (square JPEG data URL, about 192 px). */
  image?: string;
};

/** The former simulated members (v181: no longer added to groups); their names stay reserved. */
export const DEMO_MEMBERS: Omit<GroupMember, "id">[] = [
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
  /** v179: M (mobile) or D (desktop) leads the code, so only the same platform can join. */
  platformLetter?: "M" | "D";
}): ClosedGroup {
  return {
    id: randomCode(),
    code: `${args.platformLetter ?? ""}${randomCode()}`,
    name: args.name.trim() || "Mi grupo",
    stake: Math.max(0, Number(args.stake ?? 0)),
    // v181: only you. The simulated members (NOVA, KAI, RHEA) are gone; real players appear here when they join.
    members: [
      {
        id: "you",
        name: args.playerName || "TÚ",
        avatar: args.avatar,
        isYou: true,
        scoreFactor: 1,
      },
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
    // v181: only you. The simulated members (NOVA, KAI, RHEA) are gone; real players appear here when they join.
    members: [
      {
        id: "you",
        name: args.playerName || "TÚ",
        avatar: args.avatar,
        isYou: true,
        scoreFactor: 1,
      },
    ],
  };
}

/** v181: simulated members saved by earlier versions (ids "demo-1"…) are removed from a stored group. */
export const isSimulatedMemberId = (id: string) => /^demo-\d+$/.test(id);
export function withoutSimulatedMembers(group: ClosedGroup): ClosedGroup {
  return { ...group, members: group.members.filter((m) => m.isYou || !isSimulatedMemberId(m.id)) };
}
