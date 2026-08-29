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

test("landing screenshot", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("quickstart")).toBeVisible();
  const compare = page.getByTestId("token-compare");
  await compare.scrollIntoViewIfNeeded();
  await expect(compare.getByRole("heading", { level: 2 })).toBeVisible();
  await compare.locator('input[type="range"]').first().fill("120");
  await page.screenshot({ path: path.join(docs, "landing.png"), fullPage: true });
});

test("public login and agents screenshots", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: path.join(docs, "login.png"), fullPage: true });
  await page.goto("/agents");
  await expect(page.getByRole("heading", { name: /Agent Hub/i })).toBeVisible();
  await page.screenshot({ path: path.join(docs, "agents.png"), fullPage: true });
});

test("register, scan folder, write memory, merge conflict", async ({ page }) => {
  const email = `e2e-${Date.now()}@contextos.dev`;
  await page.goto("/register");
  await page.getByTestId("register-name").fill("E2E");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill("DemoPassw0rd!");
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/app/);
  await page.getByTestId("project-name").fill("Harbor");
  await page.getByTestId("create-project").click();
  await page.waitForURL(/\/p\//);
  await expect(page.getByTestId("scan-folder")).toBeVisible();
  await page.screenshot({ path: path.join(docs, "workspace.png"), fullPage: true });

  await page.getByTestId("scan-folder").click();
  await expect(page.getByTestId("activate-scan")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("scan-proposals")).toContainText("@atlas/cli");
  await page.getByTestId("activate-scan").click();
  await page.getByRole("link", { name: /^Memory$/ }).click();
  await expect(page.getByRole("heading", { name: /Package name is @atlas\/cli/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: path.join(docs, "memory.png"), fullPage: true });

  await page.getByTestId("memory-title").fill("Auth uses sessions");
  await page.getByTestId("memory-body").fill("HttpOnly cookies.");
  await page.getByTestId("add-memory").click();
  await expect(page.getByRole("heading", { name: "Auth uses sessions" })).toBeVisible();
  await page.getByTestId("memory-title").fill("Auth uses sessions");
  await page.getByTestId("memory-body").fill("JWT in localStorage.");
  await page.getByTestId("add-memory").click();
  await page.getByRole("link", { name: /^Activity$/ }).click();
  await expect(page.getByTestId("conflict-panel")).toBeVisible();
  await page.getByTestId("merge-title").fill("Auth uses sessions");
  await page.getByTestId("merge-body").fill("HttpOnly session cookies win.");
  await page.getByTestId("merge-conflict").click();
  await expect(page.getByTestId("conflict-panel")).toHaveCount(0, { timeout: 15_000 });
});
