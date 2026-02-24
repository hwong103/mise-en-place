"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAuthUser, getOrCreateAppUserId } from "@/lib/auth";
import { getCurrentAccessContext } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  claimHousehold,
  rotateHouseholdShareLink as rotateHouseholdShareLinkForHousehold,
} from "@/lib/household-access";

export async function rotateHouseholdShareLink() {
  const accessContext = await getCurrentAccessContext("throw");
  if (!accessContext.canManageLink) {
    throw new Error("FORBIDDEN");
  }

  const rotated = await rotateHouseholdShareLinkForHousehold(accessContext.householdId);
  console.info("[household-share] rotated share link", {
    householdId: rotated.householdId,
    shareTokenVersion: rotated.shareTokenVersion,
  });

  revalidatePath("/settings");
  redirect("/settings?rotated=1");
}

export async function claimCurrentHousehold() {
  const accessContext = await getCurrentAccessContext("throw");
  if (!accessContext.canManageLink) {
    throw new Error("FORBIDDEN");
  }

  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    redirect("/login?next=/claim-household");
  }

  const appUserId = await getOrCreateAppUserId(authUser);

  try {
    await claimHousehold(accessContext.householdId, appUserId);
  } catch (error) {
    if (error instanceof Error && error.message === "HOUSEHOLD_ALREADY_CLAIMED") {
      redirect("/settings?claim=conflict");
    }
    throw error;
  }

  revalidatePath("/settings");
  redirect("/settings?claimed=1");
}

export async function updateHouseholdName(formData: FormData) {
  const accessContext = await getCurrentAccessContext("throw");
  if (!accessContext.canManageLink) {
    throw new Error("FORBIDDEN");
  }

  const nameValue = formData.get("name");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name || name.length > 80) {
    redirect("/settings?rename=invalid");
  }

  await prisma.household.update({
    where: { id: accessContext.householdId },
    data: { name },
  });

  revalidatePath("/settings");
  redirect("/settings?renamed=1");
}
