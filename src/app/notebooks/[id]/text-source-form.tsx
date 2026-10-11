"use client";

import { useActionState } from "react";
import { MAX_TEXT_CHARS } from "@/lib/schemas";
import { createTextSource, type SourceFormState } from "./actions";

const initialState: SourceFormState = { error: null };

export function TextSourceForm({ notebookId }: { notebookId: string }) {
  const [state, formAction, pending] = useActionState(createTextSource, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="notebookId" value={notebookId} />
      <input
        name="title"
        required
        maxLength={500}
        placeholder="Titel, z. B. Notizen aus dem Meeting"
        aria-label="Titel des Texts"
        className="rounded-full border border-[#e3e5e8] bg-white px-4 py-2.5 outline-none focus:border-[#111315]"
      />
      <textarea
        name="text"
        required
        rows={6}
        maxLength={MAX_TEXT_CHARS}
        placeholder="Text hier einfügen …"
        aria-label="Text"
        className="rounded-[18px] border border-[#e3e5e8] bg-white px-4 py-3 outline-none focus:border-[#111315]"
      />
      {state.error && (
        <p role="alert" className="text-sm text-[#a3361a]">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-[#111315] px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Speichere …" : "Text hinzufügen"}
      </button>
    </form>
  );
}
