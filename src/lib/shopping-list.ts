import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";

export const normalizeShoppingLine = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function listShoppingItems(weekStart: Date) {
  const householdId = await getDefaultHouseholdId();
  return prisma.shoppingListItem.findMany({
    where: { householdId, weekStart },
    orderBy: { createdAt: "asc" },
  });
}
