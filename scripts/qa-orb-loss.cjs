// Same native public-drawing actor; choose deliberate legal misses for overflow.
process.env.QA_LOSS = "1";
require("./qa-orb-touch.cjs");
