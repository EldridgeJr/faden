import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { greeting } from "@/lib/format";
import { summarizeNotebooks } from "@/lib/notebook-overview";
import { getTheme } from "@/lib/theme-server";
import { MobileNav } from "./mobile-nav";
import { NotebookCard, RecentNotebookCard } from "./notebook-card";
import { CreateNotebookDialog, CreateNotebookForm } from "./notebook-dialogs";
import { Sidebar, type SidebarProps } from "./sidebar";

export const metadata: Metadata = { title: "Notebooks · Faden" };

// How many recent questions we read to find the last activity per notebook.
// A notebook whose last question is older counts with its creation date.
const RECENT_QUESTIONS = 100;

export default async function NotebooksPage() {
  const { supabase, userId, email } = await requireUser();

  // Two queries at the same time. RLS already limits both to the user's
  // data. The filter on owner_id lets Postgres use the index (owner_id, created_at).
  const [notebooksResult, questionsResult] = await Promise.all([
    supabase.from("notebooks").select("id, title, created_at, sources(status)").eq("owner_id", userId),
    supabase
      .from("messages")
      .select("notebook_id, content, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(RECENT_QUESTIONS),
  ]);
  if (notebooksResult.error) throw notebooksResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const notebooks = summarizeNotebooks(notebooksResult.data, questionsResult.data);
  const now = new Date();
  const [latest] = notebooks;

  // Sources with an error need the user: they must remove or replace them.
  const failedSources = notebooks.reduce((sum, notebook) => sum + notebook.failed, 0);
  const firstFailing = notebooks.find((notebook) => notebook.failed > 0);

  const sidebar: SidebarProps = {
    notebookCount: notebooks.length,
    recent: notebooks.slice(0, 5).map(({ id, title }) => ({ id, title })),
    email,
    theme: await getTheme(),
  };

  return (
    <div className="flex-1 p-2 sm:p-5">
      <div className="mx-auto flex max-w-[1480px] gap-4 rounded-[36px] bg-surface p-3 shadow-[0_1px_2px_rgba(17,19,21,0.04),0_16px_48px_rgba(17,19,21,0.06)] sm:p-5">
        <aside className="hidden w-64 shrink-0 self-start rounded-card bg-card p-4 lg:sticky lg:top-10 lg:flex lg:h-[calc(100dvh-5rem)]">
          <Sidebar {...sidebar} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNav>
              <Sidebar {...sidebar} />
            </MobileNav>
            <Logo size={36} />
            <span className="text-xl font-semibold tracking-tight">Faden</span>
          </div>

          <header className="flex flex-wrap items-center gap-3.5">
            <h1 className="text-[32px] leading-tight font-semibold tracking-tight sm:text-[38px]">
              {greeting(now)}
            </h1>
            {firstFailing && (
              <Link
                href={`/notebooks/${firstFailing.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-busy px-3.5 text-[13px] font-medium text-busy-foreground"
              >
                <CircleAlert className="size-4" aria-hidden />
                {failedSources === 1
                  ? "1 Quelle braucht deine Hilfe"
                  : `${failedSources} Quellen brauchen deine Hilfe`}
              </Link>
            )}
            <CreateNotebookDialog className="ml-auto h-12 px-5" />
          </header>

          {latest ? (
            <div className="flex flex-wrap gap-4">
              <RecentNotebookCard notebook={latest} now={now} />
              <section
                aria-labelledby="new-notebook-title-heading"
                className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card bg-card p-5"
              >
                <h2 id="new-notebook-title-heading" className="text-xl font-medium tracking-tight">
                  Neues Notebook
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ein Notebook sammelt Quellen zu einem Thema. Faden antwortet nur aus diesen
                  Quellen.
                </p>
                <CreateNotebookForm />
              </section>
            </div>
          ) : (
            <section className="flex flex-col gap-3 rounded-card bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Lege dein erstes Notebook an</h2>
              <p className="max-w-[60ch] text-muted-foreground">
                Ein Notebook sammelt Quellen zu einem Thema: PDFs, Webseiten oder eingefügten
                Text. Danach stellst du Fragen, und Faden antwortet nur aus diesen Quellen, mit
                Belegen zum Anklicken.
              </p>
              <div className="max-w-md">
                <CreateNotebookForm />
              </div>
            </section>
          )}

          {notebooks.length > 0 && (
            <section
              aria-labelledby="all-notebooks-heading"
              className="flex flex-col gap-4 rounded-card bg-card p-5"
            >
              <div className="flex items-baseline gap-2">
                <h2 id="all-notebooks-heading" className="text-xl font-medium tracking-tight">
                  Alle Notebooks
                </h2>
                <span className="font-mono text-[13px] text-muted-foreground">{notebooks.length}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3.5">
                {notebooks.map((notebook) => (
                  <NotebookCard key={notebook.id} notebook={notebook} now={now} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
