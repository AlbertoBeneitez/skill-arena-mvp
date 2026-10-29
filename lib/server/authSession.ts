/**
 * Sign-in session (v122): a signed, httpOnly cookie on the player's own device.
 *
 * Data minimisation (RGPD): only the provider, the provider's stable account id and a display name
 * are kept; no e-mail, no tokens, nothing stored on the server. Logging out or "borrar datos" clears
 * the cookie. The cookie is HMAC-SHA256 signed with AUTH_SECRET (≥ 32 chars, deployment env only).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthProviderId } from "@/lib/authProviders";

export const SESSION_COOKIE = "ga_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;
export const MIN_AUTH_SECRET_LENGTH = 32;

export type AuthSession = {
  /** provider */
  p: AuthProviderId;
  /** provider account id (subject) */
  sub: string;
  /** display name, trimmed */
  n: string;
  iat: number;
  exp: number;
};

type Env = Record<string, string | undefined>;

export function authSecret(env: Env = process.env): string | null {
  const s = env.AUTH_SECRET;
  return s && s.length >= MIN_AUTH_SECRET_LENGTH ? s : null;
}

const b64u = (b: Buffer) => b.toString("base64url");
const sign = (body: string, secret: string) => b64u(createHmac("sha256", secret).update(body).digest());

export function encodeSession(s: AuthSession, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(s), "utf8"));
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(value: string | undefined, secret: string, nowS = Math.floor(Date.now() / 1000)): AuthSession | null {
  if (!value || value.length > 2048) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot), mac = value.slice(dot + 1);
  const expected = sign(body, secret);
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthSession;
    if (typeof s.sub !== "string" || typeof s.n !== "string" || typeof s.exp !== "number" || s.exp <= nowS) return null;
    return s;
  } catch {
    return null;
  }
}

/** Display names come from third parties: strip controls and keep them short. */
export function cleanDisplayName(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

export function newState(): string {
  return b64u(randomBytes(24));
}

export function cookieHeader(name: string, value: string, opts: { maxAge: number; sameSite?: "Lax" | "None"; path?: string }) {
  const secure = process.env.NODE_ENV === "production" || opts.sameSite === "None";
  return [
    `${name}=${value}`,
    `Path=${opts.path ?? "/"}`,
    `Max-Age=${opts.maxAge}`,
    "HttpOnly",
    `SameSite=${opts.sameSite ?? "Lax"}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return undefined;
}
