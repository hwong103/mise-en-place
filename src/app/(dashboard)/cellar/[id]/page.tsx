import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineDetail from "@/components/cellar/WineDetail";
import { deleteWine, refreshWinePrice } from "../actions";

type SimilarWine = {
    id: string;
    name: string;
    producer: string | null;
    vintage: number | null;
    grapes: string[];
    type: string;
    rating: number | null;
    region: string | null;
};

export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) notFound();

    const similarWines = await prisma.wine.findMany({
        where: {
            householdId,
            id: { not: id },
            OR: [{ type: wine.type }],
        },
        select: {
            id: true,
            name: true,
            producer: true,
            vintage: true,
            grapes: true,
            type: true,
            rating: true,
            region: true,
        },
        orderBy: { rating: "desc" },
        take: 10,
    });

    const wineGrapes = new Set<string>(wine.grapes.map((grape: string) => grape.toLowerCase()));
    const scored = similarWines
        .map((candidate: SimilarWine) => {
            const sharedGrapes = candidate.grapes.filter((grape: string) => wineGrapes.has(grape.toLowerCase())).length;
            const sameType = candidate.type === wine.type ? 1 : 0;
            return { wine: candidate, score: sameType + sharedGrapes };
        })
        .filter((candidate: { wine: SimilarWine; score: number }) => candidate.score > 0)
        .sort(
            (a: { wine: SimilarWine; score: number }, b: { wine: SimilarWine; score: number }) =>
                b.score - a.score
        )
        .slice(0, 4)
        .map((candidate: { wine: SimilarWine; score: number }) => candidate.wine);

    return (
        <div>
            <Link
                href="/cellar"
                className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
                ← The Cellar
            </Link>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    <WineDetail
                        wine={wine}
                        deleteAction={deleteWine}
                        refreshPriceAction={refreshWinePrice}
                    />
                </div>

                {scored.length > 0 ? (
                    <aside className="w-full lg:w-64 lg:shrink-0">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                            From Your Cellar
                        </p>
                        <div className="space-y-2">
                            {scored.map((similar: SimilarWine) => (
                                <Link
                                    key={similar.id}
                                    href={`/cellar/${similar.id}`}
                                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-all hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {similar.name}
                                            {similar.vintage ? (
                                                <span className="ml-1 font-normal text-slate-400">{similar.vintage}</span>
                                            ) : null}
                                        </p>
                                        {similar.producer ? (
                                            <p className="truncate text-xs text-slate-400">{similar.producer}</p>
                                        ) : null}
                                        {similar.grapes.length > 0 ? (
                                            <p className="truncate text-xs text-slate-400">
                                                {similar.grapes.join(", ")}
                                            </p>
                                        ) : null}
                                    </div>
                                    {similar.rating ? (
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            {similar.rating}
                                        </div>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}
