import { expect, test as setup } from "@playwright/test";

// Saved session cookies, same path as storageState in playwright.config.ts.
// Ignored by git: they could log in as the test user.
const AUTH_FILE = "playwright/.auth/user.json";

setup("log in as the test user", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set (see .env.example).");
  }

  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();

  // The Server Action sets the cookies and then redirects. When we are on
  // /notebooks, the cookies are there.
  await page.waitForURL("/notebooks");
  await expect(page.getByRole("button", { name: "Neues Notebook" }).first()).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
