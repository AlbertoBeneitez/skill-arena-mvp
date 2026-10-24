import type { MessageKey } from "./index";

export type DocId = "terms" | "privacy" | "cookies" | "rules" | "responsible" | "help" | "contact" | "licenses" | "about";
type Block = readonly ["h" | "p", MessageKey] | readonly ["qa", MessageKey, MessageKey];

/** Order of the information pages in Settings. */
export const DOC_ORDER: readonly DocId[] = ["terms", "privacy", "cookies", "rules", "responsible", "help", "contact", "licenses", "about"];

export const DOC_TITLES: Record<DocId, MessageKey> = {
  terms: "docs.terms",
  privacy: "docs.privacy",
  cookies: "docs.cookies",
  rules: "docs.rules",
  responsible: "docs.responsible",
  help: "docs.help",
  contact: "docs.contact",
  licenses: "docs.licenses",
  about: "docs.about",
};

export const DOC_BLOCKS: Record<DocId, readonly Block[]> = {
  terms: [
    ["h", "terms.h1"], ["p", "terms.p1"], ["h", "terms.h2"], ["p", "terms.p2"], ["h", "terms.h3"], ["p", "terms.p3"],
    ["h", "terms.h4"], ["p", "terms.p4"], ["h", "terms.h5"], ["p", "terms.p5"], ["h", "terms.h6"], ["p", "terms.p6"],
    ["h", "terms.h7"], ["p", "terms.p7"],
  ],
  privacy: [
    ["h", "privacy.h1"], ["p", "privacy.p1"], ["p", "privacy.p2"], ["p", "privacy.p3"],
    ["h", "privacy.h2"], ["p", "privacy.p4"], ["h", "privacy.h3"], ["p", "privacy.p5"],
  ],
  cookies: [["p", "cookies.p1"], ["p", "cookies.p2"], ["p", "cookies.p3"]],
  rules: [["p", "rules.p1"], ["p", "rules.p2"], ["p", "rules.p3"], ["p", "rules.p4"]],
  responsible: [["p", "responsible.p1"], ["p", "responsible.p2"], ["p", "responsible.p3"], ["p", "responsible.p4"]],
  help: [
    ["qa", "help.q1", "help.a1"], ["qa", "help.q2", "help.a2"], ["qa", "help.q3", "help.a3"],
    ["qa", "help.q4", "help.a4"], ["qa", "help.q5", "help.a5"], ["qa", "help.q6", "help.a6"],
  ],
  contact: [],
  licenses: [["p", "licenses.p1"]],
  about: [["p", "about.p1"], ["p", "about.p2"]],
};

/** Third-party code and assets (names and licences are not translated). */
export const LICENSES = [
  { name: "Next.js", license: "MIT" },
  { name: "React", license: "MIT" },
  { name: "node-postgres (pg)", license: "MIT" },
  { name: "Unbounded (font)", license: "SIL Open Font License 1.1" },
  { name: "Tower Building Game", license: "MIT" },
  { name: "2048", license: "MIT" },
  { name: "Phaser 3 TypeScript examples", license: "MIT" },
  { name: "sausi-7/games", license: "MIT" },
  { name: "wayou/t-rex-runner", license: "BSD 3-Clause" },
] as const;
