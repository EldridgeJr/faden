import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  ready: { chip: "bg-highlight/35 text-foreground", dot: "bg-ready" },
  busy: { chip: "bg-busy text-busy-foreground", dot: "bg-busy-foreground" },
  error: { chip: "bg-error text-error-foreground", dot: "bg-error-foreground" },
  neutral: { chip: "bg-card text-foreground", dot: "bg-muted-foreground" },
} as const;

export type StatusTone = keyof typeof TONES;

// A small round label with a colored dot: "3 bereit", "1 Fehler" …
// The dot is decoration. The text alone must say everything.
export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap",
        TONES[tone].chip,
        className,
      )}
    >
      <span aria-hidden className={cn("size-[7px] rounded-full", TONES[tone].dot)} />
      {children}
    </span>
  );
}
