"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_CHARS } from "@/lib/schemas";
import { createTextSource, type SourceFormState } from "./actions";

const initialState: SourceFormState = { error: null };

export function TextSourceForm({
  notebookId,
  defaultTitle,
  onDone,
}: {
  notebookId: string;
  defaultTitle?: string;
  onDone?: () => void;
}) {
  // A wrapper around the Server Action: tell the dialog when it worked.
  const [state, formAction, pending] = useActionState(
    async (prev: SourceFormState, formData: FormData) => {
      const result = await createTextSource(prev, formData);
      if (!result.error) onDone?.();
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="notebookId" value={notebookId} />
      <Input
        name="title"
        required
        maxLength={500}
        defaultValue={defaultTitle}
        autoFocus={defaultTitle === undefined}
        placeholder="Titel, z. B. Notizen aus dem Meeting"
        aria-label="Titel des Texts"
      />
      <Textarea
        name="text"
        required
        rows={6}
        maxLength={MAX_TEXT_CHARS}
        // With a title already filled in, the cursor goes straight to the text.
        autoFocus={defaultTitle !== undefined}
        placeholder="Text hier einfügen …"
        aria-label="Text"
        className="max-h-72"
      />
      {state.error && (
        <p role="alert" className="text-sm text-error-foreground">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Speichere …" : "Text hinzufügen"}
      </Button>
    </form>
  );
}
