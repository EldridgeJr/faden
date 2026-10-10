"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/schemas";

// email goes back to the form: React resets a form after every action,
// and the user should not have to type the email again after an error.
export type SignInState = { error: string | null; email: string };

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email };
  }

  const supabase = await createClient();
  // On success, the server client writes the session cookies (setAll).
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.status === 429) {
      return {
        error: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.",
        email,
      };
    }
    // One message for "unknown email" and "wrong password".
    // Otherwise an attacker could find out which emails have an account.
    return { error: "E-Mail oder Passwort ist falsch.", email };
  }

  // Fixed target, no "?next=" parameter: no open redirect possible.
  redirect("/notebooks");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
