"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { fromDateKey } from "@/lib/date";

const DAILY_MEAL_TYPE = "DINNER" as const;

const toOptionalString = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function upsertMealPlan(formData: FormData) {
  const dateKey = toOptionalString(formData.get("date"));
  const recipeId = toOptionalString(formData.get("recipeId"));

  if (!dateKey) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const date = fromDateKey(dateKey);

  if (!recipeId) {
    await prisma.mealPlan.deleteMany({
      where: {
        householdId,
        date,
      },
    });

    revalidatePath("/planner");
    revalidatePath("/shopping");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealPlan.deleteMany({
      where: {
        householdId,
        date,
      },
    });

    await tx.mealPlan.create({
      data: {
        householdId,
        recipeId,
        date,
        mealType: DAILY_MEAL_TYPE,
        servings: 2,
      },
    });
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
}
