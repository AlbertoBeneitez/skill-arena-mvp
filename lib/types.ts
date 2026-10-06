export type GameResult = {
  won: boolean;
  score: number;
  timeMs: number;
  verified?: boolean;
  failureReason?: string | null;
  verificationError?: string;
};
