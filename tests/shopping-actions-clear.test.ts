import { revalidatePath } from "next/cache";
import { clearShoppingListWeek } from "@/app/(dashboard)/shopping/actions";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { buildSuppressedMarkerLine, normalizeShoppingLine } from "@/lib/shopping-list";

const { txMock } = vi.hoisted(() => ({
  txMock: {
    shoppingListItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
  },
}));

describe("clearShoppingListWeek", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)
    );
  });

  it("clears persisted rows and suppresses visible auto-generated items", async () => {
    await clearShoppingListWeek({
      weekKey: "2026-02-23",
      autoItems: [
        { line: "Carrot", category: "Produce", location: "Tong Li" },
        { line: "Carrot", category: "Produce", location: "Woolies" },
        { line: "Milk", category: "Dairy", location: "Woolies" },
      ],
    });

    expect(txMock.shoppingListItem.deleteMany).toHaveBeenCalledWith({
      where: {
        householdId: "household_1",
        weekStart: new Date("2026-02-23T00:00:00.000Z"),
      },
    });

    expect(txMock.shoppingListItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          householdId: "household_1",
          weekStart: new Date("2026-02-23T00:00:00.000Z"),
          line: buildSuppressedMarkerLine("Carrot"),
          lineNormalized: normalizeShoppingLine(buildSuppressedMarkerLine("Carrot")),
          category: "Produce",
          location: "Tong Li",
          manual: true,
          checked: true,
        },
        {
          householdId: "household_1",
          weekStart: new Date("2026-02-23T00:00:00.000Z"),
          line: buildSuppressedMarkerLine("Milk"),
          lineNormalized: normalizeShoppingLine(buildSuppressedMarkerLine("Milk")),
          category: "Dairy",
          location: "Woolies",
          manual: true,
          checked: true,
        },
      ],
      skipDuplicates: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/shopping");
  });

  it("only deletes rows when there are no auto items to suppress", async () => {
    await clearShoppingListWeek({
      weekKey: "2026-02-23",
      autoItems: [],
    });

    expect(txMock.shoppingListItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(txMock.shoppingListItem.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/shopping");
  });
});
