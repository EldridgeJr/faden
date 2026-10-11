"use client";

import { Check, CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFileDrop } from "./use-file-drop";
import type { UploadItem } from "./use-pdf-uploads";

// The big drop area in the dialog, plus the list of running uploads.
export function PdfDropzone({
  items,
  busy,
  onFiles,
}: {
  items: UploadItem[];
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dragging, handlers } = useFileDrop(onFiles, busy);

  return (
    <div className="flex flex-col gap-3">
      <div
        {...handlers}
        className={cn(
          "flex flex-col items-center gap-2 rounded-[20px] border-[1.5px] border-dashed px-5 py-7 text-center transition-colors",
          dragging ? "border-foreground bg-highlight/25" : "border-border bg-surface",
        )}
      >
        <span
          aria-hidden
          className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <CloudUpload className="size-5" />
        </span>
        <p className="font-medium">{dragging ? "Loslassen zum Hochladen" : "PDFs hierher ziehen"}</p>
        <p className="text-xs text-muted-foreground">
          Bis 20 MB je Datei · mehrere gleichzeitig möglich
        </p>
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-1">
          Dateien auswählen
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            // Reset, so the same file can be chosen again.
            event.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </div>

      {items.length > 0 && (
        // aria-live: screen readers announce when a file is done or fails.
        <ul aria-live="polite" className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.key}
              className={cn(
                "flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm",
                item.state === "error" ? "bg-error text-error-foreground" : "bg-surface",
              )}
            >
              {item.state === "uploading" && (
                <LoaderCircle className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
              )}
              {item.state === "done" && <Check className="mt-0.5 size-4 shrink-0 text-ready" aria-hidden />}
              {item.state === "error" && <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span className="flex min-w-0 flex-col">
                <span className="font-medium break-words">{item.name}</span>
                <span className="text-xs opacity-80">
                  {item.state === "uploading" && "Lädt hoch …"}
                  {item.state === "done" && "Hochgeladen, wird verarbeitet"}
                  {item.state === "error" && item.error}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
