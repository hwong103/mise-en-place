import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import CellarClient from "@/components/cellar/CellarClient";

export default async function CellarPage() {
    const householdId = await getCurrentHouseholdId();

    const wines = await prisma.wine.findMany({
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
                const { fetchBottlePrice } = await import("@/lib/wine");
                const result = await fetchBottlePrice(w.name, w.producer ?? undefined, w.vintage ?? undefined);
                if (!result) return;
                await prisma.wine.update({
                    where: { id: w.id },
                    data: {
                        danMurphysPrice: result.price,
                        danMurphysUrl: result.url,
                        danMurphysSource: result.source,
                        danMurphysPriceAt: new Date(),
                    },
                });
            })
        );
    }

    return <CellarClient wines={wines} />;
}
