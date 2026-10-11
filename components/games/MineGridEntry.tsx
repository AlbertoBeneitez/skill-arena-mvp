"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { GameRuntimeProps } from "@/lib/games";
const Authority = dynamic(() => import("./MineGridAuthority"));
const Legacy = dynamic(() => import("./MineGrid"));
/** Preserve existing training until private durable transport is configured. */
export default function MineGridEntry(props: GameRuntimeProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hidden-game/start", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((value) => {
        if (!controller.signal.aborted)
          setAvailable(value.available === true && value.durable === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, []);
  if (available === null)
    return <div className="gameLoading">PREPARANDO JUEGO…</div>;
  return available ? <Authority {...props} /> : <Legacy {...props} />;
}
