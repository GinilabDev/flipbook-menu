"use client";

import { useCallback, useRef, useState } from "react";
import FlipbookViewer from "@/components/FlipbookViewer";
import { renderPdf, type RenderResult } from "@/lib/pdf";

type Status = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<RenderResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please choose a PDF file.");
      setStatus("error");
      return;
    }
    setTitle(file.name);
    setFile(file);
    setStatus("loading");
    setError("");
    setProgress({ done: 0, total: 0 });
    try {
      const res = await renderPdf(file, (done, total) =>
        setProgress({ done, total }),
      );
      if (res.pages.length === 0) throw new Error("The PDF has no pages.");
      setResult(res);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not read this PDF.");
      setStatus("error");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setStatus("idle");
    setTitle("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  if (status === "ready" && result) {
    return (
      <FlipbookViewer
        pages={result.pages}
        aspect={result.aspect}
        title={title}
        file={file}
        onReset={reset}
      />
    );
  }

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mb-8">
          <h1 className="bg-gradient-to-r from-indigo-300 via-white to-indigo-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            FlipBook
          </h1>
          <p className="mt-3 text-slate-400">
            Upload a PDF and read it as a realistic page-flipping flipbook.
          </p>
        </div>

        {status === "loading" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-indigo-400" />
            <p className="text-sm text-slate-300">
              Rendering pages… {progress.done}/{progress.total}
            </p>
            <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition ${
              dragging
                ? "border-indigo-400 bg-indigo-400/10"
                : "border-white/15 bg-white/5 hover:border-indigo-400/60 hover:bg-white/[0.07]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <svg
              className="mb-4 h-14 w-14 text-indigo-400 transition group-hover:scale-110"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 4.5 4.5 0 0 1 1.5 8.828"
              />
            </svg>
            <span className="text-base font-medium text-slate-100">
              Drop your PDF here, or click to browse
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Everything is processed in your browser — nothing is uploaded.
            </span>
          </label>
        )}

        {status === "error" && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <p className="mt-8 text-xs text-slate-600">
          Built with Next.js &amp; Tailwind CSS · pdf.js · react-pageflip
        </p>
      </div>
    </main>
  );
}
