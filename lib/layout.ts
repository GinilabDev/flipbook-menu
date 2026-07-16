// ---------------------------------------------------------------------------
// Layout engine — turns menu data into flipbook pages.
//   • page 0        = cover
//   • each category = starts on a new page (section header), then a vertical
//                     stack of blocks: a full-width subcategory heading, and
//                     rows of item cards (2-up on a book, 1-up on a phone).
//                     Overflow spills to "continued" pages.
//   • last page     = back cover
// Page count is padded to stay even so react-pageflip pairs spreads cleanly.
//
// Pages are laid out in a FIXED design-pixel space (PAGE_W × PAGE_H) which the
// viewer scales to whatever the screen allows. That is what lets this file
// measure in px: a card is the same height on a phone and a desktop, so the
// page budget below is exact rather than a guess.
// ---------------------------------------------------------------------------

import type {
  Category,
  ItemGroup,
  Menu,
  MenuItem,
  Restaurant,
  Subcategory,
} from "@/lib/menu";
import { fromPrice, groupCategoryItems, orderedCategories } from "@/lib/menu";

/** Design-space page size. Ratio must match FlipbookViewer's `aspect`. */
export const PAGE_W = 400;
export const PAGE_H = 556;

/**
 * The section header is pinned to exactly this in MenuPage, so the budget below
 * is exact instead of a worst-case guess — which is worth a whole extra row of
 * items per page. Changing it means changing the header's `height` there.
 */
export const HEADER_H = 70;
/**
 * Kept clear at the foot of every page for the viewer's flip arrows, which are
 * drawn over the page corners — without it the last row of a full page hides
 * under an arrow and loses its taps.
 */
const FOOTER_H = 46;
/** Vertical px a page's block stack may hold. */
const PAGE_BUDGET = PAGE_H - HEADER_H - FOOTER_H;

// Block metrics — keep in sync with the CSS in MenuPage/ItemCard. Costs are px
// so a mis-set constant shows up as a half-empty page, not a broken one: the
// stack clips rather than overflows.
const GRID_GAP = 6;
const BLOCK_GAP = 6;
const CARD_PAD = 16;
const CARD_BORDER = 2;
const NAME_LINE_H = 14;
const NAME_MAX_LINES = 2;
const DESC_LINE_H = 12;
const DESC_MAX_LINES = 2;
const PRICE_ROW_H = 18;
const CARD_INNER_GAP = 4;
const THUMB_H = 40;
const THUMB_W = 48; // thumb + its gap
const BADGE_W = 12;
const SUBHEAD_H = 31;
const SUBHEAD_DESC_H = 22;

const NAME_FONT =
  "600 11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export type PageBlock =
  /**
   * A collapsible subcategory. Only the heading is costed against the page —
   * the items ride along and are revealed on click, which is why a page's
   * content can outgrow it and the stack scrolls.
   */
  | {
      kind: "group";
      key: string;
      subcategory: Subcategory;
      items: MenuItem[];
      /** cheapest item under this heading — the web's "from £x" */
      fromPrice: number;
    }
  | { kind: "row"; key: string; items: MenuItem[] };

export type LayoutPage =
  | { kind: "cover"; key: string; restaurant: Restaurant }
  | {
      kind: "section";
      key: string;
      category: Category;
      blocks: PageBlock[];
      /** cards per row — drives the grid in MenuPage */
      itemsPerRow: number;
      /** true for the 2nd+ page of a long category */
      continued: boolean;
      part: number;
      partCount: number;
    }
  | { kind: "back"; key: string; restaurant: Restaurant }
  | { kind: "blank"; key: string };

export interface LayoutOptions {
  /** item cards per row — 2 on a wide book, 1 on a phone */
  itemsPerRow: number;
}

/** Width of one item card in design px. */
function cardWidth(itemsPerRow: number): number {
  // 20 = the stack's horizontal padding.
  return (PAGE_W - 20 - (itemsPerRow - 1) * GRID_GAP) / itemsPerRow;
}

/** Width the name gets inside a card, after the thumb and any diet badges. */
function nameWidth(item: MenuItem, cardW: number): number {
  let w = cardW - CARD_PAD - CARD_BORDER;
  if (item.media?.some((m) => m.type === "image")) w -= THUMB_W;
  const badges =
    Number(item.hot ?? 0) + (item.nut ? 1 : 0) + (item.veg ? 1 : 0);
  if (badges) w -= badges * BADGE_W + 4;
  return Math.max(24, w);
}

/**
 * How many lines `text` wraps to at `maxWidth`. Uses a canvas to measure the
 * real font — greedy word wrap, the same way the browser breaks a line. Falls
 * back to a character estimate during SSR (where the result is thrown away
 * anyway: the book renders client-side only).
 */
const lineCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null | undefined;

