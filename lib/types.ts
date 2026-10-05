export type GameResult = {
  won: boolean;
  score: number;
  timeMs: number;
  verified?: boolean;
  verificationId?: string;
  replayHash?: string;
  failureReason?: string | null;
  verificationError?: string;
};
