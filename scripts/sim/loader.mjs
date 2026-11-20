// Bot simulator only: resolve the app's @/ alias and extensionless relative imports in the emitted JS (.sim-build).
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../../.sim-build/${specifier.slice(2)}.js`, import.meta.url).href, context);
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && (specifier.startsWith("./") || specifier.startsWith("../")) && !specifier.endsWith(".js"))
      return nextResolve(`${specifier}.js`, context);
    throw error;
  }
}
