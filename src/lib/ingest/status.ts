// The processing of a source runs at most maxDuration (300 s, see
// src/app/notebooks/[id]/page.tsx). A source that is still "processing"
// after 10 minutes was stopped by the platform and is stuck.
export const STUCK_AFTER_MS = 10 * 60 * 1000;

// A source may be deleted unless its processing may still be running.
// Deleting during processing could leave an orphaned file: the background
// job would save the text of a web page after the row is gone.
export function canDeleteSource(status: string, createdAt: string, now: Date): boolean {
  if (status !== "processing") return true;
  return now.getTime() - new Date(createdAt).getTime() > STUCK_AFTER_MS;
}
