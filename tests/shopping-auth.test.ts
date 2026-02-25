import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  listShoppingItems,
  listShoppingLocationPreferences,
} from "@/lib/shopping-list";

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    shoppingListItem: {
      findMany: vi.fn(),
    },
  },
}));

describe("listShoppingItems tenant scoping", () => {
  it("scopes to authenticated household when none passed", async () => {
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.shoppingListItem.findMany).mockResolvedValue([]);

    const weekStart = new Date("2026-01-05T00:00:00.000Z");
    await listShoppingItems(weekStart);

    expect(prisma.shoppingListItem.findMany).toHaveBeenCalledWith({
      where: { householdId: "household_1", weekStart },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns latest non-suppressed location preferences for each item key", async () => {
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.shoppingListItem.findMany).mockResolvedValue([
      {
        line: "Mushroom",
        lineNormalized: "mushroom",
        category: "Produce",
        location: "Tong Li",
        updatedAt: new Date("2026-02-12T00:00:00.000Z"),
      },
      {
        line: "Mushroom",
        lineNormalized: "mushroom",
        category: "Produce",
        location: "Woolies",
        updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      },
      {
        line: "__suppress__:Carrot",
        lineNormalized: "__suppress__ carrot",
        category: "Produce",
        location: "Butcher",
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ] as never);

    const preferences = await listShoppingLocationPreferences();

    expect(prisma.shoppingListItem.findMany).toHaveBeenCalledWith({
      where: { householdId: "household_1" },
      select: {
        line: true,
        lineNormalized: true,
        category: true,
        location: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(preferences).toEqual({
      "produce-mushroom": "Tong Li",
    });
  });
});
