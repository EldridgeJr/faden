"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createPdfSource, startProcessing } from "./actions";

export function PdfUpload({ notebookId, onDone }: { notebookId: string; onDone?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      // 1. Server: check input and rights, create source row and upload URL.
      const result = await createPdfSource({
        notebookId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // 2. Browser → Supabase Storage directly, with the one-time token.
      const { error: uploadError } = await createClient()
        .storage.from("sources")
        .uploadToSignedUrl(result.path, result.token, file, {
          contentType: "application/pdf",
        });
      if (uploadError) setError("Der Upload ist fehlgeschlagen.");

      // 3. Server: start processing. Also after a failed upload: the server
      // then finds no file and sets the status "Fehler" with a clear message.
      await startProcessing(result.sourceId);
      if (!uploadError) onDone?.();
    } catch {
      setError("Der Upload ist fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* A label that looks like a button: a click opens the file picker. */}
      <label
        className={cn(buttonVariants(), "w-fit", uploading && "pointer-events-none opacity-60")}
      >
        <Upload aria-hidden />
        {uploading ? "Lade hoch …" : "PDF auswählen"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset, so the same file can be chosen again.
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-error-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
