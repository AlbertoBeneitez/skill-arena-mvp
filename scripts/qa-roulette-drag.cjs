// Current native hand-toss/cancel/blur/one-record entry point. Historical V1 core tests remain immutable.
process.env.QA_LAYOUT_ONLY = "1";
require("./qa-roulette-touch.cjs");
