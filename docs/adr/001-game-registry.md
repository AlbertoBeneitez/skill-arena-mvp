# ADR 001 — Typed game registry

## Context

Game metadata lived in `lib/games.ts`, while `GameLoader.tsx` separately
contained imports and a game-id switch. Adding a game required editing several
independent declarations.

## Decision

`lib/games.ts` is the single typed registry. Each entry owns identity,
version, maturity, metadata, lazy component loader and competition capability.
`GameLoader` derives its dynamic components from this registry and contains no
per-game switch.

## Consequences

There is one catalogue source of truth and lazy loading remains intact. Legacy
components use one explicit compatibility cast until migrated. Server replay
execution remains server-only, but it resolves identity/version from the same
registry rather than declaring separate metadata.
