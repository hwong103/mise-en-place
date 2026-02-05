import prisma from "@/lib/prisma";

const DEFAULT_HOUSEHOLD_NAME = "My Household";

export async function getDefaultHouseholdId() {
  const existing = await prisma.household.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing.id;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.household.create({
    data: { name },
  });

  return created.id;
}
