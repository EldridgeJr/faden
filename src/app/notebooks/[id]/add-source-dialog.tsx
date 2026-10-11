"use client";

import { AlignLeft, Globe } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PdfDropzone } from "./pdf-dropzone";
import { TextSourceForm } from "./text-source-form";
import type { UploadItem } from "./use-pdf-uploads";
import { UrlSourceForm } from "./url-source-form";

function Option({
  icon,
  title,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-tile bg-surface p-4", className)}>
      <h3 className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// The dialog "Quelle hinzufügen" with the three ways in.
// Controlled from outside: the header button, the sources column and the
// error card of a scanned PDF all open this one dialog.
// textTitle: open the text form at once, with this title (for a scanned PDF).
export function AddSourceDialog({
  notebookId,
  open,
  onOpenChange,
  textTitle,
  uploads,
  uploading,
  onFiles,
}: {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textTitle: string | null;
  uploads: UploadItem[];
  uploading: boolean;
  onFiles: (files: File[]) => void;
}) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quelle hinzufügen</DialogTitle>
          <DialogDescription>
            Faden liest den Text, teilt ihn in Abschnitte und macht ihn für den Chat durchsuchbar.
          </DialogDescription>
        </DialogHeader>

        <PdfDropzone items={uploads} busy={uploading} onFiles={onFiles} />

        {/* flex-wrap instead of a grid: when the text form takes a full row,
            the web page card grows to the full width too, with no gap. */}
        <div className="flex flex-wrap gap-3">
          <Option icon={<Globe className="size-[18px]" aria-hidden />} title="Webseite per Link" className="flex-[1_1_260px]">
            <UrlSourceForm notebookId={notebookId} onDone={close} />
            <p className="text-xs text-muted-foreground">
              Faden lädt nur den lesbaren Text der Seite, ohne Menü und Werbung.
            </p>
          </Option>
          {/* key: a new textTitle mounts a fresh form with the new title. */}
          <TextOption key={textTitle ?? ""} notebookId={notebookId} textTitle={textTitle} onDone={close} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Closed: a button. Open: the form over the full width.
function TextOption({
  notebookId,
  textTitle,
  onDone,
}: {
  notebookId: string;
  textTitle: string | null;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(textTitle !== null);
  const icon = <AlignLeft className="size-[18px]" aria-hidden />;

  if (!expanded) {
    return (
      <Option icon={icon} title="Text einfügen" className="flex-[1_1_260px]">
        <Button variant="outline" className="self-start" onClick={() => setExpanded(true)}>
          Text einfügen
        </Button>
        <p className="text-xs text-muted-foreground">
          Für Notizen, E-Mails oder den Inhalt eines Scans.
        </p>
      </Option>
    );
  }

  return (
    <Option icon={icon} title="Text einfügen" className="basis-full">
      <TextSourceForm notebookId={notebookId} defaultTitle={textTitle ?? undefined} onDone={onDone} />
    </Option>
  );
}
