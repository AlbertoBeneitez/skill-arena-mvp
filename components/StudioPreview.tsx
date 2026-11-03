"use client";
/**
 * Owner review of a submitted game (v142). The package is downloaded and unpacked here; game.html runs in a sandboxed
 * frame (scripts only: an opaque origin with no access to this app, its cookies or storage) under a policy that
 * forbids any network; the host side of the protocol starts a match with a fresh seed, records every input the game
 * reports, and when the game says it has ended, replays those inputs on the package's own core.wasm. The two scores
 * must agree: that is the same verification a published match goes through.
 */
import { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";
import { t, useI18n } from "@/lib/i18n";
import { replayCore, seedWords, type Manifest } from "@/lib/studio/package";

const FRAME_POLICY = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' data: blob:; style-src 'unsafe-inline' data:; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; frame-src 'none'; form-action 'none'; base-uri 'none'";
type Pkg = { html: string; core: Uint8Array; manifest: Manifest };
type Outcome = { ui: number; core: number; inputs: number; ticks: number } | null;

const freshSeed = () => { const b = new Uint32Array(2); crypto.getRandomValues(b); return `review-${b[0].toString(36)}${b[1].toString(36)}`; };

export default function StudioPreview({ id, game, onClose }: { id: string; game: string; onClose: () => void }) {
  useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [error, setError] = useState(false);
  const [seed, setSeed] = useState(freshSeed);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [inputs, setInputs] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`/api/studio/proposals?id=${id}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((buf) => {
      const files = unzipSync(new Uint8Array(buf));
      const name = (n: string) => Object.keys(files).find((k) => k === n || k.endsWith(`/${n}`));
      const html = name("game.html"), core = name("core.wasm"), mf = name("galactic.json");
      if (!html || !core || !mf) throw new Error("package");
      if (live) setPkg({ html: new TextDecoder().decode(files[html]), core: files[core], manifest: JSON.parse(new TextDecoder().decode(files[mf])) });
    }).catch(() => live && setError(true));
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    if (!pkg) return;
    const recorded: [number, number][] = [];
    setOutcome(null); setInputs(0);
    const [seedLo, seedHi] = seedWords(seed);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data.type !== "string") return;
      const m = e.data as { type: string; tick?: number; action?: number; score?: number };
      if (m.type === "gg:ready") frame.current?.contentWindow?.postMessage({ type: "gg:start", seed, seedLo, seedHi }, "*");
      else if (m.type === "gg:input" && Number.isInteger(m.tick) && Number.isInteger(m.action) && recorded.length < 200_000) {
        recorded.push([m.tick as number, m.action as number]); setInputs(recorded.length);
      } else if (m.type === "gg:end") {
        const ex = new WebAssembly.Instance(new WebAssembly.Module(pkg.core as BufferSource), {}).exports as Record<string, unknown>;
        const r = replayCore(ex, seedLo, seedHi, recorded, pkg.manifest.maxTicks);
        setOutcome({ ui: Number(m.score), core: r.score, inputs: recorded.length, ticks: r.ticks });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pkg, seed]);

  const srcDoc = pkg ? `<!doctype html><meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY}">${pkg.html.replace(/^\s*<!doctype[^>]*>/i, "")}` : undefined;
  const match = outcome && outcome.ui === outcome.core;
  return (
    <div className="studioPreview" role="dialog" aria-modal="true" aria-label={t("studio.previewTitle", { game })}>
      <header className="studioHead">
        <h2>{t("studio.previewTitle", { game })}</h2>
        <button type="button" className="studioClose" onClick={onClose} aria-label={t("studio.close")}>✕</button>
      </header>
      <div className="studioFrame">
        {error ? <p className="studioStatus">{t("studio.failed")}</p>
          : srcDoc ? <iframe key={seed} ref={frame} title={game} sandbox="allow-scripts" srcDoc={srcDoc} referrerPolicy="no-referrer" />
          : <p className="studioStatus">{t("studio.checking")}</p>}
      </div>
      <p className="studioVerdict" role="status" aria-live="polite" data-state={outcome ? (match ? "ok" : "fail") : "wait"}>
        {outcome ? t(match ? "studio.previewMatch" : "studio.previewMismatch", { ui: outcome.ui, core: outcome.core, n: outcome.inputs })
          : t("studio.previewPlay", { n: inputs })}
      </p>
      <button type="button" className="studioReplay" onClick={() => setSeed(freshSeed())}>{t("studio.previewAgain")}</button>
    </div>
  );
}
