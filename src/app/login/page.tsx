import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { getUser } from "@/lib/auth";
import { getTheme } from "@/lib/theme-server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden · Faden" };

export default async function LoginPage() {
  const { userId } = await getUser();
  if (userId) redirect("/notebooks");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="w-full max-w-sm rounded-card bg-card p-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="text-xl font-semibold tracking-tight">Faden</span>
        </div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Anmelden</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Melde dich an, um deine Notebooks zu sehen.
        </p>
        <LoginForm />
      </div>
      <ThemeSwitch initialTheme={await getTheme()} />
    </main>
  );
}
