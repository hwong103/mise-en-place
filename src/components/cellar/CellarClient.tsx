"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, Link2, MapPin, PencilLine, Wine as WineIcon } from "lucide-react";
import { createWineFromPhoto, createWineFromUrl, createWineManually } from "@/app/(dashboard)/cellar/actions";

// Types
type WineSummary = {
    id: string; name: string; producer?: string | null;
    vintage?: number | null; grapes: string[];
    region?: string | null; country?: string | null;
    type: string; rating?: number | null;
    imageUrl?: string | null; locationName?: string | null;
    danMurphysPrice?: number | null; danMurphysPriceAt?: Date | null;
    stockists?: Array<{ source: string; price: number; url: string; fetchedAt: string; productName?: string }> | null;
};

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
    const [pickerOpen, setPickerOpen] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [urlError, setUrlError] = useState<string | null>(null);
    const [pendingMode, setPendingMode] = useState<"photo" | "url" | "manual" | null>(null);
    const [isPending, startTransition] = useTransition();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    const isLoading = isPending;

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPickerOpen(false);
        setPendingMode("photo");
        const base64 = await fileToBase64(file);
        const formData = new FormData();
        formData.set("base64Image", base64);
        formData.set("mimeType", file.type || "image/jpeg");
        startTransition(async () => {
            const result = await createWineFromPhoto(formData);
            if (result?.error) {
                setUrlError(result.error);
                setPendingMode(null);
                setPickerOpen(true);
            }
        });
    };

    const handleUrlSubmit = () => {
        if (!urlInput.trim()) return;
        setUrlError(null);
        setPendingMode("url");
        setPickerOpen(false);
        const formData = new FormData();
        formData.set("url", urlInput.trim());
        startTransition(async () => {
            const result = await createWineFromUrl(formData);
            if (result?.error) {
                setUrlError(result.error);
                setPendingMode(null);
                setPickerOpen(true);
            }
        });
    };

    const handleManual = () => {
        setPickerOpen(false);
        setPendingMode("manual");
        startTransition(async () => {
            await createWineManually();
        });
    };

    // Picker loading label
    const loadingLabel =
        pendingMode === "photo" ? "Reading label…" :
            pendingMode === "url" ? "Fetching URL…" :
                pendingMode === "manual" ? "Opening form…" : "";

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

    const grouped = filtered.reduce<Record<string, WineSummary[]>>((acc, wine) => {
        if (!acc[wine.type]) acc[wine.type] = [];
        acc[wine.type].push(wine);
        return acc;
    }, {});

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

                {/* Log a Wine button + picker */}
                <div className="relative" ref={pickerRef}>
                    <button
                        type="button"
                        onClick={() => setPickerOpen((o) => !o)}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                {loadingLabel}
                            </span>
                        ) : (
                            <>
                                <WineIcon className="h-4 w-4" aria-hidden="true" />
                                <span>Log a Wine</span>
                                <span className={`text-[10px] transition-transform ${pickerOpen ? "rotate-180" : ""}`}>▼</span>
                            </>
                        )}
                    </button>

                    {pickerOpen && (
                        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {/* Photo option */}
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                />
                                <Camera className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Photo</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Snap the label, Groq fills in the details</p>
                                </div>
                            </label>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                            {/* URL option */}
                            <div className="px-3 py-2.5">
                                <div className="mb-2 flex items-center gap-3">
                                    <Link2 className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">URL</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Vivino, Wine Searcher, winery page</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                                        placeholder="Paste link..."
                                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleUrlSubmit}
                                        disabled={!urlInput.trim()}
                                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                                    >
                                        Go
                                    </button>
                                </div>
                                {urlError && <p className="mt-1.5 text-[10px] leading-tight text-rose-500">{urlError}</p>}
                            </div>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                            {/* Manual option */}
                            <button
                                type="button"
                                onClick={handleManual}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <PencilLine className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Manual</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Type in the details yourself</p>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
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
                                        {/* Bottle image (fallback to colour swatch) */}
                                        {wine.imageUrl ? (
                                            <img
                                                src={wine.imageUrl}
                                                alt={wine.name}
                                                className="h-14 w-10 shrink-0 rounded-lg object-contain"
                                            />
                                        ) : (
                                            <div className={`h-14 w-1.5 shrink-0 rounded-full ${WINE_TYPE_COLORS[wine.type]}`} />
                                        )}

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
                                                {wine.locationName ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {wine.locationName}
                                                    </span>
                                                ) : null}
                                                {(() => {
                                                    const stockists = Array.isArray(wine.stockists) ? wine.stockists : [];
                                                    const cheapest = stockists.length > 0
                                                        ? stockists.reduce((a, b) => (a.price < b.price ? a : b))
                                                        : null;
                                                    const price = wine.danMurphysPrice ?? cheapest?.price;
                                                    return price ? (
                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                            from ${price.toFixed(2)}
                                                        </span>
                                                    ) : null;
                                                })()}
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
