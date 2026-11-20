#!/usr/bin/env bash
# Bot simulator · starts the production build locally (next start) against its own PostgreSQL database, with durable
# matches on, exactly as Vercel would run with ALLOW_PERSISTED_MATCH_TRAINING=1. Costs nothing: nothing leaves this machine.
# Usage: SIM_DATABASE_URL=postgres://qa:qa@127.0.0.1:5432/skill_arena_sim scripts/sim/start-server.sh
set -euo pipefail
: "${SIM_DATABASE_URL:?set SIM_DATABASE_URL to a local, throwaway database}"
case "$SIM_DATABASE_URL" in *127.0.0.1*|*localhost*) ;; *) echo "SIM_DATABASE_URL must be local" >&2; exit 1;; esac
export SIM_AUTH_SECRET="${SIM_AUTH_SECRET:-sim-local-secret-0123456789-abcdefghijkl}"
AUTH_SECRET="$SIM_AUTH_SECRET" MATCH_SIGNING_SECRET="sim-local-signing-0123456789-abcdefghijkl" \
DATABASE_URL="$SIM_DATABASE_URL" ALLOW_PERSISTED_MATCH_TRAINING=1 \
exec pnpm exec next start -p "${SIM_PORT:-3200}"
