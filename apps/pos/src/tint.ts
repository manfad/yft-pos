// Deterministic soft-pastel tile colour derived from an item's name, so
// manually-added items look distinct without anyone picking a colour.
export function tintFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 50%, 86%)`;
}
