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
    <div className="grid w-full gap-3 sm:flex sm:flex-wrap">
      <button
        type="button"
        onClick={handlePrint}
        className="ui-button ui-button-secondary ui-button-block w-full active:translate-y-[1px] sm:w-auto"
      >
        Print List
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
          className="ui-button ui-button-primary ui-button-block w-full active:translate-y-[1px] sm:w-auto"
          disabled={!shareInviteUrl}
          title={!shareInviteUrl ? "Only household managers can share invite links." : undefined}
          aria-expanded={shareMenuOpen}
          aria-controls={shareInviteUrl ? shareMenuId : undefined}
          aria-haspopup="menu"
        >
          Share List
        </button>
        {shareMenuOpen && shareInviteUrl ? (
          <div
            id={shareMenuId}
            role="menu"
            aria-label="Share shopping list"
            className="ui-menu absolute inset-x-0 z-10 mt-2 sm:right-0 sm:left-auto sm:w-64"
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
        className="ui-button ui-button-danger ui-button-block w-full active:translate-y-[1px] sm:w-auto"
        disabled={clearing}
      >
        {clearing ? "Clearing..." : "Clear List"}
      </button>
    </div>
  );
}
