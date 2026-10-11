"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
          className="h-11 rounded-full border border-border bg-card px-4 text-base font-normal outline-none focus-visible:border-foreground"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Passwort
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-full border border-border bg-card px-4 text-base font-normal outline-none focus-visible:border-foreground"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-tile bg-error px-4 py-2.5 text-sm text-error-foreground">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Melde an …" : "Anmelden"}
      </Button>
    </form>
  );
}
