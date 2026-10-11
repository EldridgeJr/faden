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
import { deleteStudioItem } from "./studio-actions";

// Delete button with a confirm dialog. onDeleted: what happens afterwards,
// for example going back to the notebook from the studio page.
export function DeleteStudioItemButton({
  itemId,
  title,
  onDeleted,
}: {
  itemId: string;
  title: string;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteStudioItem(itemId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDeleted?.();
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
          <AlertDialogTitle>Löschen?</AlertDialogTitle>
          <AlertDialogDescription>„{title}“ wird endgültig gelöscht. Deine Quellen bleiben erhalten.</AlertDialogDescription>
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
