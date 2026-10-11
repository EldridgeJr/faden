"use client";

import { Headphones, Layers, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { StatusChip } from "@/components/status-chip";
import { KIND_LABELS, type StudioItemSummary } from "@/lib/studio/summary";
import { cn } from "@/lib/utils";
import { DeleteStudioItemButton } from "./delete-studio-item-button";
import { createStudioItem } from "./studio-actions";
import { usePolling } from "./use-polling";

const KIND_ICONS: Record<string, typeof Layers> = {
  flashcards: Layers,
  podcast: Headphones,
};

// The Studio column: buttons to create new formats from the selected
// sources, and the list of everything created so far.
export function StudioPanel({
  notebookId,
  selectedIds,
  items,
}: {
  notebookId: string;
  selectedIds: string[];
  items: StudioItemSummary[];
}) {
  const [pending, startTransition] = useTransition();
  // Which tile was clicked, so only that one shows "Wird gestartet …".
  const [startingKind, setStartingKind] = useState<StudioKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePolling(items.some((item) => item.state === "busy"));

  const noSelection = selectedIds.length === 0;

  function create(kind: StudioKind) {
    setError(null);
    setStartingKind(kind);
    startTransition(async () => {
      const result = await createStudioItem({ notebookId, sourceIds: selectedIds, kind });
      if (result.error) setError(result.error);
    });
  }

  return (
    <section aria-labelledby="studio-heading" className="flex min-h-0 flex-1 flex-col gap-4">
      <h2 id="studio-heading" className="text-xl font-medium tracking-tight">
        Studio
      </h2>
      <p className="text-sm text-muted-foreground">
        Erstellt neue Formate aus den ausgewählten Quellen, mit Belegen wie im Chat.
      </p>

      {/* auto-fit: two tiles side by side only if each gets at least 10rem.
          In the narrow column they stack, so long words like
          "Zusammenfassung" fit. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2.5">
        {(["podcast", "flashcards"] as const).map((kind) => (
          <CreateTile
            key={kind}
            kind={kind}
            starting={pending && startingKind === kind}
            disabled={noSelection || pending}
            onClick={() => create(kind)}
          />
        ))}
      </div>

      {noSelection && (
        <p className="text-xs text-muted-foreground">Wähle links mindestens eine bereite Quelle aus.</p>
      )}
      {error && (
        <p role="alert" className="rounded-tile bg-error px-4 py-2.5 text-sm text-error-foreground">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <ul aria-label="Erstellt" className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
          {items.map((item) => (
            <StudioItemRow key={item.id} notebookId={notebookId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

type StudioKind = "podcast" | "flashcards";

function CreateTile({
  kind,
  starting,
  disabled,
  onClick,
}: {
  kind: StudioKind;
  starting: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[108px] flex-col items-start gap-2.5 rounded-tile border-[1.5px] border-border bg-card p-3.5 text-left transition-colors hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
    >
      <TileIcon Icon={starting ? LoaderCircle : KIND_ICONS[kind]} spin={starting} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium hyphens-auto">{KIND_LABELS[kind]}</span>
        <span className="text-xs text-muted-foreground">{starting ? "Wird gestartet …" : "Erstellen"}</span>
      </span>
    </button>
  );
}

function TileIcon({ Icon, spin = false }: { Icon: typeof Layers; spin?: boolean }) {
  return (
    <span aria-hidden className="inline-flex size-[34px] items-center justify-center rounded-full bg-tile">
      <Icon className={cn("size-4", spin && "animate-spin motion-reduce:animate-none")} />
    </span>
  );
}

function StudioItemRow({ notebookId, item }: { notebookId: string; item: StudioItemSummary }) {
  const Icon = KIND_ICONS[item.kind] ?? Layers;
  const title =
    item.state === "ready" ? (
      <Link
        href={`/notebooks/${notebookId}/studio/${item.id}`}
        className="rounded-sm font-medium break-words hyphens-auto hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {item.title}
      </Link>
    ) : (
      <span className="font-medium break-words hyphens-auto">{item.title}</span>
    );

  return (
    <li className="flex items-start gap-3 rounded-tile bg-tile p-3">
      <TileIcon Icon={Icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        {title}
        {item.state === "busy" && (
          <StatusChip tone="busy" className="self-start">
            In Arbeit
          </StatusChip>
        )}
        {item.state === "error" && (
          <>
            <StatusChip tone="error" className="self-start">
              Fehler
            </StatusChip>
            <span className="text-xs text-error-foreground">{item.error}</span>
          </>
        )}
        {item.state === "ready" && (
          <span className="font-mono text-xs text-muted-foreground">
            {[item.detail, item.day].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      {item.state !== "busy" && <DeleteStudioItemButton itemId={item.id} title={item.title} />}
    </li>
  );
}
