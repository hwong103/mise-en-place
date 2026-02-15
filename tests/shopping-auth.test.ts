import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { listShoppingItems } from "@/lib/shopping-list";

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
});
