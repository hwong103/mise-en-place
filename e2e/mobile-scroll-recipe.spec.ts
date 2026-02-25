import { expect, test } from "@playwright/test";

test.describe("Mobile recipe scrolling", () => {
  test("recipe detail and focus mode are scrollable", async ({ page }) => {
    const title = `Scroll Smoke ${Date.now()}`;

    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Your Recipes" })).toBeVisible();

    await page.getByRole("button", { name: "Add Recipe" }).first().click();
    await page.getByRole("button", { name: "Manual Entry" }).click();

    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Ingredients (one per line)").fill(
      Array.from({ length: 40 }, (_, index) => `${index + 1}. ingredient`).join("\n")
    );
    await page.getByLabel("Instructions (one per line)").fill(
      Array.from({ length: 40 }, (_, index) => `${index + 1}. step instruction`).join("\n")
    );

    await page.getByRole("button", { name: "Add Recipe" }).last().click();
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();

    await page.getByRole("link", { name: title }).first().click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const pageScroll = await page.evaluate(() => {
      window.scrollTo(0, 0);
      const before = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      return {
        before,
        after: window.scrollY,
        maxScrollable: document.documentElement.scrollHeight - window.innerHeight,
      };
    });

    expect(pageScroll.maxScrollable).toBeGreaterThan(0);
    expect(pageScroll.after).toBeGreaterThan(pageScroll.before);

    await page.getByRole("button", { name: "Mise" }).first().click();
    await expect(page.getByText("Focus Mode")).toBeVisible();

    const scrollRegion = page.getByTestId("recipe-focus-scroll-region");
    await expect(scrollRegion).toBeVisible();

    const focusScroll = await scrollRegion.evaluate((el) => {
      const region = el as HTMLDivElement;
      const before = region.scrollTop;
      const canScroll = region.scrollHeight - region.clientHeight > 2;
      region.scrollTop = region.scrollHeight;
      return {
        canScroll,
        before,
        after: region.scrollTop,
      };
    });

    expect(focusScroll.canScroll).toBeTruthy();
    expect(focusScroll.after).toBeGreaterThan(focusScroll.before);
  });
});
