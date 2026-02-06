"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createRecipeFromOcr } from "@/app/(dashboard)/recipes/actions";

const loadTesseract = async () => {
  const module = await import("tesseract.js");
  return module;
};

type ProgressState = {
  status: string;
  progress: number;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const isHeicFile = (file: File) => {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
};

export default function OcrImportCard() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canRun = Boolean(file) && !isConverting;

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setOcrText("");
    setTitle("");
    setError(null);
    setProgress(null);
    setToast(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (isHeicFile(nextFile)) {
      setIsConverting(true);
      try {
        const { default: heic2any } = await import("heic2any");
        const converted = await heic2any({
          blob: nextFile,
          toType: "image/jpeg",
          quality: 0.9,
        });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        const convertedFile = new File(
          [convertedBlob],
          nextFile.name.replace(/\.(heic|heif)$/i, ".jpg"),
          { type: "image/jpeg", lastModified: Date.now() }
        );
        setFile(convertedFile);
        setImageUrl(convertedFile.name);
        setToast({ type: "success", message: "Converted HEIC to JPG. Ready to import." });
      } catch (err) {
        const message = "HEIC conversion failed. Please convert to JPG/PNG and try again.";
        setError(message);
        setToast({ type: "error", message });
        setFile(null);
      } finally {
        setIsConverting(false);
      }
      return;
    }

    setFile(nextFile);
    setImageUrl(nextFile.name);
  };

  const handleRunOcr = async () => {
    if (isConverting) {
      const message = "Finishing photo conversion. Please wait.";
      setError(message);
      setToast({ type: "error", message });
      return;
    }

    if (!file) {
      const message = "Add a photo first.";
      setError(message);
      setToast({ type: "error", message });
      return;
    }

    setError(null);
    setProgress({ status: "loading", progress: 0 });

    try {
      const tesseract = await loadTesseract();
      const result = await tesseract.recognize(file, "eng", {
        logger: (message: { status: string; progress: number }) => {
          setProgress({ status: message.status, progress: message.progress });
        },
      });
      setOcrText(result.data.text?.trim() ?? "");
      setProgress({ status: "complete", progress: 1 });
      setToast({ type: "success", message: "Import complete. Review the text before saving." });
    } catch (err) {
      const message = "Import failed. Please try a clearer JPG or PNG image.";
      setError(message);
      setToast({ type: "error", message });
      setProgress(null);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      await createRecipeFromOcr(formData);
      setToast({ type: "success", message: "Recipe created from photo." });
    });
  };

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Take a Photo</h2>
        <p className="text-sm text-slate-500">
          Upload a cookbook photo and we&apos;ll extract the recipe text for you to review.
        </p>
      </div>

      {toast ? (
        <div
          className={
            "mb-4 rounded-2xl px-4 py-3 text-sm font-semibold " +
            (toast.type === "success"
              ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border border-rose-100 bg-rose-50 text-rose-700")
          }
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            <input
              id="photo-upload"
              type="file"
              accept="image/*,image/heic,image/heif"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="photo-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Add Photo
            </label>
            <p className="mt-3">Upload a clear, well-lit photo.</p>
          </div>

          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="OCR preview" className="h-56 w-full object-cover" />
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRunOcr}
            disabled={!canRun || Boolean(error)}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
          >
            {progress?.status === "complete" ? "Re-import" : "Import"}
          </button>

          {isConverting ? (
            <div className="text-xs text-slate-500">Converting HEIC photo...</div>
          ) : null}

          {progress ? (
            <div className="text-xs text-slate-500">
              {progress.status} {Math.round(progress.progress * 100)}%
            </div>
          ) : null}

          {error ? <div className="text-xs text-rose-500">{error}</div> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="ocrText" value={ocrText} />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="ocr-title">
              Recipe Title
            </label>
            <input
              id="ocr-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional override"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Extracted Text</label>
            <textarea
              value={ocrText}
              onChange={(event) => setOcrText(event.target.value)}
              rows={10}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Extracted text will appear here. You can edit before saving."
            />
          </div>
          <button
            type="submit"
            disabled={isPending || ocrText.length === 0}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Create Recipe"}
          </button>
          {imageUrl ? (
            <p className="text-xs text-slate-400">Source: {imageUrl}</p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
