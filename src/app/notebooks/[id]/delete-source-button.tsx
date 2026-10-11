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
        className="rounded-full border border-[#e3e5e8] px-3 py-1 text-sm text-[#6b7078] hover:border-[#a3361a] hover:text-[#a3361a] disabled:opacity-60"
      >
        {pending ? "Lösche …" : "Löschen"}
      </button>
      {error && (
        <span role="alert" className="text-right text-sm text-[#a3361a]">
          {error}
        </span>
      )}
    </div>
  );
}
