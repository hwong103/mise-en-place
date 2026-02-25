"use client";

import { useEffect, useRef, useState } from "react";

type ShoppingActionsProps = {
  shareInviteUrl: string | null;
  onClearList: () => void;
  clearing: boolean;
};

const resolveAbsoluteUrl = (value: string) => {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

export default function ShoppingActions({
  shareInviteUrl,
  onClearList,
  clearing,
}: ShoppingActionsProps) {
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    if (!shareInviteUrl) {
      return;
    }

    const absoluteUrl = resolveAbsoluteUrl(shareInviteUrl);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setShareStatus("copied");
      setShareMenuOpen(false);
    } catch {
      setShareStatus("idle");
    }
  };

  const handleWhatsAppShare = () => {
    if (!shareInviteUrl) {
      return;
    }

    const absoluteUrl = resolveAbsoluteUrl(shareInviteUrl);
    const text = `Join our shopping list: ${absoluteUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.assign(whatsappUrl);
    }
    setShareMenuOpen(false);
  };

  useEffect(() => {
    if (!shareMenuOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!shareMenuRef.current?.contains(target)) {
        setShareMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsidePointerDown);
    };
  }, [shareMenuOpen]);

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Print List
      </button>
      <div className="relative" ref={shareMenuRef}>
        <button
          type="button"
          onClick={() => {
            if (!shareInviteUrl) {
              return;
            }
            setShareMenuOpen((current) => !current);
          }}
          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!shareInviteUrl}
          title={!shareInviteUrl ? "Only household managers can share invite links." : undefined}
        >
          Share List
        </button>
        {shareMenuOpen && shareInviteUrl ? (
          <div className="absolute right-0 z-10 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {shareStatus === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Send via WhatsApp
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClearList}
        className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
        disabled={clearing}
      >
        {clearing ? "Clearing..." : "Clear List"}
      </button>
    </div>
  );
}
