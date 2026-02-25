"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  buildSuppressedMarkerLine,
  normalizeShoppingLine,
} from "@/lib/shopping-list";
import { normalizeShoppingLocation } from "@/lib/shopping-location";
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
  location?: string;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const line = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";
  const location = normalizeShoppingLocation(toOptionalString(input.location));

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
      location,
    },
    create: {
      householdId,
      weekStart: date,
      line,
      lineNormalized,
      category,
      location,
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
  location?: string;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const rawLine = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";
  const location = normalizeShoppingLocation(toOptionalString(input.location));

  if (!weekKey || !rawLine) {
    return;
  }

  const line = rawLine.replace(/^__suppress__:/i, "").trim();
  if (!line) {
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
      checked: false,
      location,
    },
    create: {
      householdId,
      weekStart: date,
      line,
      lineNormalized,
      category,
      location,
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

export async function suppressShoppingItem(input: {
  weekKey: string;
  line: string;
  category: string;
  manual: boolean;
  location?: string;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const line = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";
  const location = normalizeShoppingLocation(toOptionalString(input.location));

  if (!weekKey || !line) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const date = fromDateKey(weekKey);

  if (input.manual) {
    const lineNormalized = normalizeShoppingLine(line);
    await prisma.shoppingListItem.deleteMany({
      where: {
        householdId,
        weekStart: date,
        lineNormalized,
        category,
        manual: true,
      },
    });

    revalidatePath("/shopping");
    return;
  }

  const markerLine = buildSuppressedMarkerLine(line);
  const markerNormalized = normalizeShoppingLine(markerLine);

  await prisma.shoppingListItem.upsert({
    where: {
      householdId_weekStart_lineNormalized_category_manual: {
        householdId,
        weekStart: date,
        lineNormalized: markerNormalized,
        category,
        manual: true,
      },
    },
    update: {
      line: markerLine,
      checked: true,
      location,
    },
    create: {
      householdId,
      weekStart: date,
      line: markerLine,
      lineNormalized: markerNormalized,
      category,
      location,
      manual: true,
      checked: true,
    },
  });

  revalidatePath("/shopping");
}

export async function updateShoppingItemLocation(input: {
  weekKey: string;
  line: string;
  category: string;
  manual: boolean;
  location: string;
}) {
  const weekKey = toOptionalString(input.weekKey);
  const line = toOptionalString(input.line);
  const category = toOptionalString(input.category) ?? "Other";
  const location = normalizeShoppingLocation(toOptionalString(input.location));

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
      location,
    },
    create: {
      householdId,
      weekStart: date,
      line,
      lineNormalized,
      category,
      location,
      manual: input.manual,
      checked: false,
    },
  });

  revalidatePath("/shopping");
}

export async function clearShoppingListWeek(input: {
  weekKey: string;
  autoItems?: Array<{
    line?: string | null;
    category?: string | null;
    location?: string | null;
  }>;
}) {
  const weekKey = toOptionalString(input.weekKey);
  if (!weekKey) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const date = fromDateKey(weekKey);

  const rawAutoItems = Array.isArray(input.autoItems) ? input.autoItems : [];
  const suppressedRows: Array<{
    householdId: string;
    weekStart: Date;
    line: string;
    lineNormalized: string;
    category: string;
    location: string;
    manual: boolean;
    checked: boolean;
  }> = [];
  const seenSuppressedKeys = new Set<string>();

  rawAutoItems.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const candidate = item as {
      line?: string | null;
      category?: string | null;
      location?: string | null;
    };
    const line = toOptionalString(candidate.line);
    const category = toOptionalString(candidate.category) ?? "Other";
    if (!line) {
      return;
    }

    const markerLine = buildSuppressedMarkerLine(line);
    const markerNormalized = normalizeShoppingLine(markerLine);
    const dedupeKey = `${markerNormalized}::${category.toLowerCase()}`;
    if (seenSuppressedKeys.has(dedupeKey)) {
      return;
    }

    seenSuppressedKeys.add(dedupeKey);
    suppressedRows.push({
      householdId,
      weekStart: date,
      line: markerLine,
      lineNormalized: markerNormalized,
      category,
      location: normalizeShoppingLocation(toOptionalString(candidate.location)),
      manual: true,
      checked: true,
    });
  });

  await prisma.$transaction(async (tx: {
    shoppingListItem: {
      deleteMany: (args: { where: { householdId: string; weekStart: Date } }) => Promise<unknown>;
      createMany: (args: { data: typeof suppressedRows; skipDuplicates: boolean }) => Promise<unknown>;
    };
  }) => {
    await tx.shoppingListItem.deleteMany({
      where: {
        householdId,
        weekStart: date,
      },
    });

    if (suppressedRows.length > 0) {
      await tx.shoppingListItem.createMany({
        data: suppressedRows,
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/shopping");
}
