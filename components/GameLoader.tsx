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
const BrickRelay = dynamic(() => import("./games/BrickRelay"), { ssr: false, loading: () => <GameLoading /> });
const StackShift = dynamic(() => import("./games/StackShift"), { ssr: false, loading: () => <GameLoading /> });
const MazeRush = dynamic(() => import("./games/MazeRush"), { ssr: false, loading: () => <GameLoading /> });
const StarPhalanx = dynamic(() => import("./games/StarPhalanx"), { ssr: false, loading: () => <GameLoading /> });
const RiverDash = dynamic(() => import("./games/RiverDash"), { ssr: false, loading: () => <GameLoading /> });
const OrbBurst = dynamic(() => import("./games/OrbBurst"), { ssr: false, loading: () => <GameLoading /> });
const PrecisionStack = dynamic(() => import("./games/PrecisionStack"), { ssr: false, loading: () => <GameLoading /> });
const Merge2048 = dynamic(() => import("./games/Merge2048"), { ssr: false, loading: () => <GameLoading /> });
const PianoRush = dynamic(() => import("./games/PianoRush"), { ssr: false, loading: () => <GameLoading /> });
const DinoDash = dynamic(() => import("./games/DinoDash"), { ssr: false, loading: () => <GameLoading /> });
const ReactionTest = dynamic(() => import("./games/ReactionTest"), { ssr: false, loading: () => <GameLoading /> });
const SkyHop = dynamic(() => import("./games/SkyHop"), { ssr: false, loading: () => <GameLoading /> });

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
  stopOnTarget: boolean;
  onFinish: (result: GameResult) => void;
};

export default function GameLoader({
  game,
  active,
  stake,
  ghostEnabled,
  instanceKey,
  targetScore,
  stopOnTarget,
  onFinish,
}: Props) {
  const key = `${game.id}-${instanceKey}`;
  // Green/create attempts establish a score and must not stop when the
  // benchmark is crossed. Blue/purple reply attempts end immediately once
  // the stored mark is beaten.
  const effectiveTarget = stopOnTarget
    ? targetScore
    : 1_000_000_000;

  switch (game.id) {
    case "tower-drop":
      return <TowerDrop key={key} active={active} stake={stake} ghostEnabled={ghostEnabled} targetScore={effectiveTarget} onFinish={onFinish} />;
    case "jet-stream":
      return <JetStream key={key} active={active} targetScore={effectiveTarget} onFinish={onFinish} />;
    case "pulse-runner":
      return <PulseRunner key={key} active={active} targetScore={effectiveTarget} onFinish={onFinish} />;
    case "metro-shift":
      return <MetroShift key={key} active={active} ghostEnabled={ghostEnabled} targetScore={effectiveTarget} onFinish={onFinish} />;
    case "orbit-shift":
      return <OrbitShift key={key} active={active} ghostEnabled={ghostEnabled} targetScore={effectiveTarget} onFinish={onFinish} />;
    case "solitaire-sprint":
      return <SolitaireSprint key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "mine-grid":
      return <MineGrid key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "grid-serpent":
      return <GridSerpent key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "brick-relay":
      return <BrickRelay key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "stack-shift":
      return <StackShift key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "maze-rush":
      return <MazeRush key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "star-phalanx":
      return <StarPhalanx key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "river-dash":
      return <RiverDash key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "orb-burst":
      return <OrbBurst key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "precision-stack":
      return <PrecisionStack key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "merge-2048":
      return <Merge2048 key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "piano-rush":
      return <PianoRush key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "dino-dash":
      return <DinoDash key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "reaction-test":
      return <ReactionTest key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
    case "sky-hop":
      return <SkyHop key={key} active={active} targetScore={effectiveTarget} seed={game.deterministicSeed ?? game.id} onFinish={onFinish} />;
  }
}
