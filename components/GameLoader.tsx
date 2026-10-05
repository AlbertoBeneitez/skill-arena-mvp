"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const TowerDrop = dynamic(() => import("./games/TowerDrop"), { ssr: false, loading: () => <GameLoading /> });
const HelixDive = dynamic(() => import("./games/HelixDive"), { ssr: false, loading: () => <GameLoading /> });
const SliceRush = dynamic(() => import("./games/SliceRush"), { ssr: false, loading: () => <GameLoading /> });
const JetStream = dynamic(() => import("./games/JetStream"), { ssr: false, loading: () => <GameLoading /> });
const PulseRunner = dynamic(() => import("./games/PulseRunner"), { ssr: false, loading: () => <GameLoading /> });
const ShatterShot = dynamic(() => import("./games/ShatterShot"), { ssr: false, loading: () => <GameLoading /> });
const MetroShift = dynamic(() => import("./games/MetroShift"), { ssr: false, loading: () => <GameLoading /> });
const TapReactor = dynamic(() => import("./games/TapReactor"), { ssr: false, loading: () => <GameLoading /> });

function GameLoading() {
  return <div className="gameLoading">PREPARANDO ARENA…</div>;
}

type Props = {
  game: GameMeta;
  active: boolean;
  stake: number;
  instanceKey: number;
  onFinish: (result: GameResult) => void;
};

export default function GameLoader({ game, active, stake, instanceKey, onFinish }: Props) {
  const key = `${game.id}-${instanceKey}`;
  switch (game.id) {
    case "tower-drop":
      return <TowerDrop key={key} active={active} stake={stake} onFinish={onFinish} />;
    case "helix-dive":
      return <HelixDive key={key} active={active} onFinish={onFinish} />;
    case "slice-rush":
      return <SliceRush key={key} active={active} onFinish={onFinish} />;
    case "jet-stream":
      return <JetStream key={key} active={active} onFinish={onFinish} />;
    case "pulse-runner":
      return <PulseRunner key={key} active={active} onFinish={onFinish} />;
    case "shatter-shot":
      return <ShatterShot key={key} active={active} onFinish={onFinish} />;
    case "metro-shift":
      return <MetroShift key={key} active={active} onFinish={onFinish} />;
    case "tap-reactor":
      return <TapReactor key={key} active={active} onFinish={onFinish} />;
  }
}
