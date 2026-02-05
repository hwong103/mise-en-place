"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";
import { fromDateKey } from "@/lib/date";

const toOptionalString = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function upsertMealPlan(formData: FormData) {
  const dateKey = toOptionalString(formData.get("date"));
  const mealType = toOptionalString(formData.get("mealType"));
  const recipeId = toOptionalString(formData.get("recipeId"));

  const allowedMealTypes = new Set(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

  if (!dateKey || !mealType || !allowedMealTypes.has(mealType)) {
    return;
  }

  const normalizedMealType = mealType as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  const householdId = await getDefaultHouseholdId();
  const date = fromDateKey(dateKey);

  if (!recipeId) {
    await prisma.mealPlan.deleteMany({
      where: {
        householdId,
        date,
        mealType: normalizedMealType,
      },
    });

    revalidatePath("/planner");
    revalidatePath("/shopping");
    return;
  }

  await prisma.mealPlan.upsert({
    where: {
      householdId_date_mealType: {
        householdId,
        date,
        mealType: normalizedMealType,
      },
    },
    update: {
      recipeId,
    },
    create: {
      householdId,
      recipeId,
      date,
      mealType: normalizedMealType,
      servings: 2,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
}
