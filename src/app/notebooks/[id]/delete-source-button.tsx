"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteSource } from "./actions";

export function DeleteSourceButton({ sourceId, title }: { sourceId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSource(sourceId);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${title} löschen`}
          className="shrink-0 text-muted-foreground hover:text-error-foreground"
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quelle löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{title}“ wird mit Datei, Abschnitten und Embeddings gelöscht. Alte Antworten
            behalten ihre Belege als Text.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="rounded-tile bg-error px-4 py-2.5 text-sm text-error-foreground">
            {error}
          </p>
        )}
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
            {pending ? "Lösche …" : "Löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