function wrappedLines(text: string, maxWidth: number): number {
  if (!text) return 1;
  const cacheKey = `${maxWidth}|${text}`;
  const hit = lineCache.get(cacheKey);
  if (hit !== undefined) return hit;

  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined"
        ? null
        : (() => {
            const ctx = document.createElement("canvas").getContext("2d");
            if (ctx) ctx.font = NAME_FONT;
            return ctx;
          })();
  }

  let lines: number;
  if (!measureCtx) {
    lines = Math.ceil(text.length / Math.max(1, Math.floor(maxWidth / 6)));
  } else {
    const words = text.split(/\s+/).filter(Boolean);
    lines = 1;
    let width = 0;
    const spaceW = measureCtx.measureText(" ").width;
    for (const word of words) {
      const w = measureCtx.measureText(word).width;
      if (width === 0) width = w;
      else if (width + spaceW + w <= maxWidth) width += spaceW + w;
      else {
        lines++;
        width = w;
      }
    }
  }

  lines = Math.max(1, lines);
  lineCache.set(cacheKey, lines);
  return lines;
}

function cardCost(item: MenuItem, cardW: number): number {
  const lines = Math.min(
    NAME_MAX_LINES,
    wrappedLines(item.name, nameWidth(item, cardW)),
  );
  const text =
    lines * NAME_LINE_H + (item.shortDesc ? DESC_MAX_LINES * DESC_LINE_H : 0);
  const hasThumb = item.media?.some((m) => m.type === "image");
  const top = Math.max(text, hasThumb ? THUMB_H : 0);
  return CARD_PAD + CARD_BORDER + top + CARD_INNER_GAP + PRICE_ROW_H;
}

/** A row is as tall as its tallest card. */
function rowCost(items: MenuItem[], cardW: number): number {
  return Math.max(...items.map((it) => cardCost(it, cardW)));
}

/** Only the collapsed heading — its items cost nothing until expanded. */
function subheadCost(sub: Subcategory): number {
  return SUBHEAD_H + (sub.description ? SUBHEAD_DESC_H : 0);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Flow a category's groups into pages.
 *
 * A subcategory group is atomic: its heading is placed whole, carrying its
 * items, so a group is never split across pages and never needs a "(cont.)".
 * Categories without subcategories flow their items directly, as rows.
 */
function flowPages(groups: ItemGroup[], itemsPerRow: number): PageBlock[][] {
  const cardW = cardWidth(itemsPerRow);
  const pages: PageBlock[][] = [];
  let cur: PageBlock[] = [];
  let used = 0;

  const closePage = () => {
    if (cur.length) pages.push(cur);
    cur = [];
    used = 0;
  };

  const place = (block: PageBlock, cost: number) => {
    if (used + cost > PAGE_BUDGET && cur.length) closePage();
    cur.push(block);
    used += cost;
  };

  for (const group of groups) {
    const sub = group.subcategory;

    if (sub) {
      place(
        {
          kind: "group",
          key: `grp-${sub.id}`,
          subcategory: sub,
          items: group.items,
          fromPrice: fromPrice(group.items),
        },
        subheadCost(sub) + BLOCK_GAP,
      );
      continue;
    }

    for (const items of chunk(group.items, itemsPerRow)) {
      place(
        { kind: "row", key: `row-${items.map((i) => i.id).join("-")}`, items },
        rowCost(items, cardW) + BLOCK_GAP,
      );
    }
  }
  closePage();

  return pages;
}

export function buildPages(menu: Menu, opts: LayoutOptions): LayoutPage[] {
  const { itemsPerRow } = opts;
  const cats = orderedCategories(menu);

  const pages: LayoutPage[] = [
    { kind: "cover", key: "cover", restaurant: menu.restaurant },
  ];

  for (const category of cats) {
    const groups = groupCategoryItems(menu, category);
    const sectionPages = flowPages(groups, itemsPerRow);

    sectionPages.forEach((blocks, i) => {
      pages.push({
        kind: "section",
        key: `sec-${category.id}-${i}`,
        category,
        blocks,
        itemsPerRow,
        continued: i > 0,
        part: i + 1,
        partCount: sectionPages.length,
      });
    });
  }

  pages.push({ kind: "back", key: "back", restaurant: menu.restaurant });

  // Keep an even number of pages for clean spread pairing.
  if (pages.length % 2 !== 0) {
    pages.splice(pages.length - 1, 0, { kind: "blank", key: "blank" });
  }

  return pages;
}

/**
 * Cards per row: two on a book spread, one on a phone — where a page is only
 * half as wide on screen, so two-up cards get cramped. Must match the portrait
 * breakpoint FlipbookViewer uses, or the grid and the flow disagree.
 */
export function itemsPerRowFor(portrait: boolean): number {
  return portrait ? 1 : 2;
}
