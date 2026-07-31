"use client";

import { useEffect, useRef, type RefObject } from "react";

interface OverlayOptions {
  /** Whether the overlay is currently on screen. */
  open: boolean;
  /** Called on Escape. Backdrop clicks stay with the component. */
  onClose: () => void;
  /** The overlay's outermost element — the box focus is kept inside. */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * False when another overlay sits on top of this one: Escape must close the
   * topmost thing, and only the topmost thing should hold focus.
   */
  enabled?: boolean;
  /** Focus this instead of the first focusable child (e.g. a search input). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The three things every overlay in this app owes the customer, in one place:
 * Escape closes it, the page behind doesn't scroll under it, and the keyboard
 * stays inside it (and goes back where it came from afterwards).
 *
 * Without the focus trap, tabbing out of a dish's popup walks into the 600 menu
 * cards behind it — with nothing on screen to show where the focus has gone.
 */
export function useOverlay({
  open,
  onClose,
  containerRef,
  enabled = true,
  initialFocusRef,
}: OverlayOptions): void {
  // Read through refs so that a change of handler doesn't tear down and rebuild
  // the effect — which would re-run the focus step and yank focus back.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus in. Prefer an explicit target, else the first control, else
    // the container itself so a screen reader starts reading from the top.
    const focusFirst = () => {
      const target =
        initialFocusRef?.current ??
        container?.querySelector<HTMLElement>(FOCUSABLE) ??
        container;
      target?.focus();
    };
    const frame = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current || !container) return;

      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // Wrap at the ends, and pull focus back if it has escaped the overlay.
      if (!container.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Stacking is settled by `enabled`, not by event order: listeners on the
    // same target fire in the order they were added, so the sheet underneath
    // would otherwise answer Escape before the popup on top of it. Whoever is
    // covered passes `enabled: false` and stays out of the way.
    window.addEventListener("keydown", onKey, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      // Give focus back to whatever opened this — but not if something else has
      // legitimately claimed it since.
      //
      // By the time this cleanup runs on unmount the overlay's DOM is already
      // gone, so focus has fallen to <body> and `container.contains` can no
      // longer prove it was ever inside. Treat that lost-focus state as ours:
      // it is the ordinary case of an overlay closing.
      const activeNow = document.activeElement;
      const focusWasLost = !activeNow || activeNow === document.body;
      if (focusWasLost || !container || container.contains(activeNow)) {
        previouslyFocused?.focus?.();
      }
    };
  }, [open, containerRef, initialFocusRef]);
}
