import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { GET } from "@/app/api/recipes/[id]/route";

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: {
      findFirst: vi.fn(),
    },
  },
}));

describe("GET /api/recipes/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentHouseholdId).mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(new NextRequest("http://localhost/api/recipes/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for recipe outside current household", async () => {
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.recipe.findFirst).mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/recipes/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(prisma.recipe.findFirst).toHaveBeenCalledWith({
      where: { id: "abc", householdId: "household_1" },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        createdAt: true,
      },
    });
    expect(response.status).toBe(404);
  });
});
