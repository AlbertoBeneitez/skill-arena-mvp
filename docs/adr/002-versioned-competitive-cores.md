# ADR 002 — Versioned competitive cores

## Context

Competitive replays must remain reproducible after a game evolves.

## Decision

Outcome-affecting logic lives in a pure, versioned core. Once a version has produced persistent competitive matches, its behaviour is frozen. A rules or physics change creates a new game version/core instead of modifying history. Server replay adapters are retained in an append-only archive keyed by `game_id + game_version`; they do not resolve historical manifests through only the current catalogue version.

## Consequences

Old matches remain auditable even after the public registry advances to a newer version. Presentation can evolve independently. The cost is retaining old cores and replay adapters while historical replay support is required.
