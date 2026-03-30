import type { ShoppingListItem } from "@/lib/db-types";
import {
  normalizeShoppingCategory,
  normalizeShoppingLine,
  normalizeShoppingLocation,
} from "@/lib/shopping-location";

export type PendingManualItemStatus = "saving" | "syncing" | "error";

export type PendingManualItem = {
  tempId: string;
  line: string;
  category: string;
  location: string;
  status: PendingManualItemStatus;
};

const STORAGE_PREFIX = "shopping-pending-manual-items";

const isPendingManualItemStatus = (value: unknown): value is PendingManualItemStatus =>
  value === "saving" || value === "syncing" || value === "error";

const buildPendingManualFingerprint = (category: string, line: string) =>
  `${normalizeShoppingCategory(category)}::${normalizeShoppingLine(line)}`;

export const buildPendingManualStorageKey = (weekKey: string) => `${STORAGE_PREFIX}:${weekKey}`;

export function reconcilePendingManualItems(
  pendingItems: PendingManualItem[],
  persistedItems: ShoppingListItem[]
) {
  const persistedManualItems = new Set(
    persistedItems
      .filter((item) => item.manual)
      .map((item) => buildPendingManualFingerprint(item.category, item.line))
  );

  return pendingItems.filter(
    (item) => !persistedManualItems.has(buildPendingManualFingerprint(item.category, item.line))
  );
}

export function serializePendingManualItems(items: PendingManualItem[]) {
  return JSON.stringify(items);
}

export function parsePendingManualItems(rawValue: string | null | undefined) {
  if (!rawValue) {
    return [] as PendingManualItem[];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [] as PendingManualItem[];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const candidate = entry as Record<string, unknown>;
      const tempId = typeof candidate.tempId === "string" ? candidate.tempId.trim() : "";
      const line = typeof candidate.line === "string" ? candidate.line.trim() : "";
      const category = typeof candidate.category === "string" ? candidate.category.trim() : "";
      const location = normalizeShoppingLocation(
        typeof candidate.location === "string" ? candidate.location : undefined
      );
      const status = isPendingManualItemStatus(candidate.status) ? candidate.status : "saving";

      if (!tempId || !line || !category) {
        return [];
      }

      return [
        {
          tempId,
          line,
          category,
          location,
          status,
        } satisfies PendingManualItem,
      ];
    });
  } catch {
    return [] as PendingManualItem[];
  }
}
