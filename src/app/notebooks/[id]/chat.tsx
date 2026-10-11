"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Check, Copy, Search, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  NO_ANSWER,
  splitCitations,
  type ChatMessage,
  type Citation,
} from "@/lib/chat/citations";
import { MAX_QUESTION_CHARS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { OpenCitation } from "./citation-panel";

const GENERIC_ERROR = "Die Antwort ist fehlgeschlagen. Bitte versuche es noch einmal.";

// The route answers errors as JSON: { "error": "…" }. useChat puts the raw
// body into error.message. We show only that text, never other details.
function errorText(error: Error): string {
  try {
    const body: unknown = JSON.parse(error.message);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Not JSON: a network error or an error inside the stream.
  }
  return GENERIC_ERROR;
}

function textOf(message: ChatMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function Chat({
  notebookId,
  selectedIds,
  readyCount,
  initialMessages,
  openCitation,
  onOpenCitation,
}: {
  notebookId: string;
  selectedIds: string[];
  readyCount: number;
  initialMessages: ChatMessage[];
  openCitation: OpenCitation | null;
  onOpenCitation: (citation: OpenCitation) => void;
}) {
  const [input, setInput] = useState("");

  // The transport sends only what the route needs: the new question and the
  // selected sources. The history stays on the server (see route.ts).
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          return {
            body: { notebookId, sourceIds: body?.sourceIds ?? [], question: textOf(last) },
          };
        },
      }),
  );

  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    id: notebookId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const canSend = !busy && input.trim().length > 0 && selectedIds.length > 0;

  // Keep the newest message in view: scroll down when a message arrives or
  // grows while streaming.
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastText = messages.length > 0 ? textOf(messages[messages.length - 1]) : "";
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, lastText, status]);

  function send() {
    if (!canSend) return;
    sendMessage({ text: input.trim() }, { body: { sourceIds: selectedIds } });
    setInput("");
  }

  const subtitle =
    readyCount === 0
      ? "Sobald eine Quelle bereit ist, kannst du Fragen stellen."
      : selectedIds.length === 0
        ? "Wähle links mindestens eine Quelle aus."
        : `Antwortet nur aus ${selectedIds.length === 1 ? "der ausgewählten Quelle" : `den ${selectedIds.length} ausgewählten Quellen`}`;

  return (
    <section aria-labelledby="chat-heading" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="chat-heading" className="text-xl font-medium tracking-tight">
          Chat
        </h2>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>

      <div ref={scrollRef} className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-[22px] bg-surface px-5 py-4">
            <p className="font-medium">Stell eine Frage zu deinen Quellen</p>
            <p className="max-w-[66ch] text-sm leading-relaxed text-muted-foreground">
              Faden sucht die passenden Stellen und antwortet nur damit. Jede Aussage bekommt einen
              Beleg wie <CitationNumber n={1} />, ein Klick zeigt die Stelle in der Quelle. Steht
              die Antwort nicht in deinen Quellen, sagt Faden das.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-6 pb-2">
            {messages.map((message) => (
              <li key={message.id}>
                {message.role === "user" ? (
                  <p className="ml-auto w-fit max-w-[min(520px,85%)] rounded-[20px_20px_6px_20px] bg-primary px-4 py-3 text-[15px] leading-normal whitespace-pre-wrap text-primary-foreground">
                    {textOf(message)}
                  </p>
                ) : (
                  <Answer
                    message={message}
                    streaming={busy && message.id === messages[messages.length - 1].id}
                    activeNumber={openCitation?.messageId === message.id ? openCitation.n : null}
                    onOpen={(n, citations) => onOpenCitation({ messageId: message.id, n, citations })}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
        {status === "submitted" && (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Logo size={30} />
            <span className="motion-safe:animate-pulse">Faden sucht in deinen Quellen …</span>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-tile bg-error px-4 py-3 text-sm text-error-foreground">
            {errorText(error)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex flex-col gap-2 rounded-[24px] border border-input bg-card py-3 pr-3 pl-[18px] shadow-[0_6px_24px_rgba(17,19,21,0.06)] focus-within:border-foreground/40"
        >
          <label htmlFor="question" className="font-mono text-xs text-muted-foreground">
            Frage an deine Quellen
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter makes a new line.
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send();
                }
              }}
              maxLength={MAX_QUESTION_CHARS}
              rows={1}
              placeholder="Zum Beispiel: Was sind die wichtigsten Punkte?"
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none [field-sizing:content] placeholder:text-muted-foreground"
            />
            {busy ? (
              <Button type="button" size="icon" variant="secondary" aria-label="Antwort stoppen" onClick={() => stop()}>
                <Square className="size-4 fill-current" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Frage senden" disabled={!canSend}>
                <ArrowUp aria-hidden />
              </Button>
            )}
          </div>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Antworten stützen sich nur auf die ausgewählten Quellen. Gespeichert in Frankfurt (EU).
        </p>
      </div>
    </section>
  );
}

// The number of a citation as a small lime square.
function CitationNumber({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 align-[2px] font-mono text-xs leading-none font-medium",
        // Active: black with lime text in both themes. bg-primary would turn
        // light in dark mode, and lime on light grey is hard to read.
        active
          ? "bg-highlight-foreground text-highlight ring-1 ring-highlight"
          : "bg-highlight text-highlight-foreground",
      )}
    >
      {n}
    </span>
  );
}

// One answer: text with [n] as buttons, the cited sources as chips below.
function Answer({
  message,
  streaming,
  activeNumber,
  onOpen,
}: {
  message: ChatMessage;
  streaming: boolean;
  activeNumber: number | null;
  onOpen: (n: number, citations: Citation[]) => void;
}) {
  const citations: Citation[] = message.parts.flatMap((part) =>
    part.type === "data-citations" ? part.data : [],
  );
  const text = textOf(message);
  const segments = splitCitations(text, new Set(citations.map((c) => c.n)));

  // Only the citations the text really uses, in order of their number.
  const used = new Set(segments.flatMap((s) => (s.type === "citation" ? [s.n] : [])));
  const usedCitations = citations.filter((c) => used.has(c.n)).sort((a, b) => a.n - b.n);
  const open = (n: number) => onOpen(n, usedCitations);

  return (
    <article className="flex items-start gap-3">
      <Logo size={30} />
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        {/* Plain text only. React escapes it, so model output never becomes HTML. */}
        <p className="max-w-[66ch] text-[15px] leading-[1.7] whitespace-pre-wrap">
          {segments.map((segment, i) =>
            segment.type === "text" ? (
              <span key={i}>{segment.text}</span>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => open(segment.n)}
                aria-label={`Beleg ${segment.n} anzeigen`}
                aria-pressed={activeNumber === segment.n}
                className="mx-0.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CitationNumber n={segment.n} active={activeNumber === segment.n} />
              </button>
            ),
          )}
        </p>

        {usedCitations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {usedCitations.map((citation) => (
              <button
                key={citation.n}
                type="button"
                onClick={() => open(citation.n)}
                className={cn(
                  "inline-flex min-h-11 max-w-full items-center gap-2 rounded-[14px] border py-1.5 pr-3.5 pl-2 text-left text-[13px] transition-colors",
                  activeNumber === citation.n
                    ? "border-foreground/30 bg-tile"
                    : "border-border bg-surface hover:bg-tile",
                )}
              >
                <CitationNumber n={citation.n} active={activeNumber === citation.n} />
                <span className="min-w-0 break-words">{citation.sourceTitle}</span>
                {citation.page !== null && (
                  <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    S. {citation.page}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {text.trim() === NO_ANSWER && (
          <span className="inline-flex h-[30px] items-center gap-1.5 self-start rounded-full bg-tile px-3 text-xs text-muted-foreground">
            <Search className="size-3.5" aria-hidden />
            Keine passende Stelle gefunden
          </span>
        )}

        {!streaming && text.length > 0 && <CopyButton text={text} />}
      </div>
    </article>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. no permission). Nothing to do.
    }
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={copy}
      aria-label={copied ? "Kopiert" : "Antwort kopieren"}
      title={copied ? "Kopiert" : "Antwort kopieren"}
      className="self-start"
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}
