"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { extractWineFromImageViaGroq, extractWineFromUrlViaGroq, fetchDanMurphysPrice } from "@/lib/wine";
import type { WineType } from "@prisma/client";

// ─── Create wine from photo ──────────────────────────────────────────────────

export async function createWineFromPhoto(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const base64Image = formData.get("base64Image")?.toString();
    const mimeType = formData.get("mimeType")?.toString() ?? "image/jpeg";

    if (!base64Image) return { error: "No image provided" };

    const vision = await extractWineFromImageViaGroq(base64Image, mimeType);
    if (!vision) return { error: "Could not read label. Try a clearer photo." };

    // Try to fetch Dan Murphy's price in the same request
    const dmPrice = await fetchDanMurphysPrice(vision.name, vision.producer);

    const wine = await prisma.wine.create({
        data: {
            householdId,
            name: vision.name,
            producer: vision.producer ?? null,
            vintage: vision.vintage ?? null,
            grapes: vision.grapes ?? [],
            region: vision.region ?? null,
            country: vision.country ?? null,
            type: (vision.type as WineType) ?? "RED",
            danMurphysProductId: dmPrice?.productId ?? null,
            danMurphysUrl: dmPrice?.url ?? null,
            danMurphysPrice: dmPrice?.price ?? null,
            danMurphysPriceAt: dmPrice ? new Date() : null,
        },
    });

    revalidatePath("/cellar");
    redirect(`/cellar/${wine.id}/edit?mode=photo`);
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
    });

    revalidatePath("/cellar");
    redirect(`/cellar/${wine.id}/edit?mode=manual`);
}

// ─── Create wine from URL ─────────────────────────────────────────────────────

export async function createWineFromUrl(formData: FormData) {
    const householdId = await getCurrentHouseholdId();
    const url = formData.get("url")?.toString().trim();
    if (!url) return { error: "No URL provided" };

    const vision = await extractWineFromUrlViaGroq(url);
    if (!vision) return { error: "Could not extract wine details from that URL." };

    const dmPrice = await fetchDanMurphysPrice(vision.name, vision.producer);

    const wine = await prisma.wine.create({
        data: {
            householdId,
            name: vision.name,
            producer: vision.producer ?? null,
            vintage: vision.vintage ?? null,
            grapes: vision.grapes ?? [],
            region: vision.region ?? null,
            country: vision.country ?? null,
            type: (vision.type as WineType) ?? "RED",
            danMurphysProductId: dmPrice?.productId ?? null,
            danMurphysUrl: dmPrice?.url ?? null,
            danMurphysPrice: dmPrice?.price ?? null,
            danMurphysPriceAt: dmPrice ? new Date() : null,
        },
    });

    revalidatePath("/cellar");
    redirect(`/cellar/${wine.id}/edit?mode=url`);
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
    const id = formData.get("id")?.toString();
    if (!id) return;

    const wine = await prisma.wine.findFirst({ where: { id, householdId } });
    if (!wine) return;

    const dmPrice = await fetchDanMurphysPrice(wine.name, wine.producer ?? undefined);
    if (!dmPrice) return;

    await prisma.wine.update({
        where: { id },
        data: {
            danMurphysPrice: dmPrice.price,
            danMurphysUrl: dmPrice.url,
            danMurphysProductId: dmPrice.productId,
            danMurphysPriceAt: new Date(),
        },
    });

    revalidatePath(`/cellar/${id}`);
}
