import { updateTag } from "next/cache";
import { updateShoppingItemCategory } from "@/app/(dashboard)/shopping/actions";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { normalizeShoppingLine } from "@/lib/shopping-list";

const { txMock } = vi.hoisted(() => ({
  txMock: {
    shoppingListItem: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
  },
}));

describe("updateShoppingItemCategory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock)) as never);
  });

  it("moves an item to a new category while preserving state", async () => {
    await updateShoppingItemCategory({
      weekKey: "2026-02-23",
      line: "Dried oregano",
      oldCategory: "Canned & Jarred",
      newCategory: "Dry Goods",
      manual: false,
      checked: true,
      location: "Woolies",
    });

    expect(txMock.shoppingListItem.deleteMany).toHaveBeenCalledWith({
      where: {
        householdId: "household_1",
        weekStart: new Date("2026-02-23T00:00:00.000Z"),
        lineNormalized: normalizeShoppingLine("Dried oregano"),
        category: "Canned & Jarred",
        manual: false,
      },
    });

    expect(txMock.shoppingListItem.upsert).toHaveBeenCalledWith({
      where: {
        householdId_weekStart_lineNormalized_category_manual: {
          householdId: "household_1",
          weekStart: new Date("2026-02-23T00:00:00.000Z"),
          lineNormalized: normalizeShoppingLine("Dried oregano"),
          category: "Dry Goods",
          manual: false,
        },
      },
      update: {
        line: "Dried oregano",
        location: "Woolies",
        checked: true,
      },
      create: {
        householdId: "household_1",
        weekStart: new Date("2026-02-23T00:00:00.000Z"),
        line: "Dried oregano",
        lineNormalized: normalizeShoppingLine("Dried oregano"),
        category: "Dry Goods",
        location: "Woolies",
        manual: false,
        checked: true,
      },
    });
    expect(updateTag).toHaveBeenCalledWith("shopping-household_1");
  });

  it("skips work when the category does not change", async () => {
    await updateShoppingItemCategory({
      weekKey: "2026-02-23",
      line: "Dried oregano",
      oldCategory: "Dry Goods",
      newCategory: "Dry Goods",
      manual: false,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});
