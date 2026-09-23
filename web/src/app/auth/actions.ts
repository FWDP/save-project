"use server";
import { redirect } from "next/navigation";
import { supabase, siteUrl, requireSession } from "@/lib/supabase";
import type { ActionState } from "@/lib/types";
export async function authenticate(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const mode = String(form.get("mode"));
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  let destination: string | null = null;
  try {
    const client = await supabase();
    const callback = `${siteUrl()}/auth/callback`;
    if (mode === "google") {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) return { error: error.message };
      if (!data.url)
        return { error: "Google sign-in is unavailable. Please try again." };
      destination = data.url;
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { error: "Enter a valid email address." };
      if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callback },
        });
        return error
          ? { error: error.message }
          : {
              message:
                "Check your email. Open the sign-in link in this browser.",
            };
      }
      if (mode === "recovery") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${callback}?next=reset-password`,
        });
        return error
          ? { error: error.message }
          : {
              message:
                "If this email has an account, a recovery link is on its way. Open it in this browser.",
            };
      }
      if (mode === "signup") {
        if (password.length < 12)
          return { error: "Use at least 12 characters for your password." };
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callback,
            data: {
              name: String(form.get("name") || "")
                .trim()
                .slice(0, 80),
            },
          },
        });
        if (error) return { error: error.message };
        if (!data.session)
          return {
            message:
              "Check your email to confirm your account in this browser.",
          };
      } else if (mode === "password") {
        if (!password) return { error: "Enter your password." };
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          return { error: "Sign-in failed. Check your email and password." };
      } else return { error: "Choose a sign-in method." };
      destination = "/";
    }
  } catch {
    return { error: "The sign-in service is unavailable. Please try again." };
  }
  if (destination) redirect(destination);
  return {};
}
export async function signOut() {
  let failed = false;
  try {
    const client = await supabase();
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirect("/sign-in?error=signout");
  redirect("/sign-in");
}
export async function changePassword(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();
  const password = String(form.get("password") ?? "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== String(form.get("confirmPassword") ?? ""))
    return { error: "The passwords do not match." };
  try {
    const { error } = await (await supabase()).auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch {
    return { error: "The password service is unavailable. Please try again." };
  }
  redirect("/");
}
