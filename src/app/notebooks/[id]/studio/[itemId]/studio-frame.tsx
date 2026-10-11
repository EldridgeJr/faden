"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { DeleteStudioItemButton } from "../../delete-studio-item-button";

// Page frame of a studio item: the same surface as the notebook, a header
// with the way back, and the content below.
export function StudioFrame({
  notebook,
  item,
  canDelete,
  actions,
  children,
}: {
  notebook: { id: string; title: string };
  item: { id: string; title: string };
  canDelete: boolean;
  // Extra buttons in the header, for example the MP3 download.
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const notebookHref = `/notebooks/${notebook.id}`;

  return (
    <div className="flex h-dvh flex-col p-2 sm:p-5">
      <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col gap-4 rounded-[36px] bg-surface p-3 shadow-[0_1px_2px_rgba(17,19,21,0.04),0_16px_48px_rgba(17,19,21,0.06)] sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/notebooks"
              aria-label="Faden, zur Übersicht"
              className="hidden rounded-[12px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:inline-flex"
            >
              <Logo />
            </Link>
            <Button asChild variant="outline" size="icon">
              <Link href={notebookHref} aria-label={`Zurück zu ${notebook.title}`}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-[13px] text-muted-foreground">
                <Link href={notebookHref} className="hover:text-foreground">
                  {notebook.title}
                </Link>{" "}
                / Studio
              </p>
              <h1 className="truncate text-xl leading-tight font-semibold tracking-tight sm:text-[28px]">
                {item.title}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {actions}
            {canDelete && (
              <DeleteStudioItemButton
                itemId={item.id}
                title={item.title}
                onDeleted={() => router.push(notebookHref)}
              />
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
