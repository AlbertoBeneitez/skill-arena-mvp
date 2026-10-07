# ADR 004 — Game module boundaries

## Context

Games need freedom to use Canvas, React, DOM, WebGL or adapted engines without
leaking their internal physics into platform code.

## Decision

The external contract is common, but internal architecture is not forced.
Complex games separate competitive core, typed input, presentation and
feedback. Platform code owns session/economy/matchmaking; game code owns rules
and rendering.

## Consequences

A game can be radically reworked internally without changing wallet,
matchmaking or global UI. Small games are not fragmented into artificial
folders merely to satisfy a template.
