"use client";

import { useState } from "react";

interface ImageWithLoaderProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt"
> {
  src: string;
  alt?: string;
  /** classes for the image itself */
  className?: string;
  /** classes for the box the image and its spinner share */
  wrapperClassName?: string;
  /** size/thickness of the spinner — the default is sized for a hero image */
  spinnerClassName?: string;
  /** shown instead once `src` fails */
  fallbackSrc?: string;
}

/**
 * Image that holds a spinner until the file is decoded, then fades it in.
 * Ported from tomafood-web's ui/ImageWithLoader.
 *
 * A menu photo comes off the admin's file server at whatever size it was
 * uploaded, over a restaurant's wifi — a raw <img> pops in half-drawn, and a
 * page of them flickers as the reader scrolls. This gives every picture the
 * same, quiet arrival.
 *
 * `loadedSrc` rather than a boolean: a card that swaps its picture (a search
 * result reusing a memoized row) would otherwise stay "loaded" and show the old
 * image's opacity while the new file is still coming down.
 */
export default function ImageWithLoader({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  spinnerClassName = "",
  fallbackSrc,
  loading = "lazy",
  ...imgProps
}: ImageWithLoaderProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const resolvedSrc = failed && fallbackSrc ? fallbackSrc : src;
  const isLoaded = loadedSrc === resolvedSrc;

  return (
    <span className={`relative block overflow-hidden ${wrapperClassName}`}>
      {!isLoaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={`h-12 w-12 animate-spin rounded-full border-4 border-highlightColor/30 border-t-highlightColor ${spinnerClassName}`}
          />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imgProps}
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoadedSrc(resolvedSrc)}
        onError={() => {
          // Fall back once, and reveal either way: a broken file must not leave
          // a spinner turning forever on the page.
          if (fallbackSrc && !failed) setFailed(true);
          else setLoadedSrc(resolvedSrc);
        }}
        className={`${className} ${
          isLoaded ? "opacity-100 transition-opacity duration-500" : "opacity-0"
        }`}
      />
    </span>
  );
}
