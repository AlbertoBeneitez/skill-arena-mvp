"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const OrbitRush = dynamic(() => import("./games/OrbitRush"), { ssr: false, loading: () => <GameLoading /> });
const VectorStrike = dynamic(() => import("./games/VectorStrike"), { ssr: false, loading: () => <GameLoading /> });
const PulseForge = dynamic(() => import("./games/PulseForge"), { ssr: false, loading: () => <GameLoading /> });
const StackForge = dynamic(() => import("./games/StackForge"), { ssr: false, loading: () => <GameLoading /> });
const LaneSurge = dynamic(() => import("./games/LaneSurge"), { ssr: false, loading: () => <GameLoading /> });
const DriftLine = dynamic(() => import("./games/DriftLine"), { ssr: false, loading: () => <GameLoading /> });
const SkyThread = dynamic(() => import("./games/SkyThread"), { ssr: false, loading: () => <GameLoading /> });
const TapReactor = dynamic(() => import("./games/TapReactor"), { ssr: false, loading: () => <GameLoading /> });

function GameLoading() {
  return <div className="gameLoading">PREPARANDO ARENA…</div>;
}

type Props = {
  game: GameMeta;
  active: boolean;
  instanceKey: number;
  onFinish: (result: GameResult) => void;
};

export default function GameLoader({ game, active, instanceKey, onFinish }: Props) {
  const key = `${game.id}-${instanceKey}`;
  switch (game.id) {
    case "orbit-rush":
      return <OrbitRush key={key} active={active} onFinish={onFinish} />;
    case "vector-strike":
      return <VectorStrike key={key} active={active} onFinish={onFinish} />;
    case "pulse-forge":
      return <PulseForge key={key} active={active} onFinish={onFinish} />;
    case "stack-forge":
      return <StackForge key={key} active={active} onFinish={onFinish} />;
    case "lane-surge":
      return <LaneSurge key={key} active={active} onFinish={onFinish} />;
    case "drift-line":
      return <DriftLine key={key} active={active} onFinish={onFinish} />;
    case "sky-thread":
      return <SkyThread key={key} active={active} onFinish={onFinish} />;
    case "tap-reactor":
      return <TapReactor key={key} active={active} onFinish={onFinish} />;
  }
}
