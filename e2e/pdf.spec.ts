import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "../src/test/make-pdf";
import { embeddedChunkCount, sourcesOf, storageFiles } from "./admin";
import { createNotebook, deleteNotebook, deleteSource, uniqueTitle } from "./helpers";

// The PDF path: signed upload URL → upload straight to Supabase Storage →
// text → chunks → embeddings. Plus the two "must" rules around it:
// a scanned PDF is a clear error, and deleting a source removes the file,
// the chunks and the embeddings.

let notebook: { id: string; title: string } | null = null;

test.afterEach(async ({ page }) => {
  if (!notebook) return;
  await page.goto(`/notebooks/${notebook.id}`);
  await deleteNotebook(page, notebook.title);
  notebook = null;
});

// Chooses a PDF through the "Dateien auswählen" button, like a user.
// The file is built in memory, so no test file is needed in the repo.
async function uploadPdf(page: Page, name: string, pages: (string | null)[]) {
  await page.getByRole("button", { name: "Quelle hinzufügen" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Quelle hinzufügen" });
  const fileChooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Dateien auswählen" }).click();
  await (await fileChooser).setFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(pages)),
  });
}

test("a PDF becomes searchable, and deleting it removes file, chunks and embeddings", async ({
  page,
}) => {
  const title = uniqueTitle("PDF");
  const notebookId = await createNotebook(page, title);
  notebook = { id: notebookId, title };

  await uploadPdf(page, "Lesesaal.pdf", [
    "Der Lesesaal hat 120 Plätze.\nJeder Platz hat eine Lampe und eine Steckdose.",
    "Im Lesesaal gilt Ruhe.\nTelefonieren ist nur im Foyer erlaubt.",
  ]);
  // After a successful upload the dialog closes by itself.
  await expect(page.getByRole("dialog", { name: "Quelle hinzufügen" })).toBeHidden();

  // The title comes from the file name. Ready: the row shows pages and chunks.
  const sources = page.getByRole("region", { name: "Quellen" });
  await expect(sources.getByText("Lesesaal", { exact: true })).toBeVisible();
  await expect(sources.getByText(/^PDF · 2 S\. · \d+ Abschnitte?$/)).toBeVisible({
    timeout: 60_000,
  });

  // Behind the UI: one source, its file in storage, chunks with embeddings.
  const [source] = await sourcesOf(notebookId);
  expect(source.status).toBe("ready");
  expect(await storageFiles(notebookId)).toContain(source.storage_path);
  expect(await embeddedChunkCount(source.id)).toBeGreaterThan(0);

  // Delete the source in the UI.
  await deleteSource(page, "Lesesaal");

  // All gone: the row, the file, and (through "on delete cascade") the chunks.
  expect(await sourcesOf(notebookId)).toHaveLength(0);
  expect(await storageFiles(notebookId)).toHaveLength(0);
  expect(await embeddedChunkCount(source.id)).toBe(0);
});

test("a scanned PDF without text shows a clear error", async ({ page }) => {
  const title = uniqueTitle("Scan");
  const notebookId = await createNotebook(page, title);
  notebook = { id: notebookId, title };

  // Two pages that are only an image (grey rectangle), like a scan.
  await uploadPdf(page, "Scan.pdf", [null, null]);

  const sources = page.getByRole("region", { name: "Quellen" });
  await expect(sources.getByText(/keinen lesbaren Text.*gescannt/)).toBeVisible({
    timeout: 60_000,
  });
  // The way out: paste the text by hand.
  await expect(sources.getByRole("button", { name: "Als Text einfügen" })).toBeVisible();

  // No chunks were saved for the failed source.
  const [source] = await sourcesOf(notebookId);
  expect(source.status).toBe("error");
  expect(await embeddedChunkCount(source.id)).toBe(0);

  // Deleting the notebook also removes the file of the failed source.
  await deleteNotebook(page, title);
  notebook = null;
  expect(await storageFiles(notebookId)).toHaveLength(0);
});
