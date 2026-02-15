import prisma from "@/lib/prisma";
import { getOrCreateAppUserId, requireCurrentAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const DEFAULT_HOUSEHOLD_NAME = "My Household";

export const ensureDefaultHouseholdForUser = async (userId: string) => {
  const existingMembership = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true },
    orderBy: { joinedAt: "asc" },
  });

  if (existingMembership) {
    return existingMembership.householdId;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: { name },
      select: { id: true },
    });

    await tx.householdMember.create({
      data: {
        userId,
        householdId: household.id,
        role: "OWNER",
      },
    });

    return household;
  });

  return created.id;
};

type UnauthenticatedBehavior = "redirect" | "throw";

export const getCurrentHouseholdId = async (
  unauthenticatedBehavior: UnauthenticatedBehavior = "redirect"
) => {
  let authUser;
  try {
    authUser = await requireCurrentAuthUser();
  } catch {
    if (unauthenticatedBehavior === "redirect") {
      redirect("/login");
    }
    throw new Error("UNAUTHORIZED");
  }

  const appUserId = await getOrCreateAppUserId(authUser);
  return ensureDefaultHouseholdForUser(appUserId);
};

// Kept only for local/dev bootstrap scripts; do not use this in request authorization paths.
export const getBootstrapHouseholdId = async () => {
  const existing = await prisma.household.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    return existing.id;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.household.create({ data: { name } });
  return created.id;
};
