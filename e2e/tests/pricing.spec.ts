import { expect, test } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const docs = path.resolve(process.cwd(), "../docs/screenshots");
mkdirSync(docs, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cos_lang", "en");
    localStorage.setItem("cos_theme", "light");
  });
});

test("pricing page screenshot", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Free on your machine/i);
  await page.screenshot({ path: path.join(docs, "pricing.png"), fullPage: true });
});
