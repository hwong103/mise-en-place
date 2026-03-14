"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { fromDateKey } from "@/lib/date";

const MEAL_TYPE_ORDER = ["DINNER", "LUNCH", "BREAKFAST", "SNACK"] as const;

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
    return;
  }

  const existingForDay = await prisma.mealPlan.findMany({
    where: {
      householdId,
      date,
    },
    select: {
      id: true,
      recipeId: true,
      mealType: true,
    },
  });

  const existingMatch = existingForDay.find((entry) => entry.recipeId === recipeId);
  if (existingMatch) {
    return { status: "exists" as const, id: existingMatch.id, mealType: existingMatch.mealType };
  }

  const occupiedTypes = new Set(existingForDay.map((entry) => entry.mealType));
  const nextMealType = MEAL_TYPE_ORDER.find((mealType) => !occupiedTypes.has(mealType));

  if (!nextMealType) {
    return { status: "full" as const };
  }

  const created = await prisma.mealPlan.create({
    data: {
      householdId,
      recipeId,
      date,
      mealType: nextMealType,
      servings: 2,
    },
    select: {
      id: true,
      mealType: true,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
  return { status: "created" as const, id: created.id, mealType: created.mealType };
}

export async function removeMealPlanEntry(input: { planId: string }) {
  const planId = toOptionalString(input.planId);
  if (!planId) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  await prisma.mealPlan.deleteMany({
    where: {
      id: planId,
      householdId,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
}

export async function clearMealPlanDay(input: { date: string }) {
  const dateKey = toOptionalString(input.date);
  if (!dateKey) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const date = fromDateKey(dateKey);
  await prisma.mealPlan.deleteMany({
    where: {
      householdId,
      date,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
}

export async function markMealPlanCooked(input: { planId: string }) {
  const householdId = await getCurrentHouseholdId();

  const plan = await prisma.mealPlan.findFirst({
    where: { id: input.planId, householdId },
    select: { id: true, recipeId: true, cooked: true },
  });

  if (!plan || plan.cooked) return;

  await prisma.mealPlan.update({
    where: { id: plan.id },
    data: { cooked: true, cookedAt: new Date() },
  });

  const cookedPlans = await prisma.mealPlan.findMany({
    where: { householdId, recipeId: plan.recipeId, cooked: true },
    select: { id: true },
  });

  await prisma.recipe.update({
    where: { id: plan.recipeId },
    data: { cookCount: cookedPlans.length },
  });

  revalidatePath("/planner");
  revalidatePath(`/recipes/${plan.recipeId}`);
  revalidatePath("/recipes");
}

export async function unmarkMealPlanCooked(input: { planId: string }) {
  const householdId = await getCurrentHouseholdId();

  const plan = await prisma.mealPlan.findFirst({
    where: { id: input.planId, householdId },
    select: { id: true, recipeId: true, cooked: true },
  });

  if (!plan || !plan.cooked) return;

  await prisma.mealPlan.update({
    where: { id: plan.id },
    data: { cooked: false, cookedAt: null },
  });

  const cookedPlans = await prisma.mealPlan.findMany({
    where: { householdId, recipeId: plan.recipeId, cooked: true },
    select: { id: true },
  });

  await prisma.recipe.update({
    where: { id: plan.recipeId },
    data: { cookCount: cookedPlans.length },
  });

  revalidatePath("/planner");
  revalidatePath(`/recipes/${plan.recipeId}`);
  revalidatePath("/recipes");
}
