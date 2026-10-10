import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden · Faden" };

export default async function LoginPage() {
  const { userId } = await getUser();
  if (userId) redirect("/notebooks");

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-[#111315]">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Anmelden</h1>
        <p className="mb-6 text-sm text-[#6b7078]">
          Melde dich an, um deine Notebooks zu sehen.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
