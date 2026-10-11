import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDuration, formatMegabytes } from "@/lib/format";
import { notebookIdSchema, studioItemIdSchema } from "@/lib/schemas";
import { flashcardsDataSchema } from "@/lib/studio/flashcards";
import { downloadFileName, podcastDataSchema } from "@/lib/studio/podcast";
import { summarizeStudioItem } from "@/lib/studio/summary";
import { FlashcardsView } from "./flashcards-view";
import { PodcastView, type PodcastPageData } from "./podcast-view";
import { StudioFrame } from "./studio-frame";
import { StudioStatus } from "./studio-status";

export const metadata: Metadata = { title: "Studio · Faden" };

// "Neu erstellen" starts a podcast job from this page. The job runs in
// after() and may take up to maxDuration of the page that called the action.
export const maxDuration = 300;

// Signed URLs for the MP3 are valid for one hour. A page open longer than
// that needs a reload to play again.
const AUDIO_URL_SECONDS = 60 * 60;

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
    .select("id, kind, status, error, data, created_at, storage_path")
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
    const parsed = podcastDataSchema.safeParse(row.data);
    const data = parsed.success ? parsed.data : null;
    const turns = data?.turns;
    const citations = data?.citations;
    if (data && turns && citations) {
      let audio: PodcastPageData["audio"] = null;
      let download: string | null = null;

      if (row.storage_path && data.durationSeconds !== undefined && data.sizeBytes !== undefined) {
        // Created with the user's client: the select policy of the bucket
        // decides. One URL to play, one that makes the browser save the file.
        const bucket = supabase.storage.from("studio");
        const [play, save] = await Promise.all([
          bucket.createSignedUrl(row.storage_path, AUDIO_URL_SECONDS),
          bucket.createSignedUrl(row.storage_path, AUDIO_URL_SECONDS, {
            download: downloadFileName(data.title ?? item.title),
          }),
        ]);
        if (play.error) throw play.error;
        if (save.error) throw save.error;
        audio = {
          src: play.data.signedUrl,
          durationSeconds: data.durationSeconds,
          sizeBytes: data.sizeBytes,
          buildSeconds: data.buildSeconds ?? null,
        };
        download = save.data.signedUrl;
      }

      const actions = audio && download && (
        <>
          <span className="hidden h-9 items-center rounded-full border border-border bg-card px-3.5 font-mono text-[13px] md:inline-flex">
            {formatDuration(audio.durationSeconds)} Min. · {formatMegabytes(audio.sizeBytes)}
          </span>
          <Button asChild>
            <a href={download}>
              <Download aria-hidden />
              <span className="max-sm:sr-only">MP3 herunterladen</span>
            </a>
          </Button>
        </>
      );

      return (
        <StudioFrame {...frame} actions={actions}>
          <PodcastView
            data={{
              notebookId: notebook.id,
              sourceIds: data.sourceIds,
              title: data.title ?? item.title,
              summary: data.summary ?? "",
              day: item.day,
              turns,
              citations,
              audio,
            }}
          />
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
