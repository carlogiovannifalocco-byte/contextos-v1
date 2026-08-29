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

test("demo workspace brief screenshot", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@contextos.dev");
  await page.getByLabel("Password").fill("DemoPassw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/p\//, { timeout: 15_000 });
  await page.getByRole("link", { name: /^Brief$/ }).click();
  await expect(page.getByTestId("brief-markdown")).toContainText("ContextOS brief");
  await expect(page.getByTestId("brief-meter")).toBeVisible();
  await page.screenshot({ path: path.join(docs, "brief.png"), fullPage: true });
});
