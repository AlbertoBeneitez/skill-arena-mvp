/**
 * Server side of the sign-in providers (v122). Each provider is live as soon as its credentials and
 * AUTH_SECRET exist in the deployment environment; nothing is hard-coded and no secret is in the repo.
 */
import { Apple, Discord, Google, MicrosoftEntraId, Twitter, decodeIdToken, generateCodeVerifier, type OAuth2Tokens } from "arctic";
import { AUTH_PROVIDERS, type AuthProviderId } from "@/lib/authProviders";
import { authSecret, cleanDisplayName } from "./authSession";

type Env = Record<string, string | undefined>;

export function isAuthProviderId(v: string): v is AuthProviderId {
  return AUTH_PROVIDERS.some((p) => p.id === v);
}

export function providerConfigured(id: AuthProviderId, env: Env = process.env): boolean {
  const info = AUTH_PROVIDERS.find((p) => p.id === id);
  return !!info && !!authSecret(env) && info.serverConfig.every((k) => !!env[k]);
}

export function configuredProviders(env: Env = process.env): AuthProviderId[] {
  return AUTH_PROVIDERS.filter((p) => providerConfigured(p.id, env)).map((p) => p.id);
}

/** Stable public origin for redirect URIs: AUTH_URL when set (recommended), otherwise the request's own origin. */
export function publicOrigin(req: Request, env: Env = process.env): string {
  const fixed = env.AUTH_URL?.replace(/\/+$/, "");
  if (fixed && /^https?:\/\//.test(fixed)) return fixed;
  return new URL(req.url).origin;
}

export const redirectUri = (origin: string, id: AuthProviderId) => `${origin}/api/auth/${id}/callback`;

/** Apple private keys are stored as PEM text (newlines may arrive escaped as "\n"). */
function pkcs8(pem: string): Uint8Array {
  const body = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(body, "base64"));
}

export type AuthStart = { url: URL; verifier: string | null };

export function startAuthorization(id: AuthProviderId, origin: string, state: string, env: Env = process.env): AuthStart {
  const r = redirectUri(origin, id);
  const verifier = generateCodeVerifier();
  switch (id) {
    case "google":
      return { url: new Google(env.AUTH_GOOGLE_CLIENT_ID!, env.AUTH_GOOGLE_CLIENT_SECRET!, r).createAuthorizationURL(state, verifier, ["openid", "profile"]), verifier };
    case "apple": {
      const url = new Apple(env.AUTH_APPLE_SERVICES_ID!, env.AUTH_APPLE_TEAM_ID!, env.AUTH_APPLE_KEY_ID!, pkcs8(env.AUTH_APPLE_PRIVATE_KEY!), r).createAuthorizationURL(state, ["name"]);
      url.searchParams.set("response_mode", "form_post"); // required by Apple when a scope is requested
      return { url, verifier: null };
    }
    case "x":
      return { url: new Twitter(env.AUTH_X_CLIENT_ID!, env.AUTH_X_CLIENT_SECRET!, r).createAuthorizationURL(state, verifier, ["users.read", "tweet.read"]), verifier };
    case "discord":
      return { url: new Discord(env.AUTH_DISCORD_CLIENT_ID!, env.AUTH_DISCORD_CLIENT_SECRET!, r).createAuthorizationURL(state, verifier, ["identify"]), verifier };
    case "microsoft":
      return { url: new MicrosoftEntraId("common", env.AUTH_MICROSOFT_CLIENT_ID!, env.AUTH_MICROSOFT_CLIENT_SECRET!, r).createAuthorizationURL(state, verifier, ["openid", "profile"]), verifier };
  }
}

export type AuthProfile = { sub: string; name: string };

type Claims = { sub?: string; name?: string; given_name?: string; preferred_username?: string };

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`PROFILE_${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** Exchange the code and read the minimum profile: account id and display name. */
export async function finishAuthorization(id: AuthProviderId, origin: string, code: string, verifier: string | null, appleUser: string | null, env: Env = process.env): Promise<AuthProfile> {
  const r = redirectUri(origin, id);
  let tokens: OAuth2Tokens;
  switch (id) {
    case "google": {
      tokens = await new Google(env.AUTH_GOOGLE_CLIENT_ID!, env.AUTH_GOOGLE_CLIENT_SECRET!, r).validateAuthorizationCode(code, verifier!);
      const c = decodeIdToken(tokens.idToken()) as Claims; // received straight from Google's token endpoint over TLS
      return { sub: String(c.sub), name: cleanDisplayName(c.given_name || c.name) };
    }
    case "apple": {
      tokens = await new Apple(env.AUTH_APPLE_SERVICES_ID!, env.AUTH_APPLE_TEAM_ID!, env.AUTH_APPLE_KEY_ID!, pkcs8(env.AUTH_APPLE_PRIVATE_KEY!), r).validateAuthorizationCode(code);
      const c = decodeIdToken(tokens.idToken()) as Claims;
      let name = "";
      try { name = (JSON.parse(appleUser ?? "{}") as { name?: { firstName?: string } }).name?.firstName ?? ""; } catch { /* Apple only sends the name the first time */ }
      return { sub: String(c.sub), name: cleanDisplayName(name) };
    }
    case "x": {
      tokens = await new Twitter(env.AUTH_X_CLIENT_ID!, env.AUTH_X_CLIENT_SECRET!, r).validateAuthorizationCode(code, verifier!);
      const me = (await fetchJson("https://api.twitter.com/2/users/me", tokens.accessToken())).data as { id?: string; name?: string; username?: string } | undefined;
      return { sub: String(me?.id), name: cleanDisplayName(me?.name || me?.username) };
    }
    case "discord": {
      tokens = await new Discord(env.AUTH_DISCORD_CLIENT_ID!, env.AUTH_DISCORD_CLIENT_SECRET!, r).validateAuthorizationCode(code, verifier);
      const me = await fetchJson("https://discord.com/api/users/@me", tokens.accessToken()) as { id?: string; global_name?: string; username?: string };
      return { sub: String(me.id), name: cleanDisplayName(me.global_name || me.username) };
    }
    case "microsoft": {
      tokens = await new MicrosoftEntraId("common", env.AUTH_MICROSOFT_CLIENT_ID!, env.AUTH_MICROSOFT_CLIENT_SECRET!, r).validateAuthorizationCode(code, verifier!);
      const c = decodeIdToken(tokens.idToken()) as Claims;
      return { sub: String(c.sub), name: cleanDisplayName(c.given_name || c.name || c.preferred_username?.split("@")[0]) };
    }
  }
}
