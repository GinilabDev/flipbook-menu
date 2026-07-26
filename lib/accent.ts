// ---------------------------------------------------------------------------
// Section accents — shared by the page headers and the category picker, so a
// category wears the same colour wherever it shows up.
// ---------------------------------------------------------------------------

/**
 * Fallback section accents, for menus whose categories carry no colour of their
 * own. Muted mid-tones — they sit under a heading on white, so they need to read
 * as a divider rather than compete with the item cards.
 */
const SECTION_ACCENTS = [
  "#c2703d", // terracotta
  "#7d8c5c", // olive
  "#4f7a8c", // teal
  "#a8546b", // rosewood
  "#8a6ea8", // plum
  "#b0863c", // ochre
  "#5b7f6d", // sage
  "#96604a", // clay
  "#d9a05b", // mustard
  "#6b8ca3", // steel
  "#a88289", // mauve
  "#a65330", // rust
  "#3d5c4a", // pine
  "#bda68c", // stone
  "#616d7a", // slate
  "#867f99", // lavender
  "#b56b45", // copper
  "#6f7a46", // moss
];

/**
 * Pick a stable accent for a category from `SECTION_ACCENTS`.
 *
 * Deliberately a hash of the id rather than `Math.random()`: the page header and
 * the category picker must agree, the server and client renders have to agree,
 * and the colour can't change every time the page re-renders on a flip. Same id
 * in, same colour out.
 */
export function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SECTION_ACCENTS[Math.abs(h) % SECTION_ACCENTS.length];
}

/** A category's own colour when the admin set one, else its stable fallback. */
export function categoryAccent(cat: { id: string; color?: string }): string {
  return cat.color || accentFor(cat.id);
}
