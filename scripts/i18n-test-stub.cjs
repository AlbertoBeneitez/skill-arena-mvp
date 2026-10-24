// Spanish i18n for presentation tests: the real dictionary and formatting, no React store.
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../lib/i18n/messages/es.ts"), "utf8");
const body = source.slice(source.indexOf("const es = {") + "const es = ".length, source.indexOf("} as const;") + 1);
const es = new Function(`return (${body});`)();
const t = (key, vars) => {
  const text = es[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? String(vars[n]) : m)) : text;
};
const formatNumber = (value, options) => new Intl.NumberFormat("es-ES-u-nu-latn", options).format(value);
module.exports = {
  t,
  tDynamic: (key, fallback) => (key in es ? t(key) : fallback),
  formatNumber,
  formatMoney: (value) => formatNumber(value, { style: "currency", currency: "EUR" }),
  useI18n: () => ({ t, formatNumber }),
};
