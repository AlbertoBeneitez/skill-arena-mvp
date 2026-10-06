"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const TowerDrop = dynamic(() => import("./games/TowerDrop"), { ssr: false, loading: () => <GameLoading /> });
const JetStream = dynamic(() => import("./games/JetStream"), { ssr: false, loading: () => <GameLoading /> });
const PulseRunner = dynamic(() => import("./games/PulseRunner"), { ssr: false, loading: () => <GameLoading /> });
const MetroShift = dynamic(() => import("./games/MetroShift"), { ssr: false, loading: () => <GameLoading /> });
const OrbitShift = dynamic(() => import("./games/OrbitShift"), { ssr: false, loading: () => <GameLoading /> });
const SolitaireSprint = dynamic(() => import("./games/SolitaireSprint"), { ssr: false, loading: () => <GameLoading /> });
const MineGrid = dynamic(() => import("./games/MineGrid"), { ssr: false, loading: () => <GameLoading /> });
const GridSerpent = dynamic(() => import("./games/GridSerpent"), { ssr: false, loading: () => <GameLoading /> });
const MergeGrid = dynamic(() => import("./games/MergeGrid"), { ssr: false, loading: () => <GameLoading /> });
const PixelLogic = dynamic(() => import("./games/PixelLogic"), { ssr: false, loading: () => <GameLoading /> });
const BrickRelay = dynamic(() => import("./games/BrickRelay"), { ssr: false, loading: () => <GameLoading /> });
const StackShift = dynamic(() => import("./games/StackShift"), { ssr: false, loading: () => <GameLoading /> });

function GameLoading() {
  return <div className="gameLoading">PREPARANDO ARENA…</div>;
}

type Props = {
  game: GameMeta;
  active: boolean;
  stake: number;
  ghostEnabled: boolean;
  instanceKey: number;
  targetScore: number;
  onFinish: (result: GameResult) => void;
};

export default function GameLoader({
  game,
  active,
  stake,
  ghostEnabled,
  instanceKey,
  targetScore,
  onFinish,
}: Props) {
  const key = `${game.id}-${instanceKey}`;

  switch (game.id) {
    case "tower-drop":
      return <TowerDrop key={key} active={active} stake={stake} ghostEnabled={ghostEnabled} targetScore={targetScore} onFinish={onFinish} />;
    case "jet-stream":
      return <JetStream key={key} active={active} targetScore={targetScore} onFinish={onFinish} />;
    case "pulse-runner":
      return <PulseRunner key={key} active={active} targetScore={targetScore} onFinish={onFinish} />;
    case "metro-shift":
      return <MetroShift key={key} active={active} ghostEnabled={ghostEnabled} targetScore={targetScore} onFinish={onFinish} />;
    case "orbit-shift":
      return <OrbitShift key={key} active={active} ghostEnabled={ghostEnabled} targetScore={targetScore} onFinish={onFinish} />;
    case "solitaire-sprint":
      return <SolitaireSprint key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "mine-grid":
      return <MineGrid key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "grid-serpent":
      return <GridSerpent key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "merge-grid":
      return <MergeGrid key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "pixel-logic":
      return <PixelLogic key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "brick-relay":
      return <BrickRelay key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "stack-shift":
      return <StackShift key={key} active={active} targetScore={targetScore} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
  }
}
