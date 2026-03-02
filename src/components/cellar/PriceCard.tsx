"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StockistResult } from "@/lib/wine";

type PriceCardProps = {
    wineId: string;
    initialStockists: StockistResult[];
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
};

export default function PriceCard({
    wineId,
    initialStockists,
    legacyPrice,
    legacyUrl,
    legacySource,
    legacyPriceAt,
    refreshAction,
}: PriceCardProps) {
    const router = useRouter();
    const [stockists, setStockists] = useState<StockistResult[]>(initialStockists);
    const [error, setError] = useState<string | null>(null);
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

    const lastFetched = displayStockists[0]?.fetchedAt
        ? Math.round((Date.now() - new Date(displayStockists[0].fetchedAt).getTime()) / 1000 / 60 / 60)
        : null;

    const handleRefresh = () => {
        setError(null);
        const formData = new FormData();
        formData.set("id", wineId);
        startTransition(async () => {
            const result = await refreshAction(formData);
            if (result?.error) {
                setError(result.error);
                return;
            }
            if (result?.stockists?.length) {
                setStockists(result.stockists);
            }
            if (result?.bottleImageUrl) {
                router.refresh();
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
                                Searching...
                            </>
                        ) : "Refresh"}
                    </button>
                </div>
            </div>

            {displayStockists.length > 0 ? (
                <div className="space-y-2">
                    {displayStockists.map((stockist, index) => (
                        <a
                            key={stockist.source}
                            href={stockist.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                        >
                            <div className="flex items-center gap-3">
                                {index === 0 && displayStockists.length > 1 ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                        CHEAPEST
                                    </span>
                                ) : null}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {stockist.source}
                                    </p>
                                    {stockist.productName ? (
                                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                            {stockist.productName}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-lg font-black ${
                                        index === 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-slate-600 dark:text-slate-300"
                                    }`}
                                >
                                    ${stockist.price.toFixed(2)}
                                </span>
                                <span className="text-xs text-slate-400">→</span>
                            </div>
                        </a>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-400">
                    {isPending ? "Searching retailers..." : "No prices found yet - try refreshing."}
                </p>
            )}

            {error ? <p className="mt-3 text-xs text-rose-500">{error}</p> : null}
        </div>
    );
}
