"use client";

import { useState, useTransition } from "react";
import { deleteSource } from "./actions";

export function DeleteSourceButton({ sourceId, title }: { sourceId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    // Simple browser dialog for now. Step 5 brings a dialog in the Faden design.
    if (!window.confirm(`„${title}“ löschen? Datei und Abschnitte werden entfernt.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSource(sourceId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-error-foreground hover:text-error-foreground disabled:opacity-60"
      >
        {pending ? "Lösche …" : "Löschen"}
      </button>
      {error && (
        <span role="alert" className="text-right text-sm text-error-foreground">
          {error}
        </span>
      )}
    </div>
  );
}
