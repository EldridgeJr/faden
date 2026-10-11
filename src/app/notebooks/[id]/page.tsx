import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notebookIdSchema, sourceMetaSchema } from "@/lib/schemas";
import { PdfUpload } from "./pdf-upload";
import { SourceList, type SourceItem } from "./source-list";
import { TextSourceForm } from "./text-source-form";
import { UrlSourceForm } from "./url-source-form";

// Applies to all Server Actions of this page, and so to the processing in
// after(). 300 seconds is the maximum on the Vercel Hobby plan.
export const maxDuration = 300;

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
    .select("id, title, status, error, meta")
    .eq("notebook_id", notebook.id)
    .order("created_at", { ascending: true });
  if (sourcesError) throw sourcesError;

  const items: SourceItem[] = sources.map((source) => {
    const meta = sourceMetaSchema.safeParse(source.meta);
    return {
      id: source.id,
      title: source.title,
      status: source.status,
      error: source.error,
      pages: meta.success ? meta.data.pages : undefined,
      chunks: meta.success ? meta.data.chunks : undefined,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 text-[#111315]">
      <Link href="/notebooks" className="text-sm text-[#6b7078] hover:text-[#111315]">
        ← Alle Notebooks
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{notebook.title}</h1>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Quellen</h2>
        <PdfUpload notebookId={notebook.id} />
        <details className="rounded-[18px] bg-white px-5 py-3">
          <summary className="cursor-pointer font-medium">Text einfügen</summary>
          <div className="pt-3">
            <TextSourceForm notebookId={notebook.id} />
          </div>
        </details>
        <details className="rounded-[18px] bg-white px-5 py-3">
          <summary className="cursor-pointer font-medium">Webseite hinzufügen</summary>
          <div className="pt-3">
            <UrlSourceForm notebookId={notebook.id} />
          </div>
        </details>
        <SourceList sources={items} />
      </section>
    </main>
  );
}
