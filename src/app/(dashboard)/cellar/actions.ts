"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import type { WineType } from "@/lib/db-types";
import { getCurrentHouseholdId } from "@/lib/household";
import { extractWineFromImageViaGroq, extractWineFromNameViaGroq, extractWineFromUrlViaGroq, fetchAllStockists } from "@/lib/wine";
import { hasWineStockistsColumn, isMissingStockistsColumnError, markWineStockistsColumnMissing } from "@/lib/wine-stockists";
import type { StockistResult, WineVisionResult } from "@/lib/wine";

const isNextRedirectError = (error: unknown): error is { digest: string } =>
    typeof error === "object"
    && error !== null
    && "digest" in error
    && typeof (error as { digest: unknown }).digest === "string"
    && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");

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
            && (!("productName" in entry) || typeof entry.productName === "string" || typeof entry.productName === "undefined")
        )
    );
};

const stockistsMatch = (entry: StockistResult, target: {
    source: string;
    url: string;
    fetchedAt: string;
    price: number;
}) =>
    entry.source === target.source
    && entry.url === target.url
    && entry.fetchedAt === target.fetchedAt
    && Math.abs(entry.price - target.price) < 0.0001;

// ─── Create wine from photo ──────────────────────────────────────────────────

export async function createWineFromPhoto(formData: FormData) {
    try {
        const householdId = await getCurrentHouseholdId();
        const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
        const base64Image = formData.get("base64Image")?.toString();
        const mimeType = formData.get("mimeType")?.toString() ?? "image/jpeg";

        if (!base64Image) return { error: "No image provided" };

        const vision = await extractWineFromImageViaGroq(base64Image, mimeType);
        if (!vision) return { error: "Could not read label. Try a clearer photo." };

        const { stockists, bottleImageUrl } = await fetchAllStockists(vision.name, vision.producer, vision.vintage);
        const dmPrice = stockists[0];

        const createData = {
            householdId,
            name: vision.name,
            producer: vision.producer ?? null,
            vintage: vision.vintage ?? null,
            grapes: vision.grapes ?? [],
            region: vision.region ?? null,
            country: vision.country ?? null,
            type: (vision.type as WineType) ?? "RED",
            imageUrl: bottleImageUrl ?? null,
            danMurphysProductId: dmPrice?.url ?? null,
            danMurphysUrl: dmPrice?.url ?? null,
            danMurphysPrice: dmPrice?.price ?? null,
            danMurphysSource: dmPrice?.source ?? null,
            danMurphysPriceAt: dmPrice ? new Date() : null,
            ...(supportsStockists ? { stockists: stockists.length > 0 ? stockists : undefined } : {}),
        };

        let wine;
        try {
            wine = await prisma.wine.create({
                data: createData,
                select: { id: true },
            });
        } catch (error) {
            if (!isMissingStockistsColumnError(error)) throw error;
            markWineStockistsColumnMissing();
            const { stockists: _stockists, ...fallbackData } = createData;
            wine = await prisma.wine.create({
                data: fallbackData,
                select: { id: true },
            });
        }

        revalidatePath("/cellar");
        redirect(`/cellar/${wine.id}/edit?mode=photo`);
    } catch (error) {
        if (isNextRedirectError(error)) throw error;
        console.error("[cellar] Failed to create wine from photo:", error);
        return { error: "Photo import failed. Check server logs and API key configuration." };
    }
}

// ─── Create blank wine for manual entry ──────────────────────────────────────

export async function createWineManually() {
    const householdId = await getCurrentHouseholdId();

    const wine = await prisma.wine.create({
        data: {
            householdId,
            name: "New Wine",
            grapes: [],
            type: "RED",
        },
        select: { id: true },
    });

    revalidatePath("/cellar");
    redirect(`/cellar/${wine.id}/edit?mode=manual`);
}

// ─── Create wine from URL ─────────────────────────────────────────────────────

