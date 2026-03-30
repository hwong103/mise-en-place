import type { ShoppingListItem } from "@/lib/db-types";
import {
  buildPendingManualStorageKey,
  parsePendingManualItems,
  reconcilePendingManualItems,
  serializePendingManualItems,
  type PendingManualItem,
} from "@/lib/shopping-list-pending";

const makePersistedItem = (overrides: Partial<ShoppingListItem>): ShoppingListItem => ({
  id: "item_1",
  householdId: "household_1",
  weekStart: new Date("2026-03-30T00:00:00.000Z"),
  line: "Milk",
  lineNormalized: "milk",
  category: "Dairy",
  manual: true,
  checked: false,
  createdAt: new Date("2026-03-30T00:00:00.000Z"),
  updatedAt: new Date("2026-03-30T00:00:00.000Z"),
  location: "Woolies",
  ...overrides,
});

describe("shopping-list pending manual items", () => {
  it("keeps pending items until the matching persisted manual item is present", () => {
    const pendingItems: PendingManualItem[] = [
      {
        tempId: "temp_1",
        line: "Milk",
        category: "Dairy",
        location: "Woolies",
        status: "syncing",
      },
    ];

    expect(reconcilePendingManualItems(pendingItems, [])).toEqual(pendingItems);
    expect(reconcilePendingManualItems(pendingItems, [makePersistedItem({})])).toEqual([]);
  });

  it("keeps unrelated pending items when rapid saves settle out of order", () => {
    const pendingItems: PendingManualItem[] = [
      {
        tempId: "temp_1",
        line: "Milk",
        category: "Dairy",
        location: "Woolies",
        status: "syncing",
      },
      {
        tempId: "temp_2",
        line: "Parsley",
        category: "Produce",
        location: "Tong Li",
        status: "saving",
      },
    ];

    expect(
      reconcilePendingManualItems(pendingItems, [
        makePersistedItem({}),
      ])
    ).toEqual([
      {
        tempId: "temp_2",
        line: "Parsley",
        category: "Produce",
        location: "Tong Li",
        status: "saving",
      },
    ]);
  });

  it("round-trips persisted draft items safely", () => {
    const pendingItems: PendingManualItem[] = [
      {
        tempId: "temp_1",
        line: "  Flat-leaf parsley  ",
        category: "Produce",
        location: "  Tong   Li ",
        status: "saving",
      },
    ];

    expect(parsePendingManualItems(serializePendingManualItems(pendingItems))).toEqual([
      {
        tempId: "temp_1",
        line: "Flat-leaf parsley",
        category: "Produce",
        location: "Tong Li",
        status: "saving",
      },
    ]);
  });

  it("ignores malformed storage entries instead of crashing", () => {
    expect(parsePendingManualItems("not json")).toEqual([]);
    expect(
      parsePendingManualItems(
        JSON.stringify([
          null,
          { tempId: "temp_1", line: "", category: "Produce", location: "Woolies" },
          { tempId: "temp_2", line: "Milk", category: "Dairy", location: "Woolies", status: "oops" },
        ])
      )
    ).toEqual([
      {
        tempId: "temp_2",
        line: "Milk",
        category: "Dairy",
        location: "Woolies",
        status: "saving",
      },
    ]);
  });

  it("uses a week-scoped storage key", () => {
    expect(buildPendingManualStorageKey("2026-03-30")).toBe(
      "shopping-pending-manual-items:2026-03-30"
    );
  });
});
