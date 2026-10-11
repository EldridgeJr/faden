"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUrlSource, type SourceFormState } from "./actions";

const initialState: SourceFormState = { error: null };

export function UrlSourceForm({ notebookId, onDone }: { notebookId: string; onDone?: () => void }) {
  // A wrapper around the Server Action: tell the dialog when it worked.
  const [state, formAction, pending] = useActionState(
    async (prev: SourceFormState, formData: FormData) => {
      const result = await createUrlSource(prev, formData);
      if (!result.error) onDone?.();
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="notebookId" value={notebookId} />
      <div className="flex gap-2">
        <Input
          name="url"
          required
          maxLength={2000}
          inputMode="url"
          placeholder="https://"
          aria-label="Adresse der Webseite"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Füge hinzu …" : "Hinzufügen"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-error-foreground">
          {state.error}
        </p>
      )}
    </form>
  );
}
