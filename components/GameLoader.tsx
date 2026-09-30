"use client";

import dynamic from "next/dynamic";
import type { GameResult } from "@/lib/types";
import type { GameMeta } from "@/lib/games";

const NeonDash = dynamic(() => import("./games/NeonDash"), { ssr: false, loading: () => <GameLoading /> });
const PulseTap = dynamic(() => import("./games/PulseTap"), { ssr: false, loading: () => <GameLoading /> });
const GridRecall = dynamic(() => import("./games/GridRecall"), { ssr: false, loading: () => <GameLoading /> });
const LineShift = dynamic(() => import("./games/LineShift"), { ssr: false, loading: () => <GameLoading /> });

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
    case "neon-dash":
      return <NeonDash key={key} active={active} onFinish={onFinish} />;
    case "pulse-tap":
      return <PulseTap key={key} active={active} onFinish={onFinish} />;
    case "grid-recall":
      return <GridRecall key={key} active={active} onFinish={onFinish} />;
    case "line-shift":
      return <LineShift key={key} active={active} onFinish={onFinish} />;
  }
}
