"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { notebookTitleSchema } from "@/lib/schemas";

export type CreateNotebookState = { error: string | null };

export async function createNotebook(
  _prevState: CreateNotebookState,
  formData: FormData,
): Promise<CreateNotebookState> {
  // Check the login here too. A Server Action is a public POST endpoint,
  // anyone can call it without opening the page.
  const { supabase } = await requireUser();

  const parsed = notebookTitleSchema.safeParse(formData.get("title"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // No owner_id sent: the column default is auth.uid(), and the insert
  // policy rejects any other value.
  const { error } = await supabase.from("notebooks").insert({ title: parsed.data });
  if (error) {
    console.error("createNotebook failed", error);
    return { error: "Das Notebook konnte nicht angelegt werden." };
  }

  // Next 16: re-render the current page so the list shows the new notebook.
  refresh();
  return { error: null };
}
