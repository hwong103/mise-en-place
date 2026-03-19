import { redirect } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/household";
import { importRecipeFromUrl } from "@/app/(dashboard)/recipes/actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`Redirect to ${url}`) as Error & { digest?: string };
    error.digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("importRecipeFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to server_error when an unhandled exception escapes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getCurrentHouseholdId).mockRejectedValue(new Error("database offline"));

    const formData = new FormData();
    formData.set("sourceUrl", "https://example.com/recipe");

    await expect(importRecipeFromUrl(formData)).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;/recipes?importError=server_error",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[importRecipeFromUrl] unhandled error:",
      expect.objectContaining({ message: "database offline" })
    );
    expect(redirect).toHaveBeenLastCalledWith("/recipes?importError=server_error");

    consoleError.mockRestore();
  });

  it("rethrows Next redirect errors instead of converting them to server_error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = new FormData();

    await expect(importRecipeFromUrl(formData)).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;/recipes?importError=invalid_url",
    });

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/recipes?importError=invalid_url");
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
