"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPdfSource, startProcessing } from "./actions";

export type UploadItem = {
  key: string;
  name: string;
  state: "uploading" | "done" | "error";
  error?: string;
};

const UPLOAD_FAILED = "Der Upload ist fehlgeschlagen.";

// One PDF in three steps. Returns an error message, or null if it worked.
async function uploadPdf(notebookId: string, file: File): Promise<string | null> {
  try {
    // 1. Server: check input and rights, create source row and upload URL.
    //    The server also checks type and size, so we do not check twice here.
    const result = await createPdfSource({
      notebookId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    if (!result.ok) return result.error;

    // 2. Browser → Supabase Storage directly, with the one-time token.
    const { error: uploadError } = await createClient()
      .storage.from("sources")
      .uploadToSignedUrl(result.path, result.token, file, { contentType: "application/pdf" });

    // 3. Server: start processing. Also after a failed upload: the server
    //    then finds no file and sets the status "Fehler" with a clear message.
    await startProcessing(result.sourceId);
    return uploadError ? UPLOAD_FAILED : null;
  } catch {
    return UPLOAD_FAILED;
  }
}

// Uploads several PDFs one after the other and keeps a status per file.
// One after the other, not in parallel: simpler to follow, and the server
// does not start many processing jobs at the same moment.
//
// The hook lives in the workspace, not in the dialog. So an upload goes on
// when the user closes the dialog.
export function usePdfUploads(notebookId: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const busy = items.some((item) => item.state === "uploading");

  // Resolves to true if every file worked.
  async function upload(files: File[]): Promise<boolean> {
    const batch: UploadItem[] = files.map((file) => ({
      key: crypto.randomUUID(),
      name: file.name,
      state: "uploading",
    }));
    setItems(batch);

    let allOk = true;
    for (const [i, file] of files.entries()) {
      const error = await uploadPdf(notebookId, file);
      if (error) allOk = false;
      setItems((current) =>
        current.map((item) =>
          item.key === batch[i].key
            ? { ...item, state: error ? "error" : "done", error: error ?? undefined }
            : item,
        ),
      );
    }
    return allOk;
  }

  return { items, busy, upload, clear: () => setItems([]) };
}
