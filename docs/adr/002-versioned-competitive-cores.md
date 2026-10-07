# ADR 002 — Versioned competitive cores

## Context

Competitive replays must remain reproducible after a game evolves.

## Decision

Outcome-affecting logic lives in a pure, versioned core. Once a version has
produced persistent competitive matches, its behaviour is frozen. A rules or
physics change creates a new game version/core instead of modifying history.

## Consequences

Old matches remain auditable. Presentation can evolve independently. The cost
is retaining old core versions while historical replay support is required.
