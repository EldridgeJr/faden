"use client";

import { useActionState } from "react";
import { createUrlSource, type SourceFormState } from "./actions";

const initialState: SourceFormState = { error: null };

export function UrlSourceForm({ notebookId }: { notebookId: string }) {
  const [state, formAction, pending] = useActionState(createUrlSource, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="notebookId" value={notebookId} />
      <div className="flex gap-2">
        <input
          name="url"
          required
          maxLength={2000}
          inputMode="url"
          placeholder="https://…"
          aria-label="Adresse der Webseite"
          className="min-w-0 flex-1 rounded-full border border-[#e3e5e8] bg-white px-4 py-2.5 outline-none focus:border-[#111315]"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-[#111315] px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Füge hinzu …" : "Hinzufügen"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-[#a3361a]">
          {state.error}
        </p>
      )}
    </form>
  );
}
