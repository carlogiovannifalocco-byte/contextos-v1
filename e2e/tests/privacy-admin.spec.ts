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

test("demo privacy team and webhooks", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@contextos.dev");
  await page.getByLabel("Password").fill("DemoPassw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/p\//, { timeout: 15_000 });
  await page.getByRole("link", { name: /^Privacy$/ }).click();
  await expect(page.getByTestId("team-panel")).toBeVisible();
  await expect(page.getByTestId("team-list")).toContainText("demo@contextos.dev");
  await expect(page.getByTestId("invite-email")).toBeVisible();

  await page.getByTestId("webhook-url").fill("https://example.com/contextos-hook");
  await page.getByTestId("add-webhook").click();
  await expect(page.getByTestId("webhook-panel")).toContainText("https://example.com/contextos-hook", { timeout: 10_000 });
  await page.screenshot({ path: path.join(docs, "privacy.png"), fullPage: true });
});
