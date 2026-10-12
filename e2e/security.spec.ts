import { expect, test } from "@playwright/test";

// A UUID that belongs to no notebook. For the app it looks the same as a
// notebook of another user: RLS hides both, the query finds no row.
const UNKNOWN_NOTEBOOK = "/notebooks/00000000-0000-4000-8000-000000000000";

test("an unknown or foreign notebook returns 404, not 403", async ({ page }) => {
  const response = await page.goto(UNKNOWN_NOTEBOOK);
  expect(response?.status()).toBe(404);
});

test.describe("without login", () => {
  // Empty session: no cookies from the setup project.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("notebooks redirect to the login page", async ({ page }) => {
    await page.goto(UNKNOWN_NOTEBOOK);
    await expect(page).toHaveURL("/login");
  });

  test("the chat API refuses the request", async ({ request }) => {
    const response = await request.post("/api/chat", { data: {} });
    expect(response.status()).toBe(401);
  });
});
