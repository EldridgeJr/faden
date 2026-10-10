import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { CreateNotebookForm } from "./create-notebook-form";

export const metadata: Metadata = { title: "Notebooks · Faden" };

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

export default async function NotebooksPage() {
  const { supabase, userId } = await requireUser();

  // RLS already limits the rows to the user's notebooks. The explicit
  // filter on owner_id lets Postgres use the index (owner_id, created_at).
  const { data: notebooks, error } = await supabase
    .from("notebooks")
    .select("id, title, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 text-[#111315]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Notebooks</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-[#e3e5e8] bg-white px-4 py-2 text-sm"
          >
            Abmelden
          </button>
        </form>
      </header>

      <CreateNotebookForm />

      {notebooks.length === 0 ? (
        <p className="text-[#6b7078]">Noch keine Notebooks. Lege oben dein erstes an.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notebooks.map((notebook) => (
            <li key={notebook.id}>
              <Link
                href={`/notebooks/${notebook.id}`}
                className="flex items-center justify-between gap-4 rounded-[18px] bg-white px-5 py-4 hover:bg-[#f6f7f8]"
              >
                <span className="truncate font-medium">{notebook.title}</span>
                <span className="shrink-0 font-mono text-sm text-[#6b7078]">
                  {dateFormat.format(new Date(notebook.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
