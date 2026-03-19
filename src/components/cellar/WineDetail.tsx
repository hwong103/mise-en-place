import Image from "next/image";
import Link from "next/link";
import PriceCard from "@/components/cellar/PriceCard";
import type { StockistResult } from "@/lib/wine";

const WINE_TYPE_COLORS: Record<string, string> = {
    RED: "bg-rose-900", WHITE: "bg-amber-100 dark:bg-amber-900",
    SPARKLING: "bg-yellow-100 dark:bg-yellow-900",
    ROSE: "bg-pink-200 dark:bg-pink-900",
    DESSERT: "bg-amber-200 dark:bg-amber-800",
    FORTIFIED: "bg-amber-800", OTHER: "bg-slate-200 dark:bg-slate-700",
};

type WineDetailModel = {
    id: string;
    name: string;
    producer: string | null;
    vintage: number | null;
    grapes: string[];
    region: string | null;
    country: string | null;
    type: string;
    rating: number | null;
    tastingNotes: string | null;
    imageUrl: string | null;
    danMurphysPrice: number | null;
    danMurphysUrl: string | null;
    danMurphysSource: string | null;
    danMurphysPriceAt: Date | null;
    locationName: string | null;
    locationAddress: string | null;
    locationLat: number | null;
    locationLng: number | null;
};

export default function WineDetail({
    wine,
    stockists,
    supportsStockistsPersistence,
    deleteAction,
    refreshPriceAction,
    confirmStockistAction,
    removeStockistAction,
}: {
    wine: WineDetailModel;
    stockists: StockistResult[];
    supportsStockistsPersistence: boolean;
    deleteAction: (fd: FormData) => Promise<void>;
    refreshPriceAction: (fd: FormData) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        bottleImageUrl?: string | null;
        error?: string;
    } | undefined>;
    confirmStockistAction: (fd: FormData) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        selectedUrl?: string | null;
        error?: string;
    } | undefined>;
    removeStockistAction: (fd: FormData) => Promise<{
        success?: boolean;
        stockists?: StockistResult[];
        selectedUrl?: string | null;
        error?: string;
    } | undefined>;
}) {
    return (
        <div className="mx-auto max-w-2xl space-y-8">
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-sm dark:border-slate-800">
                {wine.imageUrl ? (
                    <Image
                        src={wine.imageUrl}
                        alt={wine.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 768px"
                        className="object-cover object-top opacity-40"
                    />
                ) : (
                    <div className={`absolute inset-y-0 left-0 w-1.5 ${WINE_TYPE_COLORS[wine.type]}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/65 to-slate-950/90" />

                <div className="relative flex min-h-[200px] flex-col justify-between p-5 md:p-8">
                    <div className="flex items-start justify-between gap-3">
                        <Link
                            href="/cellar"
                            className="rounded-xl border border-white/40 bg-slate-900/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-slate-900/65"
                        >
                            <span className="md:hidden">← Back</span>
                            <span className="hidden md:inline">← Back to Cellar</span>
                        </Link>

                        <details className="group relative">
                            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg leading-none text-white/60 transition-colors hover:bg-white/20 hover:text-white [&::-webkit-details-marker]:hidden">
                                &middot;&middot;&middot;
                            </summary>
                            <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                <Link
                                    href={`/cellar/${wine.id}/edit`}
                                    className="block px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Edit
                                </Link>
                                <form action={deleteAction}>
                                    <input type="hidden" name="id" value={wine.id} />
                                    <button
                                        type="submit"
                                        className="block w-full px-3 py-2 text-left text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                    >
                                        Delete
                                    </button>
                                </form>
                            </div>
                        </details>
                    </div>

                    <div className="mt-6 flex items-end gap-5">
                        {wine.rating ? (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-500/20 text-2xl font-black text-emerald-300 ring-1 ring-emerald-400/30">
                                {wine.rating}
                            </div>
                        ) : null}
                        <div className="min-w-0 flex-1">
                            <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
                                {wine.name}
                                {wine.vintage ? (
                                    <span className="ml-2 font-normal text-white/50">{wine.vintage}</span>
                                ) : null}
                            </h1>
                            {wine.producer ? (
                                <p className="mt-1 text-white/60">{wine.producer}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {wine.grapes.map((g) => (
                                    <span
                                        key={g}
                                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/10"
                                    >
                                        {g}
                                    </span>
                                ))}
                                {wine.region ? (
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50 ring-1 ring-white/10">
                                        {wine.region}{wine.country ? `, ${wine.country}` : ""}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tasting notes */}
            {wine.tastingNotes ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Tasting Notes</p>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{wine.tastingNotes}</p>
                </div>
            ) : null}

            {/* Price */}
            <PriceCard
                wineId={wine.id}
                initialStockists={stockists}
                supportsStockistsPersistence={supportsStockistsPersistence}
                legacyPrice={wine.danMurphysPrice}
                legacyUrl={wine.danMurphysUrl}
                legacySource={wine.danMurphysSource ?? null}
                legacyPriceAt={wine.danMurphysPriceAt}
                refreshAction={refreshPriceAction}
                confirmAction={confirmStockistAction}
                removeAction={removeStockistAction}
            />

            {/* Location */}
            {wine.locationName ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Where You Tried It</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{wine.locationName}</p>
                    {wine.locationAddress ? <p className="text-sm text-slate-500">{wine.locationAddress}</p> : null}
                    {wine.locationLat && wine.locationLng ? (
                        <a
                            href={`https://www.google.com/maps?q=${wine.locationLat},${wine.locationLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                            Open in Maps →
                        </a>
                    ) : null}
                </div>
            ) : null}

        </div>
    );
}
