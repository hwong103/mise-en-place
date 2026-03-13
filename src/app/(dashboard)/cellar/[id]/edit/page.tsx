import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { readStringArray } from "@/lib/json-arrays";
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

    const wine = await prisma.wine.findFirst({
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
            triedAt: true,
            locationName: true,
            locationAddress: true,
            locationLat: true,
            locationLng: true,
        },
    });
    if (!wine) notFound();

    return (
        <WineEditForm
            wine={{
                ...wine,
                grapes: readStringArray(wine.grapes),
            }}
            updateAction={updateWine}
            mode={(mode as "photo" | "url" | "manual" | "edit") ?? "edit"}
        />
    );
}
