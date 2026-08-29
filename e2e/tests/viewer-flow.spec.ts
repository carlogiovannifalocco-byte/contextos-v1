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

test("viewer sees read-only workspace after pending invite", async ({ page }) => {
  const stamp = Date.now();
  const ownerEmail = `owner-${stamp}@contextos.dev`;
  const viewerEmail = `viewer-${stamp}@contextos.dev`;
  const password = "DemoPassw0rd!";

  await page.goto("/register");
  await page.getByTestId("register-name").fill("Owner");
  await page.getByTestId("auth-email").fill(ownerEmail);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/app/);
  await page.getByTestId("project-name").fill("Viewer Lab");
  await page.getByTestId("create-project").click();
  await page.waitForURL(/\/p\//);

  await page.getByRole("link", { name: /^Privacy$/ }).click();
  await page.getByTestId("invite-email").fill(viewerEmail);
  await page.getByTestId("invite-role").selectOption("viewer");
  await page.getByTestId("invite-member").click();
  await expect(page.getByTestId("pending-invites")).toContainText(viewerEmail);

  await page.goto("/settings");
  await page.getByRole("button", { name: /Sign out|Logout/i }).click();
  await page.waitForURL(/\/login/);

  await page.goto("/register");
  await page.getByTestId("register-name").fill("Viewer");
  await page.getByTestId("auth-email").fill(viewerEmail);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/p\//, { timeout: 15_000 });

  await expect(page.getByTestId("viewer-banner")).toBeVisible();
  await expect(page.getByTestId("welcome-banner")).toContainText(/viewer/i);
  await expect(page.getByTestId("scan-folder")).toHaveCount(0);
  await page.getByRole("link", { name: /^Memory$/ }).click();
  await expect(page.getByTestId("add-memory")).toHaveCount(0);
  await page.screenshot({ path: path.join(docs, "viewer.png"), fullPage: true });
});
