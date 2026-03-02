import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineDetail from "@/components/cellar/WineDetail";
import type { StockistResult } from "@/lib/wine";
import { deleteWine, refreshWinePrice } from "../actions";

export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) notFound();
    const rawStockists = wine.stockists;
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
            deleteAction={deleteWine}
            refreshPriceAction={refreshWinePrice}
        />
    );
}
