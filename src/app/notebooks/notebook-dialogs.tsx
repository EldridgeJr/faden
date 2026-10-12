"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  createNotebook,
  deleteNotebook,
  renameNotebook,
  type NotebookFormState,
} from "./actions";

const initialState: NotebookFormState = { error: null };

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-tile bg-error px-4 py-2.5 text-sm text-error-foreground">
      {error}
    </p>
  );
}

// Title field + button. On success the action redirects to the new notebook.
export function CreateNotebookForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [state, formAction, pending] = useActionState(createNotebook, initialState);
  // The overview shows this form twice (on the page and in the dialog).
  // A fixed id would exist twice, and the label would point to the wrong field.
  const inputId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor={inputId} className="sr-only">
        Titel des neuen Notebooks
      </label>
      <Input
        id={inputId}
        name="title"
        required
        maxLength={200}
        autoFocus={autoFocus}
        placeholder="Zum Beispiel: Hausarbeit Stadtgeschichte"
      />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="self-start">
        <Plus aria-hidden />
        {pending ? "Lege an …" : "Notebook anlegen"}
      </Button>
    </form>
  );
}

export function CreateNotebookDialog({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className}>
          <Plus aria-hidden />
          Neues Notebook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Notebook</DialogTitle>
          <DialogDescription>
            Gib dem Notebook einen Titel. Danach fügst du Quellen hinzu.
          </DialogDescription>
        </DialogHeader>
        <CreateNotebookForm autoFocus />
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  notebookId,
  title,
  open,
  onOpenChange,
}: {
  notebookId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // A wrapper around the Server Action: close the dialog when it worked.
  const [state, formAction, pending] = useActionState(
    async (prev: NotebookFormState, formData: FormData) => {
      const result = await renameNotebook(prev, formData);
      if (!result.error) onOpenChange(false);
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notebook umbenennen</DialogTitle>
          <DialogDescription>Der neue Titel gilt sofort.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="notebookId" value={notebookId} />
          <label htmlFor={`rename-${notebookId}`} className="sr-only">
            Neuer Titel
          </label>
          <Input
            id={`rename-${notebookId}`}
            name="title"
            required
            maxLength={200}
            defaultValue={title}
            autoFocus
          />
          <FormError error={state.error} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichere …" : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  notebookId,
  title,
  open,
  onOpenChange,
}: {
  notebookId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      // On success the action redirects to /notebooks. We only get a value
      // back when something went wrong.
      const result = await deleteNotebook(notebookId);
      setError(result.error);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Notebook löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{title}“ wird mit allen Quellen, Dateien und dem Chatverlauf gelöscht. Das lässt
            sich nicht rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              // Keep the dialog open while the action runs.
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Lösche …" : "Endgültig löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// The "…" menu of a notebook: rename and delete.
// The dialogs sit outside the menu. The menu closes on click, and a dialog
// inside it would close with it.
export function NotebookMenu({
  notebookId,
  title,
  className,
}: {
  notebookId: string;
  title: string;
  className?: string;
}) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={`Aktionen für ${title}`} className={className}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil aria-hidden />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        notebookId={notebookId}
        title={title}
        open={dialog === "rename"}
        onOpenChange={(open) => setDialog(open ? "rename" : null)}
      />
      <DeleteDialog
        notebookId={notebookId}
        title={title}
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
      />
    </>
  );
}
