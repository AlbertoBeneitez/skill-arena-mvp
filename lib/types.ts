export type GameResult = {
  serverMatch?: import("./publicMatch").PublicMatchView;
  forfeited?: boolean;
  won: boolean;
  score: number;
  /** High-water reach reconstructed by the server, when supplied by the core. */
  height?: number;
  timeMs: number;
  verified?: boolean;
  failureReason?: string | null;
  verificationError?: string;
};
