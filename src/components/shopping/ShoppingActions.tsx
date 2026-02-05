"use client";

import { useState } from "react";

const shareFallback = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return "copied" as const;
  }

  return "unavailable" as const;
};

type ShoppingActionsProps = {
  shareText: string;
};

export default function ShoppingActions({ shareText }: ShoppingActionsProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "unavailable">("idle");

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        setStatus("shared");
        return;
      }

      const fallbackStatus = await shareFallback(shareText);
      setStatus(fallbackStatus);
    } catch {
      setStatus("unavailable");
    }
  };

  const label =
    status === "copied"
      ? "Copied"
      : status === "shared"
      ? "Shared"
      : status === "unavailable"
      ? "Copy"
      : "Share";

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        Print List
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95"
      >
        {label} List
      </button>
    </div>
  );
}
