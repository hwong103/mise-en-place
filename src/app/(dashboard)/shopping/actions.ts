"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { normalizeShoppingLine } from "@/lib/shopping-list";
import { fromDateKey } from "@/lib/date";

const toOptionalString = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function toggleShoppingItem(input: {
  weekKey: string;
  line: string;
  category: string;
  manual: boolean;
  checked: boolean;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const line = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";

  if (!weekKey || !line) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const lineNormalized = normalizeShoppingLine(line);
  const date = fromDateKey(weekKey);

  await prisma.shoppingListItem.upsert({
    where: {
      householdId_weekStart_lineNormalized_category_manual: {
        householdId,
        weekStart: date,
        lineNormalized,
        category,
        manual: input.manual,
      },
    },
    update: {
      line,
      checked: input.checked,
    },
    create: {
      householdId,
      weekStart: date,
      line,
      lineNormalized,
      category,
      manual: input.manual,
      checked: input.checked,
    },
  });

  revalidatePath("/shopping");
}

export async function addManualShoppingItem(input: {
  weekKey: string;
  line: string;
  category: string;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const line = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";

  if (!weekKey || !line) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const lineNormalized = normalizeShoppingLine(line);
  const date = fromDateKey(weekKey);

  await prisma.shoppingListItem.upsert({
    where: {
      householdId_weekStart_lineNormalized_category_manual: {
        householdId,
        weekStart: date,
        lineNormalized,
        category,
        manual: true,
      },
    },
    update: {
      line,
    },
    create: {
      householdId,
      weekStart: date,
      line,
      lineNormalized,
      category,
      manual: true,
      checked: false,
    },
  });

  revalidatePath("/shopping");
}

export async function removeManualShoppingItem(input: { id: string }) {
  const id = toOptionalString(input.id);
  if (!id) {
    return;
  }

  const householdId = await getCurrentHouseholdId();

  await prisma.shoppingListItem.deleteMany({
    where: { id, householdId, manual: true },
  });

  revalidatePath("/shopping");
}
