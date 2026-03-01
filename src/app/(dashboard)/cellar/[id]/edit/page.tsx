import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineEditForm from "@/components/cellar/WineEditForm";
import { updateWine } from "../../actions";

export default async function WineEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) notFound();

    return <WineEditForm wine={wine} updateAction={updateWine} />;
}
