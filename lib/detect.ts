// ---------------------------------------------------------------------------
// Client-side auto-detect (prototype).
//
// Given the text tokens extracted from each PDF page, find likely "menu item"
// rows by locating price patterns (e.g. £8.50, 8.50, 12) and pairing each with
// the item name to its left. Produces the same Hotspot + MenuItem shape the
// real API will eventually return, so the rest of the app is identical whether
// hotspots come from here or from the admin panel.
//
// Accuracy notes — this heuristic handles the common restaurant-menu layout:
//   • multi-column pages (several prices on one visual line, one per column),
//   • names that wrap onto the line above the price ("Banana &" / "… 12.95"),
//   • a description block under each item, made part of the tap target.
// Designed-layout menus can still mis-detect; the admin's manual-correction
// layer (future) fixes those without any change to the flipbook.
// ---------------------------------------------------------------------------

import type { Hotspot, MenuItem } from "@/lib/menu";
import type { RenderedPage, TextToken } from "@/lib/pdf";

export interface DetectResult {
  items: MenuItem[];
  hotspots: Hotspot[];
}

// Matches an optional currency symbol + a number that looks like a price.
// The inner \s? tolerates prices pdf.js emits with a stray space, e.g. "8 .95".
const PRICE_RE = /^[£$€]?\s?\d{1,3}(?:\s?[.,]\d{2})?$/;
// A bare number is a price only if it has decimals or a currency symbol.
const HAS_DECIMAL_OR_SYMBOL = /[£$€]|[.,]\d{2}$/;

function looksLikePrice(str: string): boolean {
  const s = str.trim();
  return PRICE_RE.test(s) && HAS_DECIMAL_OR_SYMBOL.test(s);
}

