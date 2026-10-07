"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameResult } from "@/lib/types";
import {
  GAMES,
  type GameId,
  type GameMeta,
  type GameRuntimeProps,
} from "@/lib/games";

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

const GAME_COMPONENTS = Object.fromEntries(
  GAMES.map((definition) => [
    definition.id,
    dynamic<GameRuntimeProps>(
      async () => {
        const module = await definition.loadComponent();
        return module.default as ComponentType<GameRuntimeProps>;
      },
      {
        ssr: false,
        loading: () => <GameLoading />,
      }
    ),
  ])
) as Record<GameId, ComponentType<GameRuntimeProps>>;

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
  const GameComponent = GAME_COMPONENTS[game.id];
  const effectiveTarget = stopOnTarget
    ? targetScore
    : 1_000_000_000;

  return (
    <GameComponent
      key={`${game.id}-${instanceKey}`}
      active={active}
      stake={stake}
      ghostEnabled={ghostEnabled}
      targetScore={effectiveTarget}
      seed={game.deterministicSeed ?? game.id}
      onFinish={onFinish}
    />
  );
}
