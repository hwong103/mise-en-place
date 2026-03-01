"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createWineFromPhoto } from "@/app/(dashboard)/cellar/actions";

const WINE_TYPE_LABELS: Record<string, string> = {
    RED: "Red", WHITE: "White", SPARKLING: "Sparkling",
    ROSE: "Rosé", DESSERT: "Dessert", FORTIFIED: "Fortified", OTHER: "Other",
};

const WINE_TYPE_COLORS: Record<string, string> = {
    RED: "bg-rose-900",
    WHITE: "bg-amber-100 dark:bg-amber-900",
    SPARKLING: "bg-yellow-100 dark:bg-yellow-900",
    ROSE: "bg-pink-200 dark:bg-pink-900",
    DESSERT: "bg-amber-200 dark:bg-amber-800",
    FORTIFIED: "bg-amber-800",
    OTHER: "bg-slate-200 dark:bg-slate-700",
};

type WineSummary = {
    id: string; name: string; producer?: string | null;
    vintage?: number | null; grapes: string[];
    region?: string | null; country?: string | null;
    type: string; rating?: number | null;
    imageUrl?: string | null; locationName?: string | null;
    danMurphysPrice?: number | null; danMurphysPriceAt?: Date | null;
};

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export default function CellarClient({ wines }: { wines: WineSummary[] }) {
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const filtered = wines.filter((w) => {
        const q = query.toLowerCase();
        const matchesQuery = !q ||
            w.name.toLowerCase().includes(q) ||
            w.producer?.toLowerCase().includes(q) ||
            w.region?.toLowerCase().includes(q) ||
            w.grapes.some((g) => g.toLowerCase().includes(q));
        const matchesType = !typeFilter || w.type === typeFilter;
        return matchesQuery && matchesType;
    });

    // Group by type
    const grouped = filtered.reduce<Record<string, WineSummary[]>>((acc, wine) => {
        if (!acc[wine.type]) acc[wine.type] = [];
        acc[wine.type].push(wine);
        return acc;
    }, {});

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        const formData = new FormData();
        formData.set("base64Image", base64);
        formData.set("mimeType", file.type || "image/jpeg");
        startTransition(async () => {
            await createWineFromPhoto(formData);
        });
    };

    const types = Object.keys(WINE_TYPE_LABELS);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                        The Cellar
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {wines.length} wine{wines.length !== 1 ? "s" : ""} logged
                    </p>
                </div>

                {/* Photo import button */}
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:bg-emerald-700 ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={isPending} />
                    {isPending ? "Reading label…" : "📷 Log a Wine"}
                </label>
            </div>

            {/* Search + type filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search wines, producers, grapes…"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setTypeFilter(null)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!typeFilter ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                    >
                        All
                    </button>
                    {types.map((type) => (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${typeFilter === type ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                        >
                            {WINE_TYPE_LABELS[type]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grouped wine list */}
            {Object.keys(grouped).length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400 dark:border-slate-800">
                    {wines.length === 0 ? "No wines yet. Log your first bottle." : "No wines match your search."}
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.entries(grouped).map(([type, typeWines]) => (
                        <section key={type}>
                            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                                {WINE_TYPE_LABELS[type]} · {typeWines.length}
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {typeWines.map((wine) => (
                                    <Link
                                        key={wine.id}
                                        href={`/cellar/${wine.id}`}
                                        className="group flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500"
                                    >
                                        {/* Wine colour swatch */}
                                        <div className={`h-14 w-1.5 shrink-0 rounded-full ${WINE_TYPE_COLORS[wine.type]}`} />

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                                                {wine.name}
                                                {wine.vintage ? <span className="ml-1.5 font-normal text-slate-400">{wine.vintage}</span> : null}
                                            </p>
                                            {wine.producer ? (
                                                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{wine.producer}</p>
                                            ) : null}
                                            {wine.grapes.length > 0 ? (
                                                <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                                                    {wine.grapes.join(", ")}
                                                </p>
                                            ) : null}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                                {wine.locationName ? <span>📍 {wine.locationName}</span> : null}
                                                {wine.danMurphysPrice ? (
                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                        ${wine.danMurphysPrice.toFixed(2)}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Rating */}
                                        {wine.rating ? (
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                {wine.rating}
                                            </div>
                                        ) : null}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
