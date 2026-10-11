import { LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import type { Theme } from "@/lib/theme";
import { CreateNotebookDialog } from "./notebook-dialogs";

export type SidebarProps = {
  notebookCount: number;
  recent: { id: string; title: string }[];
  email: string | null;
  theme: Theme;
};

// The sidebar of the start page. Only things that really work:
// overview, the most recently active notebooks, new notebook, theme, logout.
export function Sidebar({ notebookCount, recent, email, theme }: SidebarProps) {
  return (
    <nav aria-label="Hauptnavigation" className="flex h-full flex-col gap-5">
      <Link
        href="/notebooks"
        className="flex items-center gap-2.5 rounded-tile focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Logo size={36} />
        <span className="text-[21px] font-semibold tracking-tight">Faden</span>
      </Link>

      <CreateNotebookDialog className="w-full" />

      <ul className="flex flex-col gap-1">
        <li>
          <Link
            href="/notebooks"
            aria-current="page"
            className="flex h-11 items-center gap-3 rounded-tile bg-tile px-3 font-medium"
          >
            <LayoutGrid className="size-[18px]" aria-hidden />
            Übersicht
            <span className="ml-auto font-mono text-xs text-muted-foreground">{notebookCount}</span>
          </Link>
        </li>
      </ul>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="px-3 font-mono text-xs text-muted-foreground">Zuletzt aktiv</p>
          <ul className="flex flex-col">
            {recent.map((notebook) => (
              <li key={notebook.id}>
                <Link
                  href={`/notebooks/${notebook.id}`}
                  className="flex min-h-10 items-center gap-3 rounded-tile px-3 text-sm hover:bg-tile"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-border" />
                  <span className="truncate">{notebook.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex gap-3 rounded-tile bg-surface p-3.5">
          <ShieldCheck className="mt-0.5 size-[18px] shrink-0" aria-hidden />
          <p className="flex flex-col gap-0.5 text-xs leading-relaxed text-muted-foreground">
            <span className="text-sm font-medium text-foreground">Daten in Frankfurt</span>
            Datenbank und Dateien liegen in der EU. Antworten berechnet OpenAI, ohne Training
            mit deinen Daten.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-sm text-muted-foreground">Farbschema</span>
          <ThemeSwitch initialTheme={theme} />
        </div>

        <div className="flex items-center gap-3 rounded-tile border border-border p-2 pl-3">
          <span
            aria-hidden
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground uppercase"
          >
            {email?.[0] ?? "?"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Abmelden" title="Abmelden">
              <LogOut aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </nav>
  );
}
