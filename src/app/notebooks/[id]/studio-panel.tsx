import { Headphones, Layers } from "lucide-react";

// The Studio column. Podcast and flashcards follow in step 6.
// Until then the tiles say honestly that they are not ready yet.
export function StudioPanel() {
  return (
    <section aria-labelledby="studio-heading" className="flex flex-col gap-4">
      <h2 id="studio-heading" className="text-xl font-medium tracking-tight">
        Studio
      </h2>
      <p className="text-sm text-muted-foreground">
        Hier erstellt Faden bald neue Formate aus deinen Quellen, mit Belegen wie im Chat.
      </p>
      {/* auto-fit: two tiles side by side only if each gets at least 10rem.
          In the narrow column they stack, so long words like
          "Zusammenfassung" fit. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2.5">
        {[
          { title: "Audio-Zusammenfassung", Icon: Headphones },
          { title: "Karteikarten", Icon: Layers },
        ].map(({ title, Icon }) => (
          <div
            key={title}
            className="flex min-h-[108px] flex-col items-start gap-2.5 rounded-tile border-[1.5px] border-dashed border-border p-3.5"
          >
            <span aria-hidden className="inline-flex size-[34px] items-center justify-center rounded-full bg-tile">
              <Icon className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium hyphens-auto">{title}</span>
              <span className="text-xs text-muted-foreground">Kommt bald</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
