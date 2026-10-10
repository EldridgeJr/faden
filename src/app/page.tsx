import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Faden</h1>
      <p className="max-w-md text-lg text-[#6b7078]">
        Lade Quellen hoch und stelle Fragen. Faden antwortet nur aus deinen
        Quellen – mit Belegen, die direkt zur Textstelle springen.
      </p>
      <Link
        href="/notebooks"
        className="rounded-full bg-[#111315] px-5 py-2.5 font-medium text-white"
      >
        Zu meinen Notebooks
      </Link>
    </main>
  );
}
