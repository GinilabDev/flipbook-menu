"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/menu";
import { categoryAccent } from "@/lib/accent";

export interface CategoryEntry {
  category: Category;
  /** how many items sit on that category's page */
  count: number;
}

interface CategoryModalProps {
  open: boolean;
  entries: CategoryEntry[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

/**
 * The menu's table of contents. Every category owns exactly one page (see
 * lib/layout.ts), so picking one here is a jump straight to that page.
 *
 * Mirrors tomafood-web's CategoryModal: a plain list, the current one ticked.
 */
export default function CategoryModal({
  open,
  entries,
  activeCategoryId,
  onSelect,
  onClose,
}: CategoryModalProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // A long menu can push the current category out of view; open on it.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Categories"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Edge to edge on a phone — `max-w-sm` left a strip of dimmed menu down
          each side that bought nothing but a narrower list. The sheet still
          caps its width once there is a desktop's worth of room. */}
      <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white text-titleColor shadow-2xl sm:max-w-sm sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3.5">
          <h3 className="font-titleFont text-lg font-semibold">Categories</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-disableTextColor hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {entries.map(({ category, count }) => {
            const isActive = category.id === activeCategoryId;
            const accent = categoryAccent(category);

            return (
              <button
                key={category.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => {
                  onSelect(category.id);
                  onClose();
                }}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  isActive ? "bg-neutral-100" : "hover:bg-neutral-100"
                }`}
              >
                <span
                  aria-hidden
                  className="h-8 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: accent }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-titleFont text-[15px] font-semibold">
                    {category.name}
                  </span>
                  <span className="block truncate font-descriptionFont text-xs text-disableTextColor">
                    {category.description ||
                      `${count} item${count === 1 ? "" : "s"}`}
                  </span>
                </span>
                {isActive ? (
                  <IconCheck />
                ) : (
                  <span className="flex-shrink-0 font-titleFont text-xs tabular-nums text-disableTextColor">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const IconCheck = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 flex-shrink-0 text-highlightColor"
    aria-hidden
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);
