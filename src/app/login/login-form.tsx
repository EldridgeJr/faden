"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null, email: "" };

// Client Component only for two things: show the error message from the
// Server Action and disable the button while it runs.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-Mail
        <input
          name="email"
          type="email"
          defaultValue={state.email}
          autoComplete="email"
          required
          className="rounded-full border border-[#e3e5e8] bg-white px-4 py-2.5 text-base font-normal outline-none focus:border-[#111315]"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Passwort
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-full border border-[#e3e5e8] bg-white px-4 py-2.5 text-base font-normal outline-none focus:border-[#111315]"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-[18px] bg-[#fde4db] px-4 py-2.5 text-sm text-[#a3361a]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#111315] px-4 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Melde an …" : "Anmelden"}
      </button>
    </form>
  );
}
