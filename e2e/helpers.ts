import { expect, type Page } from "@playwright/test";

// A title that is unique per test run, so the "…" menu of the notebook has a
// unique name ("Aktionen für <title>").
export function uniqueTitle(label: string): string {
  return `E2E ${label} ${new Date().toISOString()}`;
}

// Creates a notebook through the dialog and returns its id.
export async function createNotebook(page: Page, title: string): Promise<string> {
  await page.goto("/notebooks");
  // The overview also shows the form on the page, so we stay inside the dialog.
  await page.getByRole("button", { name: "Neues Notebook" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Neues Notebook" });
  await dialog.getByLabel("Titel des neuen Notebooks").fill(title);
  await dialog.getByRole("button", { name: "Notebook anlegen" }).click();

  // The action redirects to /notebooks/<uuid>.
  await page.waitForURL(/\/notebooks\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return page.url().split("/").pop()!;
}

// Deletes a source through its trash button and waits until it is gone.
export async function deleteSource(page: Page, sourceTitle: string): Promise<void> {
  const sources = page.getByRole("region", { name: "Quellen" });
  await sources.getByRole("button", { name: `${sourceTitle} löschen` }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Löschen" }).click();
  // Wait for the dialog first. It closes only after the server deleted the
  // source. While it is open, the page behind it is aria-hidden, so a role
  // locator finds no "Quellen" region, and "row is hidden" would pass at once.
  await expect(confirm).toBeHidden();
  await expect(sources.getByText(sourceTitle, { exact: true })).toBeHidden();
}

// Deletes the notebook through its "…" menu. Works on the notebook page.
export async function deleteNotebook(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: `Aktionen für ${title}` }).click();
  await page.getByRole("menuitem", { name: "Löschen" }).click();
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await page.waitForURL("/notebooks");
}
