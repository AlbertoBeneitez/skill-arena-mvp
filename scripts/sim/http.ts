/**
 * Bot simulator · an HTTP client that behaves like one phone: its own cookies, same-site headers, JSON bodies.
 * Safety: it only ever talks to a local server (localhost / 127.0.0.1). Never point it at Vercel: that would cost
 * money and fill real tables with bots.
 */
import { createHmac, randomUUID } from "node:crypto";

export const BASE = process.env.SIM_BASE ?? "http://127.0.0.1:3200";
const host = new URL(BASE).hostname;
if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`SIM_BASE must be local, got ${BASE}`);

/** Same format as lib/server/authSession.ts: what the OAuth callback would set after a real sign-in. */
export function mintSession(sub: string, name: string, secret: string, ttlS = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ p: "google", sub, n: name, iat: now, exp: now + ttlS })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

export type Res = { status: number; body: any; ms: number; path: string; method: string };

export class Phone {
  readonly cookies = new Map<string, string>();
  readonly log: Res[] = [];
  constructor(readonly label: string, readonly opts: { origin?: string | null } = {}) {}

  setCookie(name: string, value: string) { this.cookies.set(name, value); }

  async call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
    const headers: Record<string, string> = { accept: "application/json", ...extra };
    if (this.opts.origin !== null) headers.origin = this.opts.origin ?? BASE;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const t0 = performance.now();
    let status = 0, parsed: any = null;
    try {
      const send = () => fetch(BASE + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect: "manual" });
      // A reused keep-alive socket can be closed by the server at the same moment: retry once, like a phone would.
      const r = await send().catch(async () => { await sleep(300); return send(); });
      status = r.status;
      for (const c of r.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        const name = pair.slice(0, i), value = pair.slice(i + 1);
        if (/max-age=0/i.test(c) || value === "") this.cookies.delete(name); else this.cookies.set(name, value);
      }
      const text = await r.text();
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text.slice(0, 300); }
    } catch (e) {
      parsed = { networkError: String(e) };
    }
    const res = { status, body: parsed, ms: Math.round(performance.now() - t0), path, method };
    this.log.push(res);
    return res;
  }
  get = (path: string) => this.call("GET", path);
  post = (path: string, body?: unknown) => this.call("POST", path, body ?? {});
  patch = (path: string, body?: unknown) => this.call("PATCH", path, body ?? {});
}

export const uuid = () => randomUUID();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
