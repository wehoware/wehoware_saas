// Test loader: resolves "@/x" imports to "src/x" and extensionless relative
// imports to .js files, for plain-node scripts (Next resolves these for us).
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    let p = "src/" + specifier.slice(2);
    if (!/\.\w+$/.test(p)) p += ".js";
    return next(new URL("../" + p, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.\w+$/.test(specifier)) {
    return next(new URL(specifier + ".js", context.parentURL).href, context);
  }
  return next(specifier, context);
}