function parsePrice(str: string): number {
  const n = parseFloat(str.replace(/[£$€\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function cleanName(tokens: TextToken[]): string {
  return tokens
    .map((t) => t.str.trim())
    .join(" ")
    .replace(/[.·]{2,}/g, " ") // strip dotted leaders
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A visual line of text: its tokens plus a bounding box and median height. */
interface Line {
  tokens: TextToken[];
  y: number; // top
  bottom: number;
  x0: number;
  x1: number;
  h: number; // median token height — distinguishes bold titles from small text
}

/** A detected item anchor (name + price) plus the box of its whole block. */
interface Anchor {
  name: string;
  price: number;
  xStart: number; // left edge of name
  xEnd: number; // right edge of price (≈ column right edge)
  top: number; // block top, after wrapped-title merge
  rowBottom: number; // bottom of the name/price row
  lineIndex: number;
  nameH: number; // height of the name text (the title font)
}

/** Merge two horizontally adjacent tokens into one. */
function joinTokens(a: TextToken, b: TextToken): TextToken {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    str: (a.str + b.str).replace(/\s+/g, ""),
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.h, b.h),
  };
}

/** Re-join price fragments that pdf.js split apart, e.g. "£"+"9.95",
 *  "8"+".95", or "9."+"95". Without this a split price is never recognised,
 *  so its row collapses into the next column's item (one wide hotspot). */
function mergePriceFragments(tokensByX: TextToken[]): TextToken[] {
  const out: TextToken[] = [];
  for (const t of tokensByX) {
    const prev = out[out.length - 1];
    if (prev) {
      const gap = t.x - (prev.x + prev.w);
      const near = gap > -0.004 && gap <= Math.max(prev.h, t.h) * 1.3;
      const cur = t.str.trim();
      const pstr = prev.str.trim();
      const symbolThenNum = /^[£$€]$/.test(pstr) && /^\d/.test(cur);
      const intThenDecimal =
        /^[£$€]?\d{1,3}$/.test(pstr) && /^[.,]\d{2}$/.test(cur);
      const dotThenNum =
        /^[£$€]?\d{1,3}[.,]$/.test(pstr) && /^\d{2}$/.test(cur);
      if (near && (symbolThenNum || intThenDecimal || dotThenNum)) {
        out[out.length - 1] = joinTokens(prev, t);
        continue;
      }
    }
    out.push({ ...t });
  }
  return out;
}

/** Group tokens sharing roughly the same vertical position into token rows. */
function groupTokens(tokens: TextToken[], tol = 0.012): TextToken[][] {
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: TextToken[][] = [];
  for (const t of sorted) {
    const g = groups.find(
      (l) => Math.abs(l[0].y - t.y) <= tol && Math.abs(l[0].h - t.h) <= tol * 2
    );
    if (g) g.push(t);
    else groups.push([t]);
  }
  for (const g of groups) g.sort((a, b) => a.x - b.x);
  return groups;
}

/** Turn a sorted token row into a Line with its bounding box. */
function toLine(g: TextToken[]): Line {
  return {
    tokens: g,
    y: Math.min(...g.map((t) => t.y)),
    bottom: Math.max(...g.map((t) => t.y + t.h)),
    x0: Math.min(...g.map((t) => t.x)),
    x1: Math.max(...g.map((t) => t.x + t.w)),
    h: median(g.map((t) => t.h)),
  };
}

/**
 * Collect an item name by walking LEFT from its price along the same line,
 * gathering contiguous words until a wide whitespace gap (a column gutter or
 * the space before another column's content). This assigns each price only the
 * name beside it, so multi-column AND multi-section pages work without a global
 * column model — e.g. "Chicken sausage 2.50 … Hollandaise 2.00" splits cleanly,
 * and a right-column price never swallows a left-column description sharing its
 * line. `leftBound` stops the walk from crossing the previous price on the row.
 */
function nameLeftOfPrice(
  line: Line,
  price: TextToken,
  leftBound: number
): TextToken[] {
  const NAME_GAP = 0.045; // wider than a word space, narrower than a gutter
  // Prices are right-aligned, so a short name can sit far from its price
  // ("Sriracha ……… 1.00"). Allow a wide first gap; only reject the absurd.
  const FIRST_GAP = 0.45;
  const left = line.tokens
    .filter(
      (t) =>
        t !== price &&
        !looksLikePrice(t.str) &&
        t.str.trim() &&
        t.x >= leftBound &&
        t.x < price.x
    )
    .sort((a, b) => b.x - a.x); // right-to-left

  const picked: TextToken[] = [];
  let boundaryX = price.x;
  for (const t of left) {
    const gap = boundaryX - (t.x + t.w);
    if (picked.length === 0) {
      if (gap > FIRST_GAP) break;
    } else if (gap > NAME_GAP) {
      break;
    }
    picked.push(t);
    boundaryX = t.x;
  }
  return picked.reverse();
}

/** Detect item anchors across a page's lines (title-merge included). */
function detectColumn(lines: Line[]): Anchor[] {
  const anchors: Anchor[] = [];
  const consumed = new Set<TextToken>(); // tokens merged into a title

  // 1. Anchors — one item per price on a line, its name taken from the words
  //    immediately left of that price (see nameLeftOfPrice).
  lines.forEach((line, li) => {
    const prices = line.tokens
      .filter((t) => looksLikePrice(t.str))
      .sort((a, b) => a.x - b.x);
    if (!prices.length) return;

    let leftBound = -Infinity;
    for (const p of prices) {
      const nameToks = nameLeftOfPrice(line, p, leftBound);
      leftBound = p.x + p.w;
      if (!nameToks.length) continue;

      const name = cleanName(nameToks);
      if (!name || name.length < 2) continue;

      const rowBottom = Math.max(p.y + p.h, ...nameToks.map((t) => t.y + t.h));
      anchors.push({
        name,
        price: parsePrice(p.str),
        xStart: Math.min(...nameToks.map((t) => t.x)),
        xEnd: p.x + p.w,
        top: Math.min(...nameToks.map((t) => t.y)),
        rowBottom,
        lineIndex: li,
        nameH: median(nameToks.map((t) => t.h)) || p.h,
      });
    }
  });

  // 2. Merge a wrapped title line sitting directly above the price line, e.g.
  //    "Banana &" above "Milk Chocolate (V/G)  12.95". A candidate must carry
  //    no price, use the same (title) font height, be short, and hug the line
  //    below — which separates a wrapped title from small description text.
  const inBand = (t: TextToken, a: Anchor) =>
    !consumed.has(t) && t.x < a.xEnd && t.x + t.w > a.xStart - 0.02;

  for (const a of anchors) {
    let curTop = a.top;
    for (let step = 0; step < 2; step++) {
      // Nearest line above with unconsumed tokens in THIS item's column. Only
      // that column's part is taken, so a line shared by two stacked titles
      // ("Banana & … Raspberry Compote &") feeds each item its own half.
      let band: TextToken[] = [];
      for (let li = a.lineIndex - 1; li >= 0; li--) {
        const ln = lines[li];
        if (ln.y >= curTop) continue;
        const b = ln.tokens.filter((t) => inBand(t, a));
        if (b.length) {
          band = b;
          break;
        }
      }
      if (!band.length) break;

      const text = cleanName(band);
      const hasPrice = band.some((t) => looksLikePrice(t.str));
      const bandH = median(band.map((t) => t.h));
      const bandTop = Math.min(...band.map((t) => t.y));
      const bandBottom = Math.max(...band.map((t) => t.y + t.h));
      // Titles are meaningfully taller than description text (≈0.019 vs 0.015
      // on these menus). Require near-equal height so a wrapped title merges
      // but a previous item's small description tail never does.
      const similarFont = bandH >= a.nameH * 0.9 && bandH <= a.nameH * 1.35;
      const shortEnough = band.length <= 5 && text.length <= 34;
      const hugs = curTop - bandBottom <= a.nameH * 1.3;

      if (hasPrice || !similarFont || !shortEnough || !hugs || !text) break;

      a.name = `${text} ${a.name}`.replace(/\s{2,}/g, " ").trim();
      a.xStart = Math.min(a.xStart, ...band.map((t) => t.x));
      curTop = bandTop;
      band.forEach((t) => consumed.add(t));
    }
    a.top = curTop;
  }

  return anchors;
}

/** Detect menu items on a single page's tokens. */
function detectPage(
  page: RenderedPage,
  pageNumber: number,
  idSeed: number
): DetectResult {
  // Re-join prices pdf.js split apart, then group tokens into visual lines.
  // Names are resolved per-price by walking left (nameLeftOfPrice), so no
  // global column model is needed — this handles multi-column and mixed
  // multi-section pages (e.g. 2-column EXTRAS above a centred SIDES list).
  const tokens = groupTokens(page.tokens).flatMap(mergePriceFragments);
  const lines = groupTokens(tokens)
    .map(toLine)
    .sort((a, b) => a.y - b.y);
  const anchors = detectColumn(lines);

  // Emit items + padded hotspots covering only the name (wrapped title
  // included) and its price — not the description text below.
  const items: MenuItem[] = [];
  const hotspots: Hotspot[] = [];
  let n = idSeed;
  for (const a of anchors) {
    const padX = 0.008;
    const padY = 0.006;
    const x = Math.max(0, a.xStart - padX);
    const y = Math.max(0, a.top - padY);
    const rect = {
      x,
      y,
      w: Math.min(1 - x, a.xEnd - a.xStart + padX * 2),
      h: Math.min(0.14, Math.max(0.018, a.rowBottom - a.top + padY * 2)),
    };
    const itemId = `it_${pageNumber}_${n}`;
    items.push({ id: itemId, name: a.name, price: a.price });
    hotspots.push({ id: `hs_${pageNumber}_${n}`, itemId, pageNumber, rect });
    n++;
  }

  return { items, hotspots };
}

/** Run detection across every rendered page. */
export function detectMenu(pages: RenderedPage[]): DetectResult {
  const items: MenuItem[] = [];
  const hotspots: Hotspot[] = [];
  pages.forEach((page, i) => {
    const res = detectPage(page, i + 1, items.length);
    items.push(...res.items);
    hotspots.push(...res.hotspots);
  });
  return { items, hotspots };
}
