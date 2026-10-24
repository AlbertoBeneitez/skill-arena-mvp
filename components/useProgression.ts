"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { safeStorage } from "@/lib/safeStorage";
import {
  PROGRESS_KEY, applyChest, applyRun, claimMission, dayKey, equip, frameColor, initialProgress, parseProgress, themeAccent,
  type ChestCard, type MissionId, type ProgressState, type RunApplied, type RunInput,
} from "@/lib/progression";

/** Local-only progression store. The key is deliberately NOT prefixed `skill-arena-` so the forced login never wipes it. */
export function useProgression() {
  const [progress, setProgress] = useState<ProgressState>(() => initialProgress(dayKey(new Date())));
  const ref = useRef(progress);
  useEffect(() => {
    const loaded = parseProgress(safeStorage.getItem(PROGRESS_KEY), dayKey(new Date()));
    ref.current = loaded;
    setProgress(loaded);
  }, []);
  const commit = useCallback((next: ProgressState) => {
    ref.current = next;
    setProgress(next);
    safeStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const frame = frameColor(progress.frame), accent = themeAccent(progress.theme);
    frame ? root.style.setProperty("--ga-frame", frame) : root.style.removeProperty("--ga-frame");
    accent ? root.style.setProperty("--ga-accent", accent) : root.style.removeProperty("--ga-accent");
    root.dataset.gaTheme = progress.theme || "default";
  }, [progress.frame, progress.theme]);
  const recordRun = useCallback((run: RunInput): RunApplied => {
    const applied = applyRun(ref.current, run, dayKey(new Date()));
    commit(applied.state);
    return applied;
  }, [commit]);
  const claim = useCallback((id: MissionId) => commit(claimMission(ref.current, id)), [commit]);
  const takeChest = useCallback((card: ChestCard) => commit(applyChest(ref.current, card)), [commit]);
  const equipItem = useCallback((id: string) => commit(equip(ref.current, id)), [commit]);
  return { progress, recordRun, claim, takeChest, equipItem };
}
