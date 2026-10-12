import { expect, test } from "@playwright/test";
import { NO_ANSWER } from "../src/lib/chat/citations";
import { createNotebook, deleteNotebook, deleteSource, uniqueTitle } from "./helpers";

// The core path of Faden in one test: notebook → text source → question
// with a citation → citation view → refusal → delete source and notebook.
//
// It uses the real APIs (Supabase, OpenAI). Mocks would skip exactly what we
// want to test: ingestion, hybrid search, streaming and the citation check.
// One run costs about 0.001 $ (one embedding of the text, two questions).

// A made-up source: the model cannot know these facts from its training.
const SOURCE_TITLE = "Stadtteilbibliothek Lindenau";
const SOURCE_TEXT = [
  "Die Stadtteilbibliothek Lindenau öffnet dienstags bis freitags von 10 bis 18 Uhr.",
  "Am Samstag ist sie von 10 bis 14 Uhr geöffnet, montags bleibt sie geschlossen.",
  "Bücher kann man vier Wochen lang ausleihen. Eine Verlängerung ist zweimal möglich und kostet nichts.",
  "Die Bibliothek hat 23.000 Medien, darunter 4.200 Hörbücher.",
].join("\n\n");

// Set as soon as the notebook exists. afterEach deletes it if the test
// stopped before it could delete it itself.
let notebook: { id: string; title: string } | null = null;

test.afterEach(async ({ page }) => {
  if (!notebook) return;
  await page.goto(`/notebooks/${notebook.id}`);
  await deleteNotebook(page, notebook.title);
  notebook = null;
});

test("answers only from the sources, with a citation that opens the passage", async ({ page }) => {
  // 1. Create a notebook.
  const title = uniqueTitle("Kernpfad");
  notebook = { id: await createNotebook(page, title), title };

  // 2. Paste a text as a source.
  await page.getByRole("button", { name: "Quelle hinzufügen" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Quelle hinzufügen" });
  await dialog.getByRole("button", { name: "Text einfügen" }).click();
  await dialog.getByLabel("Titel des Texts").fill(SOURCE_TITLE);
  await dialog.getByLabel("Text", { exact: true }).fill(SOURCE_TEXT);
  await dialog.getByRole("button", { name: "Text hinzufügen" }).click();
  await expect(dialog).toBeHidden();

  // 3. Wait until the source is ready: then its row shows the chunk count.
  // The page polls the status, so no reload is needed.
  const sources = page.getByRole("region", { name: "Quellen" });
  await expect(sources.getByText("Text · 1 Abschnitt")).toBeVisible({ timeout: 60_000 });

  // 4. Ask a question the source answers.
  const chat = page.getByRole("region", { name: "Chat" });
  const question = chat.getByLabel("Frage an deine Quellen");
  await question.fill("Wie lange kann man Bücher ausleihen?");
  await question.press("Enter");

  // The answer is streamed. It is complete when the citation button is there.
  // The wording varies, so we only check the fact and the citation.
  const firstCitation = chat.getByRole("button", { name: "Beleg 1 anzeigen" }).first();
  await expect(firstCitation).toBeVisible({ timeout: 60_000 });
  await expect(chat.getByRole("listitem").nth(1)).toContainText(/(vier|4) Wochen/);

  // 5. The citation opens the source with the cited passage marked.
  await firstCitation.click();
  const citationView = page.getByRole("region", { name: SOURCE_TITLE });
  await expect(citationView.getByText("Beleg 1 von", { exact: false })).toBeVisible();
  await expect(citationView.locator("mark")).toContainText("vier Wochen");

  // The citation view takes the place of the source column. Close it.
  await citationView.getByRole("button", { name: "Schließen" }).click();

  // 6. A question outside the sources gets the fixed refusal.
  await question.fill("Wer hat die Fußball-Weltmeisterschaft 2014 gewonnen?");
  await question.press("Enter");
  // List items: 0 question, 1 answer, 2 question, 3 answer.
  await expect(chat.getByRole("listitem").nth(3)).toContainText(NO_ANSWER, { timeout: 60_000 });

  // 7. Delete the source (with confirmation). The row disappears.
  await deleteSource(page, SOURCE_TITLE);

  // 8. Delete the notebook. Afterwards it is gone from the overview.
  await deleteNotebook(page, title);
  notebook = null;
  await expect(page.getByText(title)).toBeHidden();
});
