import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notebookIdSchema, studioItemIdSchema } from "@/lib/schemas";
import { flashcardsDataSchema } from "@/lib/studio/flashcards";
import { podcastDataSchema } from "@/lib/studio/podcast";
import { summarizeStudioItem } from "@/lib/studio/summary";
import { FlashcardsView } from "./flashcards-view";
import { PodcastView } from "./podcast-view";
import { StudioFrame } from "./studio-frame";
import { StudioStatus } from "./studio-status";

export const metadata: Metadata = { title: "Studio · Faden" };

// One studio item on its own page: flashcards or podcast.
export default async function StudioItemPage({ params }: PageProps<"/notebooks/[id]/studio/[itemId]">) {
  // Login first: a logged-out visitor goes to /login, not to a 404.
  const { supabase } = await requireUser();

  const { id, itemId } = await params;
  const notebookId = notebookIdSchema.safeParse(id);
  const studioItemId = studioItemIdSchema.safeParse(itemId);
  if (!notebookId.success || !studioItemId.success) notFound();

  // RLS hides foreign notebooks and items: they look like missing ones (404).
  const { data: notebook, error: notebookError } = await supabase
    .from("notebooks")
    .select("id, title")
    .eq("id", notebookId.data)
    .maybeSingle();
  if (notebookError) throw notebookError;
  if (!notebook) notFound();

  // The item must belong to this notebook, not only to this user.
  const { data: row, error: itemError } = await supabase
    .from("studio_items")
    .select("id, kind, status, error, data, created_at")
    .eq("id", studioItemId.data)
    .eq("notebook_id", notebook.id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!row) notFound();

  const item = summarizeStudioItem(row, new Date());
  const frame = { notebook, item: { id: item.id, title: item.title }, canDelete: item.state !== "busy" };

  if (item.state === "ready" && row.kind === "flashcards") {
    const data = flashcardsDataSchema.safeParse(row.data);
    if (data.success && data.data.cards && data.data.citations) {
      return (
        <StudioFrame {...frame}>
          <FlashcardsView cards={data.data.cards} citations={data.data.citations} />
        </StudioFrame>
      );
    }
  }

  if (item.state === "ready" && row.kind === "podcast") {
    const data = podcastDataSchema.safeParse(row.data);
    if (data.success && data.data.turns && data.data.citations) {
      return (
        <StudioFrame {...frame}>
          <PodcastView summary={data.data.summary ?? ""} turns={data.data.turns} citations={data.data.citations} />
        </StudioFrame>
      );
    }
  }

  if (item.state === "ready") {
    // Ready, but the data does not fit the schema: show it as an error.
    console.error("studio item with broken data", row.id);
    return (
      <StudioFrame {...frame}>
        <StudioStatus item={{ ...item, state: "error", error: "Dieses Element konnte nicht geladen werden." }} />
      </StudioFrame>
    );
  }

  return (
    <StudioFrame {...frame}>
      <StudioStatus item={item} />
    </StudioFrame>
  );
}
