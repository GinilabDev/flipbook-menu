import * as pdfjsLib from "pdfjs-dist";

// Bundle the worker with the app (works in dev + production, no external CDN needed).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface RenderedPage {
  /** rendered page as a PNG data URL */
  src: string;
  width: number;
  height: number;
}

export interface RenderResult {
  pages: RenderedPage[];
  /** aspect ratio (width / height) of the first page — used to size the book */
  aspect: number;
}

export type ProgressCallback = (done: number, total: number) => void;

/**
 * Render every page of a PDF file into an image data URL.
 * `scale` controls the render resolution (higher = sharper but heavier).
 */
export async function renderPdf(
  file: File,
  onProgress?: ProgressCallback,
  scale = 1.6
): Promise<RenderResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const total = pdf.numPages;
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);

    // Account for high-DPI screens so text stays crisp.
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      src: canvas.toDataURL("image/png"),
      width: viewport.width / dpr,
      height: viewport.height / dpr,
    });

    page.cleanup();
    onProgress?.(i, total);
  }

  await pdf.destroy();

  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7071;

  return { pages, aspect };
}
