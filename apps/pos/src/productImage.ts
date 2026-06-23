// Bundle the product photos (copied from the original backend/images) and
// resolve them by item key or by an image path like "/images/talapia".
const mods = import.meta.glob("./assets/products/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(mods)) {
  const key = path.split("/").pop()!.replace(/\.png$/, "");
  byKey[key] = url;
}

/** Resolve a key ("talapia") or path ("/images/talapia") to a bundled URL. */
export function productImage(keyOrPath?: string | null): string | null {
  if (!keyOrPath) return null;
  const key = keyOrPath.split("/").pop()!.replace(/\.[a-z]+$/i, "");
  return byKey[key] ?? null;
}

/** As a CSS background-image value, falling back to `none` (shows the tint). */
export function imageCss(keyOrPath?: string | null): string {
  const url = productImage(keyOrPath);
  return url ? `url('${url}')` : "none";
}
