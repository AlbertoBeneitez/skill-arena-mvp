/**
 * v196 · Client side of the measurement: queues catalogue events while the signed-in player has agreed, and sends them
 * in small batches to /api/events. Without agreement (the default) nothing is queued and nothing is sent. The server
 * checks the agreement again and decides what is kept; this file only reports what the player did.
 */
import type { EventKind } from "./events";

const FLUSH_MS = 5000, MAX_QUEUE = 20;
let enabled = false;
let queue: { kind: EventKind; gameId?: string; data?: Record<string, string | number> }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  if (timer) { clearTimeout(timer); timer = undefined; }
  if (!queue.length) return;
  const events = queue.splice(0, MAX_QUEUE);
  try {
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }), keepalive: true, cache: "no-store" }).catch(() => undefined);
  } catch { /* measuring never breaks the app */ }
  if (queue.length) timer = setTimeout(flush, FLUSH_MS);
}

export function setAnalyticsEnabled(on: boolean) {
  enabled = on;
  if (!on) { queue = []; if (timer) { clearTimeout(timer); timer = undefined; } }
}

export function track(kind: EventKind, data?: Record<string, string | number>, gameId?: string) {
  if (!enabled) return;
  queue.push({ kind, ...(gameId ? { gameId } : {}), data: data ?? {} });
  if (queue.length >= MAX_QUEUE) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export function flushAnalytics() { if (enabled) flush(); }
