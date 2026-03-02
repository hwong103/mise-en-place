import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineDetail from "@/components/cellar/WineDetail";
import { deleteWine, refreshWinePrice } from "../actions";

export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) notFound();

    return (
        <WineDetail
            wine={wine}
            deleteAction={deleteWine}
            refreshPriceAction={refreshWinePrice}
        />
    );
}
