"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const ShadowSprint = dynamic(() => import("./games/ShadowSprint"), { ssr: false, loading: () => <GameLoading /> });
const OrbitRush = dynamic(() => import("./games/OrbitRush"), { ssr: false, loading: () => <GameLoading /> });
const VectorStrike = dynamic(() => import("./games/VectorStrike"), { ssr: false, loading: () => <GameLoading /> });
const BrickBreaker = dynamic(() => import("./games/BrickBreaker"), { ssr: false, loading: () => <GameLoading /> });

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
    case "shadow-sprint":
      return <ShadowSprint key={key} active={active} onFinish={onFinish} />;
    case "orbit-rush":
      return <OrbitRush key={key} active={active} onFinish={onFinish} />;
    case "vector-strike":
      return <VectorStrike key={key} active={active} onFinish={onFinish} />;
    case "brick-breaker":
      return <BrickBreaker key={key} active={active} onFinish={onFinish} />;
  }
}
