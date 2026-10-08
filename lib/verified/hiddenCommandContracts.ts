/** Public wire projection. Never add seed/full manifest or hidden core state here. */
export type HiddenCommandRequest = Readonly<{
  attemptId: string;
  commandId: string;
  expectedRevision: number;
  action: string;
}>;
export type HiddenPublicSession<TView> = Readonly<{
  mode: "demo" | "production";
  attemptId: string;
  matchId: string;
  gameId: string;
  gameVersion: string;
  scenarioId: string;
  revision: number;
  status: "running" | "won" | "failed";
  score: number;
  failure: string | null;
  view: TView;
  verified: boolean;
}>;