export async function createWineFromUrl(formData: FormData) {
    try {
        const householdId = await getCurrentHouseholdId();
        const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
        const url = formData.get("url")?.toString().trim();
        if (!url) return { error: "No URL provided" };

        const vision = await extractWineFromUrlViaGroq(url);
        if (!vision) return { error: "Could not extract wine details from that URL." };

        const { stockists, bottleImageUrl } = await fetchAllStockists(vision.name, vision.producer, vision.vintage);
        const dmPrice = stockists[0];

        const createData = {
            householdId,
            name: vision.name,
            producer: vision.producer ?? null,
            vintage: vision.vintage ?? null,
            grapes: vision.grapes ?? [],
            region: vision.region ?? null,
            country: vision.country ?? null,
            type: (vision.type as WineType) ?? "RED",
            imageUrl: vision.imageUrl ?? bottleImageUrl ?? null,
            tastingNotes: vision.tastingNotes ?? null,
            danMurphysProductId: dmPrice?.url ?? null,
            danMurphysUrl: dmPrice?.url ?? null,
            danMurphysPrice: dmPrice?.price ?? null,
            danMurphysSource: dmPrice?.source ?? null,
            danMurphysPriceAt: dmPrice ? new Date() : null,
            ...(supportsStockists ? { stockists: stockists.length > 0 ? stockists : undefined } : {}),
        };

        let wine;
        try {
            wine = await prisma.wine.create({
                data: createData,
                select: { id: true },
            });
        } catch (error) {
            if (!isMissingStockistsColumnError(error)) throw error;
            markWineStockistsColumnMissing();
            const { stockists: _stockists, ...fallbackData } = createData;
            wine = await prisma.wine.create({
                data: fallbackData,
                select: { id: true },
            });
        }

        revalidatePath("/cellar");
        redirect(`/cellar/${wine.id}/edit?mode=url`);
    } catch (error) {
        if (isNextRedirectError(error)) throw error;
        console.error("[cellar] Failed to create wine from URL:", error);
        return { error: "URL import failed. Check server logs and API key configuration." };
    }
}

export async function createWineFromName(formData: FormData) {
    try {
        const householdId = await getCurrentHouseholdId();
        const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
        const rawName = formData.get("name")?.toString().trim();
        if (!rawName) return { error: "No wine name provided" };

        const vintageMatch = rawName.match(/\b(19|20)\d{2}\b/);
        const vintage = vintageMatch ? Number(vintageMatch[0]) : undefined;

        const { stockists, bottleImageUrl } = await fetchAllStockists(rawName, undefined, vintage);
        const cheapest = stockists[0];

        const pickMetadataUrl = (results: typeof stockists): string | null => {
            const priority = [
                /thewinecollective\.com\.au/i,
                /vivino\.com/i,
                /danmurphys\.com\.au/i,
            ];
            for (const pattern of priority) {
                const match = results.find((entry) => pattern.test(entry.url));
                if (match) return match.url;
            }
            return results[0]?.url ?? null;
        };

        const metadataUrl = pickMetadataUrl(stockists);

        let vision: WineVisionResult | null = null;
        if (metadataUrl) {
            vision = await extractWineFromUrlViaGroq(metadataUrl);
        }
        if (!vision?.name) {
            vision = await extractWineFromNameViaGroq(rawName);
        }

        const imageUrl = vision?.imageUrl ?? bottleImageUrl ?? null;

        const createData = {
            householdId,
            name: rawName,
            producer: vision?.producer ?? null,
            vintage: vision?.vintage ?? vintage ?? null,
            grapes: vision?.grapes ?? [],
            region: vision?.region ?? null,
            country: vision?.country ?? null,
            type: (vision?.type as WineType) ?? "RED",
            imageUrl,
            tastingNotes: vision?.tastingNotes ?? null,
            danMurphysProductId: cheapest?.url ?? null,
            danMurphysUrl: cheapest?.url ?? null,
            danMurphysPrice: cheapest?.price ?? null,
            danMurphysSource: cheapest?.source ?? null,
            danMurphysPriceAt: cheapest ? new Date() : null,
            ...(supportsStockists ? { stockists: stockists.length > 0 ? stockists : undefined } : {}),
        };

        let wine;
        try {
            wine = await prisma.wine.create({ data: createData, select: { id: true } });
        } catch (error) {
            if (!isMissingStockistsColumnError(error)) throw error;
            markWineStockistsColumnMissing();
            const { stockists: _stockists, ...fallbackData } = createData;
            wine = await prisma.wine.create({ data: fallbackData, select: { id: true } });
        }

        revalidatePath("/cellar");
        redirect(`/cellar/${wine.id}/edit?mode=name`);
    } catch (error) {
        if (isNextRedirectError(error)) throw error;
        console.error("[cellar] Failed to create wine from name:", error);
        return { error: "Search failed. Try a more specific name, or use manual entry." };
    }
}

