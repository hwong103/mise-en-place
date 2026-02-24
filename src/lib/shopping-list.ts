import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
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

export async function listShoppingItems(weekStart: Date, householdId?: string) {
  const resolvedHouseholdId = householdId ?? (await getCurrentHouseholdId());
  return prisma.shoppingListItem.findMany({
    where: { householdId: resolvedHouseholdId, weekStart },
    orderBy: { createdAt: "asc" },
  });
}

export async function listShoppingLocationPreferences(householdId?: string) {
  const resolvedHouseholdId = householdId ?? (await getCurrentHouseholdId());
  const items = await prisma.shoppingListItem.findMany({
    where: { householdId: resolvedHouseholdId },
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
}
