import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";

export const normalizeShoppingLine = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function listShoppingItems(weekStart: Date, householdId?: string) {
  const resolvedHouseholdId = householdId ?? (await getDefaultHouseholdId());
  return prisma.shoppingListItem.findMany({
    where: { householdId: resolvedHouseholdId, weekStart },
    orderBy: { createdAt: "asc" },
  });
}
