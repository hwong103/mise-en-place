import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineDetail from "@/components/cellar/WineDetail";
import type { StockistResult } from "@/lib/wine";
import { hasWineStockistsColumn, isMissingStockistsColumnError, markWineStockistsColumnMissing } from "@/lib/wine-stockists";
import { confirmWineStockist, deleteWine, refreshWinePrice, removeWineStockist } from "../actions";

export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const householdId = await getCurrentHouseholdId();
    const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));

    const baseSelect = {
        id: true,
        name: true,
        producer: true,
        vintage: true,
        grapes: true,
        region: true,
        country: true,
        type: true,
        rating: true,
        tastingNotes: true,
        imageUrl: true,
        danMurphysPrice: true,
        danMurphysUrl: true,
        danMurphysSource: true,
        danMurphysPriceAt: true,
        locationName: true,
        locationAddress: true,
        locationLat: true,
        locationLng: true,
        ...(supportsStockists ? { stockists: true } : {}),
    };

    let wine = await prisma.wine.findFirst({
        where: { id, householdId },
        select: baseSelect,
    }).catch(async (error) => {
        if (!isMissingStockistsColumnError(error)) throw error;
        markWineStockistsColumnMissing();
        return prisma.wine.findFirst({
            where: { id, householdId },
            select: {
                id: true,
                name: true,
                producer: true,
                vintage: true,
                grapes: true,
                region: true,
                country: true,
                type: true,
                rating: true,
                tastingNotes: true,
                imageUrl: true,
                danMurphysPrice: true,
                danMurphysUrl: true,
                danMurphysSource: true,
                danMurphysPriceAt: true,
                locationName: true,
                locationAddress: true,
                locationLat: true,
                locationLng: true,
            },
        });
    });
    if (!wine) notFound();
    const rawStockists = "stockists" in wine ? wine.stockists : null;
    const stockists: StockistResult[] = Array.isArray(rawStockists)
        ? rawStockists.filter((entry): entry is StockistResult =>
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
        )
        : [];

    return (
        <WineDetail
            wine={wine}
            stockists={stockists}
            supportsStockistsPersistence={supportsStockists}
            deleteAction={deleteWine}
            refreshPriceAction={refreshWinePrice}
            confirmStockistAction={confirmWineStockist}
            removeStockistAction={removeWineStockist}
        />
    );
}
