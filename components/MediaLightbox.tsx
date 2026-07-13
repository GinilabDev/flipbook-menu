"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/config";
import type { Media, MenuItem } from "@/lib/menu";

interface MediaLightboxProps {
  item: MenuItem;
  onClose: () => void;
}

/** Extract a YouTube/Vimeo embed URL from a share/watch URL. */
function embedUrl(m: Media): string | null {
  if (m.provider === "youtube") {
    const id =
      m.url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/)?.[1] ?? m.url;
    return `https://www.youtube.com/embed/${id}`;
  }
  if (m.provider === "vimeo") {
    const id = m.url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? m.url;
    return `https://player.vimeo.com/video/${id}`;
  }
  return null;
}

/** Lazy media viewer: image carousel + embedded/file video. */
export default function MediaLightbox({ item, onClose }: MediaLightboxProps) {
  const media = item.media ?? [];
  const [i, setI] = useState(0);
  if (media.length === 0) return null;
  const current = media[Math.min(i, media.length - 1)];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ✕
      </button>

      <div className="flex w-full max-w-3xl flex-1 items-center justify-center">
        {media.length > 1 && (
          <button
            onClick={() => setI((n) => (n - 1 + media.length) % media.length)}
            aria-label="Previous"
            className="mr-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ‹
          </button>
        )}

        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-black">
          {current.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(current.url)} alt={item.name} className="max-h-full max-w-full object-contain" />
          ) : embedUrl(current) ? (
            <iframe
              src={embedUrl(current)!}
              title={item.name}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={mediaUrl(current.url)} controls className="max-h-full max-w-full" />
          )}
        </div>

        {media.length > 1 && (
          <button
            onClick={() => setI((n) => (n + 1) % media.length)}
            aria-label="Next"
            className="ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ›
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 text-white">
        <span className="font-medium">{item.name}</span>
        {media.length > 1 && (
          <span className="text-sm text-white/60">
            {Math.min(i, media.length - 1) + 1} / {media.length}
          </span>
        )}
      </div>
    </div>
  );
}
