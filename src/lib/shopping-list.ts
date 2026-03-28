import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import type { ShoppingListItem } from "@/lib/db-types";
import {
  buildShoppingLocationPreferenceKey,
  normalizeShoppingLine as normalizeShoppingLineValue,
} from "@/lib/shopping-location";

const SUPPRESS_PREFIX = "__suppress__:";

export const normalizeShoppingLine = normalizeShoppingLineValue;

export const buildSuppressedMarkerLine = (line: string) => `${SUPPRESS_PREFIX}${line}`;
export const isSuppressedMarkerLine = (line: string) => line.startsWith(SUPPRESS_PREFIX);
export const parseSuppressedMarkerLine = (line: string) =>
  isSuppressedMarkerLine(line) ? line.slice(SUPPRESS_PREFIX.length) : line;

const getShoppingWeekEnd = (weekStart: Date) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return weekEnd;
};

const dedupeShoppingItems = (items: ShoppingListItem[]) => {
  const deduped = new Map<string, ShoppingListItem>();

  items.forEach((item) => {
    const key = [item.manual ? "manual" : "auto", item.category, item.lineNormalized].join("::");
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};

export async function listShoppingItems(weekStart: Date, householdId?: string) {
  const resolvedHouseholdId = householdId ?? (await getCurrentHouseholdId());
  const weekEnd = getShoppingWeekEnd(weekStart);
  const items = await prisma.shoppingListItem.findMany({
    where: {
      householdId: resolvedHouseholdId,
      weekStart: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return dedupeShoppingItems(items);
}

export async function listShoppingLocationPreferences(householdId?: string) {
  const resolvedHouseholdId = householdId ?? (await getCurrentHouseholdId());
  const loadPreferences = async (hid: string) => {
    const items = await prisma.shoppingListItem.findMany({
      where: { householdId: hid },
      select: {
        line: true,
        lineNormalized: true,
        category: true,
        location: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const preferences = new Map<string, string>();
    for (const item of items) {
      if (isSuppressedMarkerLine(item.line)) {
        continue;
      }
      const key = buildShoppingLocationPreferenceKey(item.category, item.lineNormalized);
      if (!preferences.has(key)) {
        preferences.set(key, item.location);
      }
    }

    return Object.fromEntries(preferences);
  };

  if (process.env.NODE_ENV === "test") {
    return loadPreferences(resolvedHouseholdId);
  }

  const cachedQuery = unstable_cache(
    loadPreferences,
    ["shopping-location-preferences", resolvedHouseholdId],
    {
      revalidate: 300,
      tags: [`shopping-${resolvedHouseholdId}`],
    }
  );

  return cachedQuery(resolvedHouseholdId);
}
