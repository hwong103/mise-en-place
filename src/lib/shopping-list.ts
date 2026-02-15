import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";

const SUPPRESS_PREFIX = "__suppress__:";

export const normalizeShoppingLine = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
