"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const TowerDrop = dynamic(() => import("./games/TowerDrop"), { ssr: false, loading: () => <GameLoading /> });
const JetStream = dynamic(() => import("./games/JetStream"), { ssr: false, loading: () => <GameLoading /> });
const PulseRunner = dynamic(() => import("./games/PulseRunner"), { ssr: false, loading: () => <GameLoading /> });
const MetroShift = dynamic(() => import("./games/MetroShift"), { ssr: false, loading: () => <GameLoading /> });
const OrbitShift = dynamic(() => import("./games/OrbitShift"), { ssr: false, loading: () => <GameLoading /> });

function GameLoading() {
  return <div className="gameLoading">PREPARANDO ARENA…</div>;
}

type Props = {
  game: GameMeta;
  active: boolean;
  stake: number;
  ghostEnabled: boolean;
  instanceKey: number;
  onFinish: (result: GameResult) => void;
};

export default function GameLoader({
  game,
  active,
  stake,
  ghostEnabled,
  instanceKey,
  onFinish,
}: Props) {
  const key = `${game.id}-${instanceKey}`;

  switch (game.id) {
    case "tower-drop":
      return <TowerDrop key={key} active={active} stake={stake} ghostEnabled={ghostEnabled} onFinish={onFinish} />;
    case "jet-stream":
      return <JetStream key={key} active={active} onFinish={onFinish} />;
    case "pulse-runner":
      return <PulseRunner key={key} active={active} onFinish={onFinish} />;
    case "metro-shift":
      return <MetroShift key={key} active={active} ghostEnabled={ghostEnabled} onFinish={onFinish} />;
    case "orbit-shift":
      return <OrbitShift key={key} active={active} ghostEnabled={ghostEnabled} onFinish={onFinish} />;
  }
}
