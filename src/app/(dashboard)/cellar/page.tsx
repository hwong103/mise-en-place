import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import CellarClient from "@/components/cellar/CellarClient";
import type { StockistResult } from "@/lib/wine";
import { isMissingStockistsColumnError } from "@/lib/wine-stockists";

const parseStockists = (value: unknown): StockistResult[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is StockistResult =>
        Boolean(
            entry
            && typeof entry === "object"
            && "source" in entry
            && "price" in entry
            && "url" in entry
            && "fetchedAt" in entry
            && typeof entry.source === "string"
            && typeof entry.price === "number"
            && typeof entry.url === "string"
            && typeof entry.fetchedAt === "string"
        )
    );
};

export default async function CellarPage() {
    const householdId = await getCurrentHouseholdId();

    let wines;
    try {
        wines = await prisma.wine.findMany({
            where: { householdId },
            orderBy: [{ type: "asc" }, { rating: "desc" }, { createdAt: "desc" }],
            select: {
                id: true, name: true, producer: true, vintage: true,
                grapes: true, region: true, country: true, type: true,
                rating: true, imageUrl: true, locationName: true,
                danMurphysPrice: true, danMurphysPriceAt: true,
                danMurphysProductId: true, stockists: true,
            },
        });
    } catch (error) {
        if (!isMissingStockistsColumnError(error)) throw error;
        const fallback = await prisma.wine.findMany({
            where: { householdId },
            orderBy: [{ type: "asc" }, { rating: "desc" }, { createdAt: "desc" }],
            select: {
                id: true, name: true, producer: true, vintage: true,
                grapes: true, region: true, country: true, type: true,
                rating: true, imageUrl: true, locationName: true,
                danMurphysPrice: true, danMurphysPriceAt: true,
                danMurphysProductId: true,
            },
        });
        wines = fallback.map((wine) => ({ ...wine, stockists: null }));
    }

    // Refresh prices older than 24h in the background (non-blocking)
    const staleWines = wines.filter((w) => {
        if (!w.danMurphysProductId) return false;
        if (!w.danMurphysPriceAt) return true;
        const ageHours = (Date.now() - new Date(w.danMurphysPriceAt).getTime()) / 1000 / 60 / 60;
        return ageHours > 24;
    });

    // Fire-and-forget — don't await, don't block page render
    if (staleWines.length > 0) {
        void Promise.all(
            staleWines.slice(0, 5).map(async (w) => {  // max 5 at a time
                const { fetchAllStockists } = await import("@/lib/wine");
                const stockists = await fetchAllStockists(w.name, w.producer ?? undefined, w.vintage ?? undefined);
                if (!stockists.length) return;
                const cheapest = stockists[0];
                const updateData = {
                    stockists,
                    danMurphysPrice: cheapest.price,
                    danMurphysUrl: cheapest.url,
                    danMurphysSource: cheapest.source,
                    danMurphysPriceAt: new Date(),
                };
                try {
                    await prisma.wine.update({
                        where: { id: w.id },
                        data: updateData,
                    });
                } catch (error) {
                    if (!isMissingStockistsColumnError(error)) throw error;
                    const { stockists: _stockists, ...fallbackData } = updateData;
                    await prisma.wine.update({
                        where: { id: w.id },
                        data: fallbackData,
                    });
                }
            })
        );
    }

    const winesForClient = wines.map((wine) => ({
        ...wine,
        stockists: parseStockists(wine.stockists),
    }));

    return <CellarClient wines={winesForClient} />;
}
