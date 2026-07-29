// ---------------------------------------------------------------------------
// Menu search. A real menu is 600+ dishes across 40 categories, which no amount
// of page-turning makes browsable when the customer already knows what they
// want ("korma"). Everything needed is on the client the moment the menu loads,
// so this is plain in-memory matching — no endpoint, no network, no debounce
// budget to spend.
//
// Kept free of React on purpose: the ranking rules are the part worth testing.
// ---------------------------------------------------------------------------

import type { Category, Menu, MenuItem, Subcategory } from "@/lib/menu";
import { orderedCategories } from "@/lib/menu";

export interface SearchResult {
  item: MenuItem;
  /** Where it lives — shown with the result, and where "jump" goes. */
  category: Category;
  subcategory?: Subcategory;
  score: number;
}

/** One row of the prepared index: the item plus its fields, pre-normalized. */
interface IndexedItem {
  item: MenuItem;
  category: Category;
  subcategory?: Subcategory;
  name: string;
  words: string[];
  sub: string;
  cat: string;
  desc: string;
}

export type SearchIndex = IndexedItem[];

/**
 * Fold a string down to something comparable: accents stripped (the menu writes
 * "Jalfrèzi", the customer types "jalfrezi"), case dropped, spacing collapsed.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining accents, split off by NFD
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prepare the menu for searching. Only items in a category the book actually
 * shows are indexed — a result the customer cannot be taken to is worse than no
 * result at all.
 */
export function buildSearchIndex(menu: Menu): SearchIndex {
  const categories = new Map(orderedCategories(menu).map((c) => [c.id, c]));
  const subs = new Map((menu.subcategories ?? []).map((s) => [s.id, s]));

  const index: SearchIndex = [];
  for (const item of menu.items) {
    const category = categories.get(item.categoryId);
    if (!category) continue;
    const subcategory = item.subcategoryId ? subs.get(item.subcategoryId) : undefined;
    const name = normalize(item.name);
    index.push({
      item,
      category,
      subcategory,
      name,
      words: name.split(" "),
      sub: subcategory ? normalize(subcategory.name) : "",
      cat: normalize(category.name),
      desc: normalize(`${item.shortDesc ?? ""} ${item.longDesc ?? ""}`),
    });
  }
  return index;
}

/**
 * How well one row answers one term. Zero means "not at all", and a row scoring
 * zero on any term is dropped — typing another word must narrow the results,
 * never widen them. The ladder is ordered by how likely a match is to be what
 * was meant: the dish's own name beats the heading it sits under, which beats
 * its blurb.
 */
function scoreTerm(row: IndexedItem, term: string): number {
  if (row.name === term) return 120;
  if (row.name.startsWith(term)) return 100;
  if (row.words.some((w) => w.startsWith(term))) return 80;
  if (row.name.includes(term)) return 60;
  if (row.sub.includes(term)) return 45;
  if (row.cat.includes(term)) return 35;
  if (row.desc.includes(term)) return 20;
  return 0;
}

/** Ranked matches, best first. `limit` caps a broad query like "chicken". */
export function searchIndex(
  index: SearchIndex,
  query: string,
  limit = 50,
): SearchResult[] {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const hits: SearchResult[] = [];
  for (const row of index) {
    let score = 0;
    for (const term of terms) {
      const s = scoreTerm(row, term);
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score > 0) {
      hits.push({
        item: row.item,
        category: row.category,
        subcategory: row.subcategory,
        score,
      });
    }
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.name.length - b.item.name.length ||
      a.item.name.localeCompare(b.item.name),
  );
  return hits.slice(0, limit);
}

/** Index-and-search in one call. Convenient for tests; the UI keeps the index. */
export function searchMenu(menu: Menu, query: string, limit = 50): SearchResult[] {
  return searchIndex(buildSearchIndex(menu), query, limit);
}
