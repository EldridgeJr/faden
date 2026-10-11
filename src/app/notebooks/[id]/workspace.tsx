"use client";

import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat/citations";
import { cn } from "@/lib/utils";
import { NotebookMenu } from "../notebook-dialogs";
import { AddSourceDialog } from "./add-source-dialog";
import { Chat } from "./chat";
import { CitationPanel, type OpenCitation } from "./citation-panel";
import { SourcePanel, type SourceItem } from "./source-panel";
import { StudioPanel } from "./studio-panel";

type Tab = "sources" | "chat" | "studio";

// The notebook page in the browser: header, three columns and the state
// they share.
//
// Layout: on large screens three columns (sources · chat · studio). An open
// citation replaces sources and studio, so the source text has room next
// to the chat. On small screens one column at a time, chosen with tabs.
//
// The chat is never unmounted, only hidden with CSS. Otherwise useChat
// would lose its state, for example an answer that is still streaming.
export function Workspace({
  notebook,
  sources,
  initialMessages,
}: {
  notebook: { id: string; title: string };
  sources: SourceItem[];
  initialMessages: ChatMessage[];
}) {
  // We store the sources the user switched OFF, not the ones that are on.
  // So a source that becomes ready later is selected automatically.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [openCitation, setOpenCitation] = useState<OpenCitation | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const ready = sources.filter((s) => s.status === "ready");
  const selectedIds = ready.filter((s) => !excluded.has(s.id)).map((s) => s.id);
  const [tab, setTab] = useState<Tab>(ready.length > 0 ? "chat" : "sources");

  function toggleSource(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    setExcluded(selectAll ? new Set() : new Set(ready.map((s) => s.id)));
  }

  // Small screens: an open citation covers the active tab.
  const view: Tab | "citation" = openCitation ? "citation" : tab;
  const column = "min-h-0 flex-col rounded-card bg-card p-5";

  return (
    <div className="flex h-dvh flex-col p-2 sm:p-5">
      <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col gap-4 rounded-[36px] bg-surface p-3 shadow-[0_1px_2px_rgba(17,19,21,0.04),0_16px_48px_rgba(17,19,21,0.06)] sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3">
            <Link
              href="/notebooks"
              aria-label="Faden, zur Übersicht"
              className="hidden rounded-[12px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:inline-flex"
            >
              <Logo />
            </Link>
            <Button asChild variant="outline" size="icon">
              <Link href="/notebooks" aria-label="Zurück zu allen Notebooks">
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13px] text-muted-foreground">
                <Link href="/notebooks" className="hover:text-foreground">
                  Notebooks
                </Link>{" "}
                /
              </p>
              <h1 className="truncate text-xl leading-tight font-semibold tracking-tight sm:text-[28px]">
                {notebook.title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {sources.length > 0 && (
              <StatusChip tone="neutral" className="hidden h-9 border border-border px-3.5 font-mono font-normal sm:inline-flex">
                {ready.length} von {sources.length} Quellen bereit
              </StatusChip>
            )}
            <NotebookMenu notebookId={notebook.id} title={notebook.title} className="size-11" />
            <Button onClick={() => setAddOpen(true)}>
              <Plus aria-hidden />
              <span className="max-sm:sr-only">Quelle hinzufügen</span>
            </Button>
          </div>
        </header>

        {/* Tabs for small screens. Buttons with aria-pressed: a simple
            toggle group, no full ARIA tab pattern needed. */}
        <div className="flex gap-1 rounded-full bg-tile p-1 lg:hidden" role="group" aria-label="Ansicht">
          {(
            [
              ["sources", `Quellen ${sources.length}`],
              ["chat", "Chat"],
              ["studio", "Studio"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setOpenCitation(null);
                setTab(value);
              }}
              className={cn(
                "h-10 flex-1 rounded-full text-sm font-medium transition-colors",
                view === value ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          <div
            className={cn(
              column,
              "flex-[1_1_280px]",
              view === "sources" ? "flex" : "hidden",
              openCitation ? "lg:hidden" : "lg:flex",
            )}
          >
            <SourcePanel
              sources={sources}
              excluded={excluded}
              onToggle={toggleSource}
              onToggleAll={toggleAll}
              onAdd={() => setAddOpen(true)}
            />
          </div>

          <div className={cn(column, "flex-[3_1_480px] lg:flex", view === "chat" ? "flex" : "hidden")}>
            <Chat
              notebookId={notebook.id}
              selectedIds={selectedIds}
              readyCount={ready.length}
              initialMessages={initialMessages}
              openCitation={openCitation}
              onOpenCitation={setOpenCitation}
            />
          </div>

          {openCitation && (
            <div className={cn(column, "flex flex-[2_1_420px]")}>
              <CitationPanel
                open={openCitation}
                onSelect={(n) => setOpenCitation({ ...openCitation, n })}
                onClose={() => setOpenCitation(null)}
              />
            </div>
          )}

          <div
            className={cn(
              column,
              "flex-[1_1_300px]",
              view === "studio" ? "flex" : "hidden",
              openCitation ? "lg:hidden" : "lg:flex",
            )}
          >
            <StudioPanel />
          </div>
        </div>
      </div>

      <AddSourceDialog notebookId={notebook.id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
