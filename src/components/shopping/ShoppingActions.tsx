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
  const shareMenuId = "shopping-share-menu";

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

  useEffect(() => {
    if (!shareMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShareMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shareMenuOpen]);

  useEffect(() => {
    if (shareStatus !== "copied") {
      return;
    }

    const timer = window.setTimeout(() => {
      setShareStatus("idle");
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [shareStatus]);

  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <button
        type="button"
        onClick={handlePrint}
        className="ui-button ui-button-secondary min-h-10 w-full rounded-full px-3 py-2 text-xs active:translate-y-[1px] sm:min-h-11 sm:w-auto sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
      >
        Print
      </button>
      <div className="relative w-full sm:w-auto" ref={shareMenuRef}>
        <button
          type="button"
          onClick={() => {
            if (!shareInviteUrl) {
              return;
            }
            setShareMenuOpen((current) => !current);
          }}
          className="ui-button ui-button-primary min-h-10 w-full rounded-full px-3 py-2 text-xs active:translate-y-[1px] sm:min-h-11 sm:w-auto sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          disabled={!shareInviteUrl}
          title={!shareInviteUrl ? "Only household managers can share invite links." : undefined}
          aria-expanded={shareMenuOpen}
          aria-controls={shareInviteUrl ? shareMenuId : undefined}
          aria-haspopup="menu"
        >
          Share
        </button>
        {shareMenuOpen && shareInviteUrl ? (
          <div
            id={shareMenuId}
            role="menu"
            aria-label="Share shopping list"
            className="ui-menu absolute left-0 right-0 z-10 mt-2 sm:left-auto sm:right-0 sm:w-64"
          >
            <p className="ui-menu-label">
              Share shopping list
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ui-menu-item"
              role="menuitem"
            >
              {shareStatus === "copied" ? "Invite link copied" : "Copy invite link"}
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="ui-menu-item mt-1"
              role="menuitem"
            >
              Share on WhatsApp
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClearList}
        className="ui-button ui-button-danger min-h-10 w-full rounded-full px-3 py-2 text-xs active:translate-y-[1px] sm:min-h-11 sm:w-auto sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
        disabled={clearing}
      >
        {clearing ? "Clearing..." : "Clear"}
      </button>
    </div>
  );
}
