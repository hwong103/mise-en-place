import Link from "next/link";
import { Wine } from "@prisma/client";

const WINE_TYPE_COLORS: Record<string, string> = {
    RED: "bg-rose-900", WHITE: "bg-amber-100 dark:bg-amber-900",
    SPARKLING: "bg-yellow-100 dark:bg-yellow-900",
    ROSE: "bg-pink-200 dark:bg-pink-900",
    DESSERT: "bg-amber-200 dark:bg-amber-800",
    FORTIFIED: "bg-amber-800", OTHER: "bg-slate-200 dark:bg-slate-700",
};

export default function WineDetail({
    wine,
    deleteAction,
    refreshPriceAction,
}: {
    wine: Wine;
    deleteAction: (fd: FormData) => Promise<void>;
    refreshPriceAction: (fd: FormData) => Promise<void>;
}) {
    const now = new Date().getTime();
    const priceAge = wine.danMurphysPriceAt
        ? Math.round((now - new Date(wine.danMurphysPriceAt).getTime()) / 1000 / 60 / 60)
        : null;

    return (
        <div className="mx-auto max-w-2xl space-y-8">
            {/* Hero */}
            <div className="flex items-start gap-5">
                <div className={`mt-1 h-16 w-2 shrink-0 rounded-full ${WINE_TYPE_COLORS[wine.type]}`} />
                <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">
                        {wine.name}
                        {wine.vintage ? <span className="ml-2 font-normal text-slate-400">{wine.vintage}</span> : null}
                    </h1>
                    {wine.producer ? <p className="text-slate-500 dark:text-slate-400">{wine.producer}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {wine.grapes.map((g) => (
                            <span key={g} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {g}
                            </span>
                        ))}
                        {wine.region ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {wine.region}{wine.country ? `, ${wine.country}` : ""}
                            </span>
                        ) : null}
                    </div>
                </div>
                {wine.rating ? (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-2xl font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {wine.rating}
                    </div>
                ) : null}
            </div>

            {/* Tasting notes */}
            {wine.tastingNotes ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Tasting Notes</p>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{wine.tastingNotes}</p>
                </div>
            ) : null}

            {/* Dan Murphy's price */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Dan Murphy&apos;s Price</p>
                        {wine.danMurphysPrice ? (
                            <p className="mt-0.5 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                ${wine.danMurphysPrice.toFixed(2)}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-sm text-slate-400">Not found</p>
                        )}
                        {priceAge !== null ? (
                            <p className="text-xs text-slate-400">
                                Updated {priceAge < 1 ? "just now" : `${priceAge}h ago`}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex gap-2">
                        {wine.danMurphysUrl ? (
                            <a
                                href={wine.danMurphysUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                            >
                                View →
                            </a>
                        ) : null}
                        <form action={refreshPriceAction}>
                            <input type="hidden" name="id" value={wine.id} />
                            <button type="submit" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                                Refresh
                            </button>
                        </form>
                    </div>
                </div>
            </div>

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

            {/* Actions */}
            <div className="flex gap-3">
                <Link
                    href={`/cellar/${wine.id}/edit`}
                    className="flex-1 rounded-2xl border border-slate-200 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    Edit
                </Link>
                <form action={deleteAction} className="flex-1">
                    <input type="hidden" name="id" value={wine.id} />
                    <button
                        type="submit"
                        className="w-full rounded-2xl border border-rose-200 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                        Delete
                    </button>
                </form>
            </div>
        </div>
    );
}
