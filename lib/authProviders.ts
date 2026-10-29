/**
 * Sign-in providers shown on the welcome screen (v121).
 *
 * This is presentation and configuration scaffolding only. No provider is wired to a real
 * identity flow: production identity needs an approved ADR, server-side OAuth/OIDC handling,
 * secrets kept in the deployment environment and the RGPD consent/deletion paths
 * (see docs/AUTH_PROVIDERS.md). Until then every provider reports "not-configured" and the
 * welcome screen keeps the local session as the working entry.
 */
export type AuthProviderId = "google" | "apple" | "x" | "discord" | "microsoft";

export type AuthProviderInfo = {
  id: AuthProviderId;
  /** Brand name as each provider asks it to be written on sign-in buttons. */
  name: string;
  /** "primary" = full-width button, "secondary" = compact icon button under "Otras cuentas". */
  placement: "primary" | "secondary";
  protocol: "OpenID Connect" | "OAuth 2.0";
  /** Server-side settings the integration would need (names only; values never live in the repo). */
  serverConfig: readonly string[];
  /** Whether the provider returns a verified email we could use for account recovery. */
  email: "verified" | "relay-or-hidden" | "not-guaranteed";
};

export const AUTH_PROVIDERS: readonly AuthProviderInfo[] = [
  { id: "google", name: "Google", placement: "primary", protocol: "OpenID Connect", serverConfig: ["AUTH_GOOGLE_CLIENT_ID", "AUTH_GOOGLE_CLIENT_SECRET"], email: "verified" },
  { id: "apple", name: "Apple", placement: "primary", protocol: "OpenID Connect", serverConfig: ["AUTH_APPLE_SERVICES_ID", "AUTH_APPLE_TEAM_ID", "AUTH_APPLE_KEY_ID", "AUTH_APPLE_PRIVATE_KEY"], email: "relay-or-hidden" },
  { id: "x", name: "X", placement: "secondary", protocol: "OAuth 2.0", serverConfig: ["AUTH_X_CLIENT_ID", "AUTH_X_CLIENT_SECRET"], email: "not-guaranteed" },
  { id: "discord", name: "Discord", placement: "secondary", protocol: "OAuth 2.0", serverConfig: ["AUTH_DISCORD_CLIENT_ID", "AUTH_DISCORD_CLIENT_SECRET"], email: "verified" },
  { id: "microsoft", name: "Microsoft", placement: "secondary", protocol: "OpenID Connect", serverConfig: ["AUTH_MICROSOFT_CLIENT_ID", "AUTH_MICROSOFT_CLIENT_SECRET"], email: "verified" },
];

export type ProviderAvailability = "not-configured";

/**
 * Production identity is not activated in this version (AGENTS.md: stop before production auth
 * activation), so the answer is fixed. When an identity backend is approved this becomes the
 * single switch the welcome screen reads.
 */
export function providerAvailability(_id: AuthProviderId): ProviderAvailability {
  return "not-configured";
}
