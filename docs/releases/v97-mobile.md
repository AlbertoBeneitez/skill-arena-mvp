# v97-mobile — fixed Birds levels, signed reels and slow clocks

Owner's six-point follow-up (13 October 2026) overrides the continuous-field rule
only for Birds. The following changes use the existing registry, input recorder,
server replay adapters and deterministic utilities; historical cores stay frozen.

- Avatar setup: the circular arrow opens the native photo picker directly. The
  existing crop/zoom/save flow remains, the same file can be chosen again, and
  upload errors remain visible without opening a second panel. The original
  sixteen supplied images are absent from the available attachments/repository;
  only eight existing SVG choices are available. Their integration remains
  blocked on obtaining the originals; no replacements or duplicates are claimed.
- Birds5.0.0: six fixed-screen levels, one distinct assembly/two targets per
  level, ninety-tick clearance transition, shared thirty-shot queue and four-minute
  deadline. Camera never tracks the projectile and no horizontal world radar is
  shown. Fallen-load damage/debris from V4 remain. Server reconstructs levels,
  total unique targets, shared ammunition and scoring. AGENTS records this explicit
  owner-requested exception so future work does not remove it accidentally.
- Roulette3.0.0: vertical launch velocity scales with force (450+70×impulse).
  Three-dimensional velocity reflects against cone/bowl surface normals with
  0.62restitution and contact friction. Inclined contacts change radial velocity
  as well as height; rim, gravity, authoritative pocket selection and fictitious
  accounting remain deterministic. Zenithal height is measured above the local
  surface and affects ball/shadow scale and separation. V1/V2 are preserved.
- Slot2.0.0: signed movement from−3to+3, actual short forward/backward animation,
  1.5second settlement and no extra decorative full turns. Individual zero reels
  remain possible, but000 SPIN is unavailable and never charges/records a wager.
  Range limits and all-zero rejection are authoritative; HUD identifies the
  unavailable combination. Original V1 fixture now requests V1 explicitly rather
  than accidentally testing the latest registry version.
- Darts presentation: points appear at the authoritative impact, followed by a
  persistent last-throw total. Embedded darts and V3 simulation/scoring are kept.
- Jet5.0.0:270seconds (+50%), bodies24–96px wide, seeded aperture/spacing/centre
  variation and progressively tighter windows/faster flight/wider bodies.
  Gold clocks collect once, slow vertical physics and world travel to half rate
  for four real seconds, and never pause the real match deadline. Existing lives,
  recharge pickups, dual corridors and server input replay are preserved.

Validation: complete deterministic suite and production build pass. Four new
versions have terminal goldens,60/120/144Hz parity, malformed/duplicated input
checks and signed server replay ignoring fabricated client scores.64 stable
Birds openings, inclined-normal reflection, signed reel positions/no000, clock
collection/half-speed/real deadline and varying tube collision widths pass.
Native390×844/844×390: direct photo chooser/crop, no000charge/one short spin,
Darts impact/last points and all six Birds levels (13and12shots, verified wins).
Roulette320×568/568×320:49bets, fixed trigger, cancel/blur, one toss and abandoned
receipt. Native Jet reached203portals/23clocks and a server-verified collision
terminal (23212ticks); the signed270second full-win golden also passes. Native
player uses actual visible tubes to avoid clock-induced prediction drift.

Delivery follows GitHub CI and the exact-commit Vercel preview. mobile-test is
promoted only by fast-forward after both are successful. Original sixteen-avatar
assets remain the explicit incomplete item. No production identity/money is
activated; the broader backlog and physical-device QA remain separate.
