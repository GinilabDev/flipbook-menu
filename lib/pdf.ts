import * as pdfjsLib from "pdfjs-dist";

// Bundle the worker with the app (works in dev + production, no external CDN needed).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/** A single piece of text on a page, normalised to the page box (0–1),
 *  origin at top-left. Used by the auto-detect step to find menu items. */
export interface TextToken {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderedPage {
  /** rendered page as a PNG data URL */
  src: string;
  width: number;
  height: number;
  /** text tokens on this page, normalised (0–1) — empty for image-only pages */
  tokens: TextToken[];
}

export interface RenderResult {
  pages: RenderedPage[];
  /** aspect ratio (width / height) of the first page — used to size the book */
  aspect: number;
}

export type ProgressCallback = (done: number, total: number) => void;

type PdfSource =
  | { file: File }
  | { url: string }
  | { data: ArrayBuffer };

async function toBuffer(source: PdfSource): Promise<ArrayBuffer> {
  if ("file" in source) return source.file.arrayBuffer();
  if ("data" in source) return source.data;
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`Could not fetch PDF (${res.status}).`);
  return res.arrayBuffer();
}

/** Extract normalised text tokens from a page. */
async function extractTokens(
  page: pdfjsLib.PDFPageProxy
): Promise<TextToken[]> {
  const viewport = page.getViewport({ scale: 1 });
  const { width: pw, height: ph } = viewport;
  const content = await page.getTextContent();
  const tokens: TextToken[] = [];

  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    // Map the text-space transform into viewport (pixel) space.
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const x = tx[4];
    const yTop = tx[5] - fontHeight; // viewport origin is top-left
    // pdf.js already reports item.width in viewport pixels (we extract at
    // scale 1), so it must NOT be multiplied by the font scale again.
    const w = item.width;
    tokens.push({
      str: item.str,
      x: x / pw,
      y: yTop / ph,
      w: w / pw,
      h: fontHeight / ph,
    });
  }
  return tokens;
}

/**
 * Render every page of a PDF into an image data URL and extract its text
 * tokens. `scale` controls the render resolution (higher = sharper but heavier).
 */
export async function renderPdf(
  source: PdfSource | File,
  onProgress?: ProgressCallback,
  scale = 2.6
): Promise<RenderResult> {
  const src: PdfSource = source instanceof File ? { file: source } : source;
  const buffer = await toBuffer(src);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const total = pdf.numPages;
  const pages: RenderedPage[] = [];

  // Cap the longest rendered side so a large PDF can't blow up memory; the
  // effective scale is reduced only when a page would exceed this.
  const MAX_SIDE = 4200;

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);

    // Account for high-DPI screens so text stays crisp, then clamp.
    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
      2
    );
    const base = page.getViewport({ scale: 1 });
    let renderScale = scale * dpr;
    const longSide = Math.max(base.width, base.height) * renderScale;
    if (longSide > MAX_SIDE) renderScale *= MAX_SIDE / longSide;
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const tokens = await extractTokens(page);

    // width/height are only used for the page aspect ratio, so the ratio is
    // what matters here (not the absolute pixel size).
    pages.push({
      src: canvas.toDataURL("image/png"),
      width: viewport.width,
      height: viewport.height,
      tokens,
    });

    page.cleanup();
    onProgress?.(i, total);
  }

  await pdf.destroy();

  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7071;

  return { pages, aspect };
}
