"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Menu, MenuItem } from "@/lib/menu";
import { buildSearchIndex, searchIndex } from "@/lib/search";
import { useOverlay } from "@/lib/useOverlay";
import ItemCard from "@/components/ItemCard";

/**
 * Enough that an ordinary query is answered in full — "chicken" alone is 50
 * dishes on a real menu — while still bounding the DOM for a one-letter query.
 * When it does bite, the count says so rather than quietly truncating.
 */
const RESULT_LIMIT = 100;

interface SearchOverlayProps {
  open: boolean;
  menu: Menu;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  /** Jump the book (or the list) to a category — closes the overlay. */
  onGoToCategory: (categoryId: string) => void;
  /**
   * False while something sits on top of the sheet (the item popup). Escape
   * should close the topmost thing, not the sheet underneath it.
   */
  escapeEnabled?: boolean;
}

/**
 * Search across the whole menu.
 *
 * A full sheet rather than a dropdown: on a phone the results ARE the screen,
 * and a customer who is searching has stopped browsing. Results carry the
 * category they came from — on a real menu 173 dishes share a name with another
 * dish, so "MADRAS" alone doesn't say which one this is.
 */
export default function SearchOverlay({
  open,
  menu,
  onClose,
  onSelect,
  onMedia,
  onAdd,
  onGoToCategory,
  escapeEnabled = true,
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape, the focus trap, focus restore and the body scroll lock all come
  // from here; `enabled` is what steps aside when the item popup opens on top.
  useOverlay({
    open,
    onClose,
    containerRef: panelRef,
    enabled: escapeEnabled,
    initialFocusRef: inputRef,
  });

  // Built once per menu; searching 672 items is sub-millisecond, so the input
  // stays live and `useDeferredValue` keeps typing ahead of rendering results
  // without a debounce delay to tune.
  const index = useMemo(() => buildSearchIndex(menu), [menu]);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchIndex(index, deferredQuery, RESULT_LIMIT),
    [index, deferredQuery],
  );

  // A sheet that reopens holding the last search would show results for a
  // question the customer has already finished asking.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  const searching = deferredQuery.trim().length > 0;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search the menu"
      tabIndex={-1}
      // Below the item popup (z-50) on purpose: tapping a result opens that
      // popup over the results, so the customer lands back in their search
      // after adding rather than being thrown out to the book.
      className="fixed inset-0 z-[45] flex flex-col bg-white"
    >
      {/* Search bar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-neutral-200 px-3 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <IconSearch className="pointer-events-none absolute left-3 h-4 w-4 text-disableTextColor" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search dishes"
            placeholder="Search dishes, e.g. korma"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 pl-9 pr-9 font-titleFont text-[15px] text-titleColor outline-none transition placeholder:text-disableTextColor focus:border-highlightColor focus:bg-white"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-disableTextColor hover:bg-neutral-200"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-lg px-2 py-2 font-titleFont text-sm font-medium text-disableTextColor hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-3">
        {!searching ? (
          <p className="mt-10 text-center font-descriptionFont text-sm text-disableTextColor">
            Type a dish name, a heading, or a category.
          </p>
        ) : results.length === 0 ? (
          <div className="mt-10 text-center">
            <p
              aria-live="polite"
              className="font-titleFont text-base font-semibold text-titleColor"
            >
              Nothing matches “{deferredQuery.trim()}”
            </p>
            <p className="mt-1 font-descriptionFont text-sm text-disableTextColor">
              Try a shorter word, or browse the categories.
            </p>
          </div>
        ) : (
          <>
            <p
              aria-live="polite"
              className="mb-2 font-descriptionFont text-xs text-disableTextColor"
            >
              {results.length} {results.length === 1 ? "dish" : "dishes"}
              {results.length === RESULT_LIMIT ? " — closest matches" : ""}
            </p>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
              {results.map(({ item, category, subcategory }) => (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      onGoToCategory(category.id);
                      onClose();
                    }}
                    className="mb-1 flex max-w-full items-center gap-1 truncate font-descriptionFont text-[11px] text-disableTextColor hover:text-titleColor"
                    title={`Go to ${category.name}`}
                  >
                    <span className="truncate">
                      {category.name}
                      {subcategory ? ` › ${subcategory.name}` : ""}
                    </span>
                    <IconArrow className="h-3 w-3 flex-shrink-0" />
                  </button>
                  <ItemCard
                    item={item}
                    currencySymbol={menu.restaurant.currencySymbol}
                    onSelect={onSelect}
                    onMedia={onMedia}
                    onAdd={onAdd}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const IconSearch = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const IconArrow = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
