"use client";

import { AlignLeft, FileText, Globe } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfUpload } from "./pdf-upload";
import { TextSourceForm } from "./text-source-form";
import { UrlSourceForm } from "./url-source-form";

function Option({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-tile bg-surface p-4">
      <h3 className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// The dialog "Quelle hinzufügen" with the three ways in.
// Controlled from outside (open/onOpenChange): the header button and the
// sources column open the same dialog.
export function AddSourceDialog({
  notebookId,
  open,
  onOpenChange,
}: {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Quelle hinzufügen</DialogTitle>
          <DialogDescription>
            Faden liest den Text, teilt ihn in Abschnitte und macht ihn für den Chat durchsuchbar.
          </DialogDescription>
        </DialogHeader>
        <Option icon={<FileText className="size-[18px]" aria-hidden />} title="PDF hochladen">
          <p className="text-xs text-muted-foreground">Bis 20 MB. Gescannte PDFs ohne Text kann Faden nicht lesen.</p>
          <PdfUpload notebookId={notebookId} onDone={close} />
        </Option>
        <Option icon={<Globe className="size-[18px]" aria-hidden />} title="Webseite per Link">
          <UrlSourceForm notebookId={notebookId} onDone={close} />
          <p className="text-xs text-muted-foreground">
            Faden lädt nur den lesbaren Text der Seite, ohne Menü und Werbung.
          </p>
        </Option>
        <Option icon={<AlignLeft className="size-[18px]" aria-hidden />} title="Text einfügen">
          <TextSourceForm notebookId={notebookId} onDone={close} />
        </Option>
      </DialogContent>
    </Dialog>
  );
}
