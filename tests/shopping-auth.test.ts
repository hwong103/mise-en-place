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
      where: {
        householdId: "household_1",
        weekStart: {
          gte: weekStart,
          lte: new Date("2026-01-11T00:00:00.000Z"),
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("dedupes legacy day-scoped rows inside the same shopping week", async () => {
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.shoppingListItem.findMany).mockResolvedValue([
      {
        id: "2",
        householdId: "household_1",
        weekStart: new Date("2026-03-27T00:00:00.000Z"),
        line: "Rice",
        lineNormalized: "rice",
        category: "Other",
        manual: true,
        checked: false,
        createdAt: new Date("2026-03-27T22:46:24.955Z"),
        updatedAt: new Date("2026-03-27T22:46:24.955Z"),
        location: "Tong Li",
      },
      {
        id: "1",
        householdId: "household_1",
        weekStart: new Date("2026-03-25T00:00:00.000Z"),
        line: "Rice",
        lineNormalized: "rice",
        category: "Other",
        manual: true,
        checked: false,
        createdAt: new Date("2026-03-25T06:19:50.825Z"),
        updatedAt: new Date("2026-03-25T06:19:50.825Z"),
        location: "Woolies",
      },
    ] as never);

    const items = await listShoppingItems(new Date("2026-03-23T00:00:00.000Z"));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "2",
      line: "Rice",
      location: "Tong Li",
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
