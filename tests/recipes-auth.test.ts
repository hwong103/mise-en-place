import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { listRecipes } from "@/lib/recipes";

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: {
      findMany: vi.fn(),
    },
  },
}));

describe("listRecipes tenant scoping", () => {
  it("scopes to authenticated household by default", async () => {
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([]);

    await listRecipes();

    expect(getCurrentHouseholdId).toHaveBeenCalled();
    expect(prisma.recipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: "household_1" },
      })
    );
  });
});