// ─── Update wine (after photo import or manual edit) ─────────────────────────

export async function updateWine(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const id = formData.get("id")?.toString();
    if (!id) return;

    const grapeRaw = formData.get("grapes")?.toString() ?? "";
    const grapes = grapeRaw.split(",").map((g) => g.trim()).filter(Boolean);

    await prisma.wine.updateMany({
        where: { id, householdId },
        data: {
            name: formData.get("name")?.toString() ?? "",
            producer: formData.get("producer")?.toString() || null,
            vintage: formData.get("vintage") ? Number(formData.get("vintage")) : null,
            grapes,
            region: formData.get("region")?.toString() || null,
            country: formData.get("country")?.toString() || null,
            type: (formData.get("type")?.toString() as WineType) ?? "RED",
            rating: formData.get("rating") ? Number(formData.get("rating")) : null,
            tastingNotes: formData.get("tastingNotes")?.toString() || null,
            triedAt: formData.get("triedAt") ? new Date(formData.get("triedAt")!.toString()) : null,
            locationName: formData.get("locationName")?.toString() || null,
            locationAddress: formData.get("locationAddress")?.toString() || null,
            locationLat: formData.get("locationLat") ? Number(formData.get("locationLat")) : null,
            locationLng: formData.get("locationLng") ? Number(formData.get("locationLng")) : null,
        },
    });

    revalidatePath("/cellar");
    revalidatePath(`/cellar/${id}`);
    redirect(`/cellar/${id}`);
}

// ─── Delete wine ─────────────────────────────────────────────────────────────

export async function deleteWine(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const id = formData.get("id")?.toString();
    if (!id) return;

    await prisma.wine.deleteMany({ where: { id, householdId } });
    revalidatePath("/cellar");
    redirect("/cellar");
}

// ─── Refresh Dan Murphy's price ───────────────────────────────────────────────

export async function refreshWinePrice(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
    const id = formData.get("id")?.toString();
    if (!id) return { error: "Missing wine ID" };

    const wine = await prisma.wine.findFirst({
        where: { id, householdId },
        select: { id: true, name: true, producer: true, vintage: true, imageUrl: true },
    });
    if (!wine) return { error: "Wine not found" };

    const { stockists, bottleImageUrl } = await fetchAllStockists(
        wine.name,
        wine.producer ?? undefined,
        wine.vintage ?? undefined
    );
    if (!stockists.length) return { error: "No prices found across all sources" };

    const cheapest = stockists[0];
    const imageUrlUpdate = !wine.imageUrl && bottleImageUrl
        ? { imageUrl: bottleImageUrl }
        : {};

    const updateData = {
        ...(supportsStockists ? { stockists } : {}),
        ...imageUrlUpdate,
        danMurphysPrice: cheapest.price,
        danMurphysUrl: cheapest.url,
        danMurphysProductId: cheapest.url,
        danMurphysSource: cheapest.source,
        danMurphysPriceAt: new Date(),
    };

    try {
        await prisma.wine.updateMany({
            where: { id },
            data: updateData,
        });
    } catch (error) {
        if (!isMissingStockistsColumnError(error)) throw error;
        markWineStockistsColumnMissing();
        const { stockists: _stockists, ...fallbackData } = updateData;
        await prisma.wine.updateMany({
            where: { id },
            data: fallbackData,
        });
    }

    revalidatePath(`/cellar/${id}`);
    return { success: true, stockists, bottleImageUrl: imageUrlUpdate.imageUrl ?? null };
}

