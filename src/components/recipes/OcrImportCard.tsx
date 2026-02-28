"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createRecipeFromOcr } from "@/app/(dashboard)/recipes/actions";

const isHeicFile = (file: File) => {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
};

const resizeImage = (file: File, maxDimension: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas toBlob failed"));
          }
        },
        "image/jpeg",
        0.8 // high enough for OCR but significant size reduction
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export default function OcrImportCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] ?? null;
    setError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (isHeicFile(nextFile)) {
      setIsConverting(true);
      try {
        const { default: heic2any } = await import("heic2any");
        const converted = await heic2any({ blob: nextFile, toType: "image/jpeg", quality: 0.9 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        setFile(
          new File([blob], nextFile.name.replace(/\.(heic|heif)$/i, ".jpg"), {
            type: "image/jpeg",
          })
        );
      } catch {
        setError("HEIC conversion failed. Please convert to JPG or PNG and try again.");
        setFile(null);
      } finally {
        setIsConverting(false);
      }
      return;
    }

    setFile(nextFile);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        // Resize to max 1200px to stay well within Vercel's payload limits
        const resizedBlob = await resizeImage(file, 1200);
        const base64 = await blobToBase64(resizedBlob);

        formData.set("base64Image", base64);
        formData.set("mimeType", "image/jpeg");

        const result = await createRecipeFromOcr(formData);
        if (result && !result.success) {
          setError(result.error ?? "Extraction failed. Please try a clearer photo.");
        }
      } catch (err) {
        console.error("OCR submission failed:", err);
        setError("Could not process the photo. It might be too large or invalid.");
      }
    });
  };

  const isLoading = isConverting || isPending;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Take a Photo</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a cookbook photo and we&apos;ll extract the recipe automatically.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden title override — optional, user can edit on recipe page after */}
        <input type="hidden" name="title" value="" />

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-950/60">
          <input
            id="photo-upload"
            type="file"
            accept="image/*,image/heic,image/heif"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
          <label
            htmlFor="photo-upload"
            className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity ${isLoading ? "cursor-not-allowed opacity-50" : "hover:bg-emerald-700"
              }`}
          >
            {file ? "Change Photo" : "Choose Photo"}
          </label>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            JPG, PNG or HEIC. Use a clear, well-lit photo.
          </p>
        </div>

        {previewUrl && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Recipe photo preview"
              className="max-h-72 w-full object-cover"
            />
          </div>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {isConverting && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Converting HEIC photo…</p>
        )}

        <button
          type="submit"
          disabled={!file || isLoading}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
        >
          {isPending ? "Extracting recipe…" : "Extract Recipe"}
        </button>

        {isPending && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Reading your photo — this takes a few seconds…
          </p>
        )}
      </form>
    </section>
  );
}
