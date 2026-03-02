"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StockistResult } from "@/lib/wine";

const deriveProductNameFromUrl = (url: string) => {
    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\/products\/([^/?#]+)/i);
        if (!match?.[1]) return undefined;
        return decodeURIComponent(match[1])
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    } catch {
        return undefined;
    }
};

type PriceCardProps = {
    wineId: string;
    initialStockists: StockistResult[];
    supportsStockistsPersistence: boolean;
    legacyPrice?: number | null;
    legacyUrl?: string | null;
    legacySource?: string | null;
    legacyPriceAt?: Date | null;
    refreshAction: (
        fd: FormData
    ) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        bottleImageUrl?: string | null;
        error?: string;
    } | undefined>;
    confirmAction: (
        fd: FormData
    ) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        selectedUrl?: string | null;
        error?: string;
    } | undefined>;
    removeAction: (
        fd: FormData
    ) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        selectedUrl?: string | null;
        error?: string;
    } | undefined>;
};

export default function PriceCard({
    wineId,
    initialStockists,
    supportsStockistsPersistence,
    legacyPrice,
    legacyUrl,
    legacySource,
    legacyPriceAt,
    refreshAction,
    confirmAction,
    removeAction,
}: PriceCardProps) {
    const router = useRouter();
    const [stockists, setStockists] = useState<StockistResult[]>(initialStockists);
    const [error, setError] = useState<string | null>(null);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(legacyUrl ?? initialStockists[0]?.url ?? null);
    const [pendingAction, setPendingAction] = useState<"refresh" | "confirm" | "remove" | null>(null);
    const [isPending, startTransition] = useTransition();

    const displayStockists: StockistResult[] =
        stockists.length > 0
            ? stockists
            : legacyPrice && legacyUrl
                ? [{
                    source: legacySource ?? "Store",
                    price: legacyPrice,
                    url: legacyUrl,
                    fetchedAt: legacyPriceAt?.toISOString() ?? new Date().toISOString(),
                }]
                : [];

    const cheapestUrl = displayStockists.length > 0
        ? displayStockists.reduce((best, current) => (current.price < best.price ? current : best)).url
        : null;

    const lastFetched = displayStockists[0]?.fetchedAt
        ? Math.round((Date.now() - new Date(displayStockists[0].fetchedAt).getTime()) / 1000 / 60 / 60)
        : null;

    const handleRefresh = () => {
        setError(null);
        const formData = new FormData();
        formData.set("id", wineId);
        setPendingAction("refresh");
        startTransition(async () => {
            try {
                const result = await refreshAction(formData);
                if (result?.error) {
                    setError(result.error);
                    return;
                }
                if (result?.stockists?.length) {
                    setStockists(result.stockists);
                    setSelectedUrl(result.stockists[0]?.url ?? null);
                }
                if (result?.bottleImageUrl) {
                    router.refresh();
                }
            } finally {
                setPendingAction(null);
            }
        });
    };

    const buildFormDataForStockist = (stockist: StockistResult) => {
        const fd = new FormData();
        fd.set("id", wineId);
        fd.set("source", stockist.source);
        fd.set("url", stockist.url);
        fd.set("price", stockist.price.toString());
        fd.set("fetchedAt", stockist.fetchedAt);
        if (stockist.productName) fd.set("productName", stockist.productName);
        return fd;
    };

    const handleConfirm = (stockist: StockistResult) => {
        setError(null);
        const formData = buildFormDataForStockist(stockist);
        setPendingAction("confirm");
        startTransition(async () => {
            try {
                const result = await confirmAction(formData);
                if (result?.error) {
                    setError(result.error);
                    return;
                }
                if (result?.stockists) {
                    setStockists(result.stockists);
                }
                setSelectedUrl(result?.selectedUrl ?? stockist.url);
                router.refresh();
            } finally {
                setPendingAction(null);
            }
        });
    };

    const handleRemove = (stockist: StockistResult) => {
        setError(null);
        const formData = buildFormDataForStockist(stockist);
        setPendingAction("remove");
        startTransition(async () => {
            try {
                const result = await removeAction(formData);
                if (result?.error) {
                    setError(result.error);
                    return;
                }
                const next = result?.stockists ?? [];
                setStockists(next);
                setSelectedUrl(result?.selectedUrl ?? next[0]?.url ?? null);
                router.refresh();
            } finally {
                setPendingAction(null);
            }
        });
    };

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Where to Buy
                </p>
                <div className="flex items-center gap-3">
                    {lastFetched !== null ? (
                        <span className="text-xs text-slate-400">
                            {lastFetched < 1 ? "Updated just now" : `Updated ${lastFetched}h ago`}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {isPending ? (
                            <>
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                {pendingAction === "confirm" ? "Saving..." : pendingAction === "remove" ? "Removing..." : "Searching..."}
                            </>
                        ) : "Refresh"}
                    </button>
                </div>
            </div>

            {displayStockists.length > 0 ? (
                <div className="space-y-2">
                    {displayStockists.map((stockist, index) => (
                        <div
                            key={`${stockist.source}-${stockist.url}-${stockist.fetchedAt}-${stockist.price}-${index}`}
                            className={`rounded-2xl border px-4 py-3 transition-colors ${
                                selectedUrl && stockist.url === selectedUrl
                                    ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/10"
                                    : "border-slate-100 dark:border-slate-800"
                            }`}
                        >
                            <a
                                href={stockist.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start justify-between gap-3 rounded-xl px-1 py-1 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            >
                                <div className="min-w-0">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        {stockist.url === cheapestUrl && displayStockists.length > 1 ? (
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                CHEAPEST
                                            </span>
                                        ) : null}
                                        {selectedUrl && stockist.url === selectedUrl ? (
                                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                                CELLAR PRICE
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {stockist.source}
                                    </p>
                                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                        {stockist.productName ?? deriveProductNameFromUrl(stockist.url) ?? "Product name unavailable from source"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-lg font-black ${
                                            stockist.url === cheapestUrl
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-slate-600 dark:text-slate-300"
                                        }`}
                                    >
                                        ${stockist.price.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-slate-400">→</span>
                                </div>
                            </a>
                            {stockists.length > 0 ? (
                                <div className="mt-2 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleConfirm(stockist)}
                                        disabled={isPending || (selectedUrl !== null && stockist.url === selectedUrl)}
                                        className="rounded-lg border border-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900/70 dark:text-sky-300"
                                    >
                                        Use for Cellar
                                    </button>
                                    {supportsStockistsPersistence ? (
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(stockist)}
                                            disabled={isPending}
                                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300"
                                        >
                                            Remove
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-400">
                    {isPending ? "Searching retailers..." : "No prices found yet - try refreshing."}
                </p>
            )}

            {!supportsStockistsPersistence ? (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Only the selected cellar price is persisted right now. Full stockist list persistence requires the stockists DB migration.
                </p>
            ) : null}

            {error ? <p className="mt-3 text-xs text-rose-500">{error}</p> : null}
        </div>
    );
}
