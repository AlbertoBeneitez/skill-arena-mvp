export const MAZE_ACTIONS = ["UP", "LEFT", "DOWN", "RIGHT", "STOP"] as const;
export type MazeAction = (typeof MAZE_ACTIONS)[number];
