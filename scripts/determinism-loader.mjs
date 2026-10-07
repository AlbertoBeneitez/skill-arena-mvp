// Node test runner only. Keep the application's Bundler type resolution;
// resolve its extensionless relative imports and @/ alias in emitted test JS.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = new URL(`../.det-test/${specifier.slice(2)}.js`, import.meta.url);
    return nextResolve(url.href, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.endsWith(".js")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
