import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cos_lang", "en");
    localStorage.setItem("cos_theme", "light");
  });
});

test("demo quick login reaches workspace", async ({ page }) => {
  await page.goto("/login?demo=1");
  await page.waitForURL(/\/(app|p)\//, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: /^Brief$/ })).toBeVisible({ timeout: 15_000 });
});
