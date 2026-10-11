"use client";

import { useActionState } from "react";
import { createNotebook, type CreateNotebookState } from "./actions";

const initialState: CreateNotebookState = { error: null };

export function CreateNotebookForm() {
  const [state, formAction, pending] = useActionState(createNotebook, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Titel des neuen Notebooks"
          aria-label="Titel des neuen Notebooks"
          className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Lege an …" : "Anlegen"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-error-foreground">
          {state.error}
        </p>
      )}
    </form>
  );
}
