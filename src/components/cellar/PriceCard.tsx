"use client";

import { useState, useTransition } from "react";

type RefreshPriceResult = {
    success?: boolean;
    source?: string;
    price?: number;
    error?: string;
} | undefined;

type PriceCardProps = {
    wineId: string;
    initialPrice: number | null;
    initialUrl: string | null;
    initialSource: string | null;
    initialPriceAt: Date | null;
    refreshAction: (fd: FormData) => Promise<RefreshPriceResult>;
};

export default function PriceCard({
    wineId,
    initialPrice,
    initialUrl,
    initialSource,
    initialPriceAt,
    refreshAction,
}: PriceCardProps) {
    const [price, setPrice] = useState(initialPrice);
    const [url] = useState(initialUrl);
    const [source, setSource] = useState(initialSource);
    const [priceAt, setPriceAt] = useState(initialPriceAt);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const priceAge = priceAt
        ? Math.round((Date.now() - new Date(priceAt).getTime()) / 1000 / 60 / 60)
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
            if (result?.success && result.price !== undefined) {
                setPrice(result.price);
                setSource((current) => result.source ?? current);
                setPriceAt(new Date());
            }
        });
    };

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        {source ?? "Best Price Found"}
                    </p>
                    {price ? (
                        <p className="mt-0.5 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            ${price.toFixed(2)}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-sm text-slate-400">Not found</p>
                    )}
                    {priceAge !== null ? (
                        <p className="text-xs text-slate-400">
                            Updated {priceAge < 1 ? "just now" : `${priceAge}h ago`}
                        </p>
                    ) : null}
                    {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : null}
                </div>
                <div className="flex gap-2">
                    {url ? (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                            View →
                        </a>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
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
        </div>
    );
}
