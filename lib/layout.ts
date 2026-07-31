// ---------------------------------------------------------------------------
// Layout engine — turns menu data into flipbook pages.
//   • page 0        = cover
//   • each category = EXACTLY ONE page: a section header, then a vertical stack
//                     of blocks (full-width subcategory headings, and rows of
//                     item cards — 2-up on a book, 1-up on a phone). A category
//                     never spills onto a second page; a long one simply scrolls
//                     inside its own page.
//   • last page     = back cover
// Page count is padded to stay even so react-pageflip pairs spreads cleanly.
//
// One page per category is what makes the category picker work: every category
// has a single, stable destination to jump to.
//
// Pages are laid out in a FIXED design-pixel space (PAGE_W × PAGE_H) which the
// viewer scales to whatever the screen allows — so a card is the same size on a
// phone and a desktop.
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

/**
 * The reference page: the box these designs were drawn in. A page is authored
 * at this size and scaled to the screen, which is what keeps a card the same
 * shape on a phone and a desktop.
 *
 * PAGE_H is only a *reference* height. The height a page is actually given is
 * derived from the scale (see below), so that the book still fills the screen
 * exactly — no letterboxing — at any scale.
 */
export const PAGE_W = 400;
export const PAGE_H = 556;

/**
 * How far the page may be scaled, and therefore how large its type can end up.
 *
 * Scale used to be whatever the screen's height divided by PAGE_H happened to
 * be, which meant the type had no size of its own: measured across real
 * devices, the same price rendered at 6.8px on a phone held landscape, 10.5px
 * on a 320px phone, and 21.2px on a 1080p desktop. A menu is read in a dim
 * room, often by someone who left their glasses at home.
 *
 * The floor is set so the smallest thing on a card — 9px description text in
 * design space — stays above 11px on screen, and prices stay above 14px. The
 * ceiling stops a large screen from turning dish names into headlines.
 */
export const MIN_PAGE_SCALE = 1.25;
export const MAX_PAGE_SCALE = 1.6;

/** Clamp a screen-derived scale into the readable band. */
export function pageScaleFor(stageHeight: number): number {
  const natural = stageHeight / PAGE_H;
  return Math.min(MAX_PAGE_SCALE, Math.max(MIN_PAGE_SCALE, natural));
}

export type PageBlock =
  /**
   * A collapsible subcategory: the heading shows, its items are revealed on
   * click — the way the tomafood web menu does it.
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
      /** total items on the page, headline for the section header */
      itemCount: number;
    }
  | { kind: "back"; key: string; restaurant: Restaurant }
  | { kind: "blank"; key: string };

export interface LayoutOptions {
  /** item cards per row — 2 on a wide book, 1 on a phone */
  itemsPerRow: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * The block stack for one category — every group it has, in order. No page
 * budget: the whole category lives on one page and the page scrolls.
 */
function blocksFor(groups: ItemGroup[], itemsPerRow: number): PageBlock[] {
  const blocks: PageBlock[] = [];

  for (const group of groups) {
    const sub = group.subcategory;

    if (sub) {
      blocks.push({
        kind: "group",
        key: `grp-${sub.id}`,
        subcategory: sub,
        items: group.items,
        fromPrice: fromPrice(group.items),
      });
      continue;
    }

    for (const items of chunk(group.items, itemsPerRow)) {
      blocks.push({
        kind: "row",
        key: `row-${items.map((i) => i.id).join("-")}`,
        items,
      });
    }
  }

  return blocks;
}

export function buildPages(menu: Menu, opts: LayoutOptions): LayoutPage[] {
  const { itemsPerRow } = opts;
  const cats = orderedCategories(menu);

  const pages: LayoutPage[] = [
    { kind: "cover", key: "cover", restaurant: menu.restaurant },
  ];

  for (const category of cats) {
    const groups = groupCategoryItems(menu, category);
    const blocks = blocksFor(groups, itemsPerRow);
    if (!blocks.length) continue;

    pages.push({
      kind: "section",
      key: `sec-${category.id}`,
      category,
      blocks,
      itemsPerRow,
      itemCount: groups.reduce((n, g) => n + g.items.length, 0),
    });
  }

  pages.push({ kind: "back", key: "back", restaurant: menu.restaurant });

  // Keep an even number of pages for clean spread pairing.
  if (pages.length % 2 !== 0) {
    pages.splice(pages.length - 1, 0, { kind: "blank", key: "blank" });
  }

  return pages;
}

/** Where a category's page sits in the book (-1 if it has no page). */
export function pageIndexOfCategory(
  pages: LayoutPage[],
  categoryId: string,
): number {
  return pages.findIndex(
    (p) => p.kind === "section" && p.category.id === categoryId,
  );
}

/** The category shown at `index`, if that page is a section. */
export function categoryIdAtPage(
  pages: LayoutPage[],
  index: number,
): string | null {
  const page = pages[index];
  return page?.kind === "section" ? page.category.id : null;
}

/**
 * Cards per row: two on a book spread, one on a phone — where a page is only
 * half as wide on screen, so two-up cards get cramped. Must match the portrait
 * breakpoint FlipbookViewer uses, or the grid and the flow disagree.
 */
export function itemsPerRowFor(portrait: boolean): number {
  return portrait ? 1 : 2;
}
