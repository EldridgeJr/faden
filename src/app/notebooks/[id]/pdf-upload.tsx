"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPdfSource, startProcessing } from "./actions";

export function PdfUpload({ notebookId }: { notebookId: string }) {
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
    } catch {
      setError("Der Upload ist fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`inline-flex w-fit cursor-pointer items-center rounded-full bg-[#111315] px-5 py-2.5 font-medium text-white ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        {uploading ? "Lade hoch …" : "PDF hochladen"}
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
        <p role="alert" className="text-sm text-[#a3361a]">
          {error}
        </p>
      )}
    </div>
  );
}
