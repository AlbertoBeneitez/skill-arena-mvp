# Orb Burst V1 boundaries

`orbBurstCore.v1.ts` is authoritative and pure; rendering/touch/audio cannot alter its state. The light protocol module supplies registry metadata without importing physics eagerly. `CoreCanvasGame` owns tick scheduling, input recording, cancellation and verification; `coreAdapter` performs server replay. No new scenario, lifecycle or verifier subsystem exists.

Every scenario uses the existing server-issued manifest seed and game version. Board generation is keyed by sector; ammunition by sector/bag; pressure by sector/row. Catalog seed generation remains the existing shared implementation. Real two-player issuance and durable result consumption still require the staged production integrations; this release does not activate them.

Input down/move selects a bounded discrete aim; owning pointer-up shoots. A cancelled or unrelated release cannot fire. One shot may be in flight; another cannot be accepted during flight or the 18-tick settling interval. Arrow keys and the explicit launch control are alternatives. Timing, board overflow, removal, score and sector progression are replayed on the server.

Collision and velocity use integers in thousandths of a logical pixel. A shot moves less than 5.2 logical pixels per tick; collision diameter is 34.56, preventing tunnelling through a stationary orb. Distances and rational trigonometry products stay below JavaScript's safe integer range. The UI's aim-angle calculation merely selects an input token. Forecast clones the state and runs the same physics; it cannot mutate the live simulation or record inputs.

The previous 0.1.0 component is retained as historical source. It was not a verified core and is no longer loaded by the active catalogue. Frozen verified games and their adapters remain unchanged.
