"use client";
/**
 * The runtime of a studio game (v142 review, shared with the published player since v147). The package is downloaded
 * and unpacked here; game.html runs in a sandboxed frame (scripts only: an opaque origin with no access to this app,
 * its cookies or storage) under a policy that forbids any network. The host side of the protocol starts a match with a
 * seed, records every input the game reports and, when the game says it has ended, replays those inputs on the
 * package's own core.wasm: the core's score is the result; the interface's is only compared with it.
 */
import { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";
import { replayCore, seedWords, type Manifest } from "@/lib/studio/package";

const FRAME_POLICY = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' data: blob:; style-src 'unsafe-inline' data:; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; frame-src 'none'; form-action 'none'; base-uri 'none'";
export type StudioPackage = { html: string; core: Uint8Array; manifest: Manifest };
export type StudioOutcome = { ui: number; core: number; inputs: number; ticks: number };
export const freshSeed = (prefix = "play") => { const b = new Uint32Array(2); crypto.getRandomValues(b); return `${prefix}-${b[0].toString(36)}${b[1].toString(36)}`; };

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
/** Downloads and unpacks a package. With `sha256`, a package whose hash differs is refused ("integrity"). */
export function useStudioPackage(url: string, sha256?: string) {
  const [pkg, setPkg] = useState<StudioPackage | null>(null);
  const [error, setError] = useState<null | "load" | "integrity">(null);
  useEffect(() => {
    let live = true;
    setPkg(null); setError(null);
    (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("load");
      const buf = await r.arrayBuffer();
      if (sha256 && hex(await crypto.subtle.digest("SHA-256", buf)) !== sha256) { if (live) setError("integrity"); return; }
      const files = unzipSync(new Uint8Array(buf));
      const name = (n: string) => Object.keys(files).find((k) => k === n || k.endsWith(`/${n}`));
      const html = name("game.html"), core = name("core.wasm"), mf = name("galactic.json");
      if (!html || !core || !mf) throw new Error("load");
      if (live) setPkg({ html: new TextDecoder().decode(files[html]), core: files[core], manifest: JSON.parse(new TextDecoder().decode(files[mf])) });
    })().catch(() => live && setError("load"));
    return () => { live = false; };
  }, [url, sha256]);
  return { pkg, error };
}

/** One match of a studio game. A new `seed` (it is the frame's key) starts a new match. */
export default function StudioGameFrame({ pkg, seed, title, onInputs, onResult }: {
  pkg: StudioPackage; seed: string; title: string; onInputs?: (n: number) => void; onResult: (o: StudioOutcome) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const cb = useRef({ onInputs, onResult });
  cb.current = { onInputs, onResult };
  useEffect(() => {
    const recorded: [number, number][] = [];
    let done = false;
    const [seedLo, seedHi] = seedWords(seed);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data.type !== "string" || done) return;
      const m = e.data as { type: string; tick?: number; action?: number; score?: number };
      if (m.type === "gg:ready") frame.current?.contentWindow?.postMessage({ type: "gg:start", seed, seedLo, seedHi }, "*");
      else if (m.type === "gg:input" && Number.isInteger(m.tick) && Number.isInteger(m.action) && recorded.length < 200_000) {
        recorded.push([m.tick as number, m.action as number]); cb.current.onInputs?.(recorded.length);
      } else if (m.type === "gg:end") {
        done = true;
        const ex = new WebAssembly.Instance(new WebAssembly.Module(pkg.core as BufferSource), {}).exports as Record<string, unknown>;
        const r = replayCore(ex, seedLo, seedHi, recorded, pkg.manifest.maxTicks);
        cb.current.onResult({ ui: Number(m.score), core: r.score, inputs: recorded.length, ticks: r.ticks });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pkg, seed]);
  const srcDoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY}">${pkg.html.replace(/^\s*<!doctype[^>]*>/i, "")}`;
  return <iframe key={seed} ref={frame} title={title} sandbox="allow-scripts" srcDoc={srcDoc} referrerPolicy="no-referrer" />;
}
