import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import WineEditForm from "@/components/cellar/WineEditForm";
import { updateWine } from "../../actions";

export default async function WineEditPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ mode?: string }>;
}) {
    const { id } = await params;
    const { mode } = await searchParams;
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) notFound();

    return (
        <WineEditForm
            wine={wine}
            updateAction={updateWine}
            mode={(mode as "photo" | "url" | "manual" | "edit") ?? "edit"}
        />
    );
}
