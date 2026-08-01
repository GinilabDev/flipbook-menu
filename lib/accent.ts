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

/**
 * Black or white, whichever stays readable on `hex`. Brand colours come from
 * whatever theme the restaurant picked — some are near-black, some near-white —
 * so the text colour can't be hard-coded. Standard sRGB relative luminance.
 *
 * Lives here rather than beside the cover that first needed it: the cover's
 * placeholder has to reach the same answer, and a skeleton has no business
 * importing the whole page component to get it.
 */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const channel = (i: number) => {
    const v = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.45 ? "#262626" : "#ffffff";
}
