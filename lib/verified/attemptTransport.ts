"use client";
let bootstrap: Promise<{ durable: boolean }> | undefined;
/** Share only the in-flight cookie bootstrap, including React StrictMode mounts. */
export function ensureAttemptSession() {
  if (!bootstrap)
    bootstrap = fetch("/api/verified-match/session", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "MATCH_STORAGE_UNAVAILABLE");
        return { durable: body.durable === true };
      })
      .finally(() => {
        bootstrap = undefined;
      });
  return bootstrap;
}
export async function submitAttemptRecord(
  body: string,
  signal: AbortSignal,
  durable: boolean,
) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch("/api/verified-match/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
        keepalive: new TextEncoder().encode(body).byteLength <= 60000,
      });
      const result = await response.json();
      if (response.status !== 202 || !durable) return { response, result };
    } catch (error) {
      if (!durable || signal.aborted || Date.now() - started > 35000)
        throw error;
    }
    if (Date.now() - started > 35000)
      throw new Error("RECORD_STATUS_UNAVAILABLE");
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 750);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
}
