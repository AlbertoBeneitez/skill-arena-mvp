"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const ShadowSprint = dynamic(() => import("./games/ShadowSprint"), { ssr: false, loading: () => <GameLoading /> });
const GravityShift = dynamic(() => import("./games/GravityShift"), { ssr: false, loading: () => <GameLoading /> });
const ArrowEscape = dynamic(() => import("./games/ArrowEscape"), { ssr: false, loading: () => <GameLoading /> });
const BrickBreaker = dynamic(() => import("./games/BrickBreaker"), { ssr: false, loading: () => <GameLoading /> });

function GameLoading() {
  return <div className="gameLoading">CARGANDO JUEGO…</div>;
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
    case "gravity-shift":
      return <GravityShift key={key} active={active} onFinish={onFinish} />;
    case "arrow-escape":
      return <ArrowEscape key={key} active={active} onFinish={onFinish} />;
    case "brick-breaker":
      return <BrickBreaker key={key} active={active} onFinish={onFinish} />;
  }
}
