# v28-mobile — retire Pulse Runner

Base: v27-mobile 54f861e2678b6f53177cc80626a74e7f6977566e.

Removed Pulse Runner from the single game registry and catalogue ordering. The common loader derives its entries from that registry, so it needs no exception. Removed the unused component and original cover; removed exclusive CSS selectors while retaining every shared rule for other games. No independent route, server core, authoritative verifier or dedicated test existed. Historical release documentation and earlier branches remain intact.

Validation: no runtime/import/asset/test references in app, lib, components, public or scripts; typecheck and all deterministic historical/current fixtures passed; production build passed. Chromium catalogue QA found 18 games and loaded covers; 36 mount/unmount checks (portrait and landscape) passed without page errors. These mounting checks do not replace full gameplay or physical-device QA.

Pending: Stack camera/teaching, Tower vertical composition/HUD, Jet explosion/HUD, Orb progression, other game product work, billiards, darts, net-profit ranking and human mobile QA. No real-money competition activated.
