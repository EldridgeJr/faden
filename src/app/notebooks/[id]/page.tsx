import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notebookIdSchema } from "@/lib/schemas";

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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10 text-[#111315]">
      <Link href="/notebooks" className="text-sm text-[#6b7078] hover:text-[#111315]">
        ← Alle Notebooks
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{notebook.title}</h1>
      <p className="text-[#6b7078]">Quellen hinzufügen kommt in Schritt 3c.</p>
    </main>
  );
}
