import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toChatMessages } from "@/lib/chat/messages";
import { notebookIdSchema, sourceMetaSchema } from "@/lib/schemas";
import type { SourceItem } from "./source-panel";
import { Workspace } from "./workspace";

// Applies to all Server Actions of this page, and so to the processing in
// after(). 300 seconds is the maximum on the Vercel Hobby plan.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Notebook · Faden" };

export default async function NotebookPage({ params }: PageProps<"/notebooks/[id]">) {
  // Login first: a logged-out visitor goes to /login, not to a 404.
  const { supabase } = await requireUser();

  const { id } = await params;
  const parsedId = notebookIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const { data: notebook, error } = await supabase
    .from("notebooks")
    .select("id, title")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) throw error;

  // RLS hides notebooks of other users. For us they look exactly like
  // notebooks that do not exist: 404, not 403. So nobody learns which ids exist.
  if (!notebook) notFound();

  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id, type, title, status, error, meta")
    .eq("notebook_id", notebook.id)
    .order("created_at", { ascending: true });
  if (sourcesError) throw sourcesError;

  const items: SourceItem[] = sources.map((source) => {
    const meta = sourceMetaSchema.safeParse(source.meta);
    return {
      id: source.id,
      type: source.type,
      title: source.title,
      status: source.status,
      error: source.error,
      pages: meta.success ? meta.data.pages : undefined,
      chunks: meta.success ? meta.data.chunks : undefined,
    };
  });

  // The conversation so far: the newest 50 messages, oldest first.
  const { data: lastMessages, error: messagesError } = await supabase
    .from("messages")
    .select("id, role, content, citations")
    .eq("notebook_id", notebook.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (messagesError) throw messagesError;

  return (
    <Workspace
      notebook={notebook}
      sources={items}
      initialMessages={toChatMessages(lastMessages.reverse())}
    />
  );
}