export async function confirmWineStockist(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
    const id = formData.get("id")?.toString();
    const source = formData.get("source")?.toString();
    const url = formData.get("url")?.toString();
    const fetchedAt = formData.get("fetchedAt")?.toString();
    const rawPrice = formData.get("price")?.toString();
    const price = rawPrice ? Number(rawPrice) : NaN;
    const productName = formData.get("productName")?.toString() || undefined;

    if (!id || !source || !url || !fetchedAt || !Number.isFinite(price)) {
        return { error: "Missing stockist fields" };
    }

    if (!supportsStockists) {
        await prisma.wine.updateMany({
            where: { id, householdId },
            data: {
                danMurphysPrice: price,
                danMurphysUrl: url,
                danMurphysProductId: url,
                danMurphysSource: source,
                danMurphysPriceAt: new Date(),
            },
        });
        revalidatePath("/cellar");
        revalidatePath(`/cellar/${id}`);
        return {
            success: true,
            stockists: [] as StockistResult[],
            selectedUrl: url,
            selectedProductName: productName ?? null,
        };
    }

    const wine = await prisma.wine.findFirst({
        where: { id, householdId },
        select: { stockists: true },
    });
    if (!wine) return { error: "Wine not found" };

    const current = parseStockists(wine.stockists);
    const selectedIndex = current.findIndex((entry) => stockistsMatch(entry, { source, url, fetchedAt, price }));
    if (selectedIndex < 0) return { error: "Stockist not found" };

    const selected = current[selectedIndex];
    const curated = [selected, ...current.filter((_, idx) => idx !== selectedIndex)];

    await prisma.wine.updateMany({
        where: { id, householdId },
        data: {
            stockists: curated,
            danMurphysPrice: selected.price,
            danMurphysUrl: selected.url,
            danMurphysProductId: selected.url,
            danMurphysSource: selected.source,
            danMurphysPriceAt: new Date(),
        },
    });

    revalidatePath("/cellar");
    revalidatePath(`/cellar/${id}`);
    return {
        success: true,
        stockists: curated,
        selectedUrl: selected.url,
        selectedProductName: selected.productName ?? null,
    };
}

export async function removeWineStockist(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const supportsStockists = await hasWineStockistsColumn(prisma.$queryRaw.bind(prisma));
    const id = formData.get("id")?.toString();
    const source = formData.get("source")?.toString();
    const url = formData.get("url")?.toString();
    const fetchedAt = formData.get("fetchedAt")?.toString();
    const rawPrice = formData.get("price")?.toString();
    const price = rawPrice ? Number(rawPrice) : NaN;

    if (!id || !source || !url || !fetchedAt || !Number.isFinite(price)) {
        return { error: "Missing stockist fields" };
    }
    if (!supportsStockists) {
        return { error: "Stockist curation is unavailable until stockists migration is applied." };
    }

    const wine = await prisma.wine.findFirst({
        where: { id, householdId },
        select: { stockists: true },
    });
    if (!wine) return { error: "Wine not found" };

    const current = parseStockists(wine.stockists);
    const filtered = current.filter((entry) => !stockistsMatch(entry, { source, url, fetchedAt, price }));
    if (filtered.length === current.length) {
        return { error: "Stockist not found" };
    }

    const selected = filtered[0];
    await prisma.wine.updateMany({
        where: { id, householdId },
        data: {
            stockists: filtered,
            danMurphysPrice: selected?.price ?? null,
            danMurphysUrl: selected?.url ?? null,
            danMurphysProductId: selected?.url ?? null,
            danMurphysSource: selected?.source ?? null,
            danMurphysPriceAt: selected ? new Date() : null,
        },
    });

    revalidatePath("/cellar");
    revalidatePath(`/cellar/${id}`);
    return { success: true, stockists: filtered, selectedUrl: selected?.url ?? null };
}
