import { updateTag } from "next/cache";
import { addManualShoppingItem } from "@/app/(dashboard)/shopping/actions";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { normalizeShoppingLine } from "@/lib/shopping-list";

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    shoppingListItem: {
      upsert: vi.fn(),
    },
  },
}));

describe("addManualShoppingItem", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
  });

  it("derives category from the item line instead of trusting client input", async () => {
    await addManualShoppingItem({
      weekKey: "2026-02-23",
      line: "canned tomatoes",
      location: "Woolies",
    });

    expect(prisma.shoppingListItem.upsert).toHaveBeenCalledWith({
      where: {
        householdId_weekStart_lineNormalized_category_manual: {
          householdId: "household_1",
          weekStart: new Date("2026-02-23T00:00:00.000Z"),
          lineNormalized: normalizeShoppingLine("canned tomatoes"),
          category: "Canned & Jarred",
          manual: true,
        },
      },
      update: {
        line: "canned tomatoes",
        checked: false,
        location: "Woolies",
      },
      create: {
        householdId: "household_1",
        weekStart: new Date("2026-02-23T00:00:00.000Z"),
        line: "canned tomatoes",
        lineNormalized: normalizeShoppingLine("canned tomatoes"),
        category: "Canned & Jarred",
        location: "Woolies",
        manual: true,
        checked: false,
      },
    });
    expect(updateTag).toHaveBeenCalledWith("shopping-household_1");
  });
});
