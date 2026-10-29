/**
 * Sign-in providers shown on the welcome screen (client-safe metadata).
 *
 * v122 (owner request, 29 Oct 2026): the server flow is live in app/api/auth/* and turns each provider
 * on as soon as its credentials and AUTH_SECRET exist in the deployment environment
 * (see docs/AUTH_PROVIDERS.md). The browser asks /api/auth/session which providers are configured.
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

/** Server variable shared by every provider: the cookie signing key (≥ 32 characters). */
export const AUTH_SHARED_CONFIG = ["AUTH_SECRET"] as const;
