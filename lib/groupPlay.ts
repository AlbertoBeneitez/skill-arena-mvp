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
