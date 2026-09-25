import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authCookieOptions } from "./auth-config";
export { siteUrl } from "./auth-config";
export const authConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
export async function supabase() {
  if (!authConfigured())
    throw new Error("Account sign-in is not configured yet.");
  const store = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Proxy handles refreshed cookies during server rendering. */
          }
        },
      },
    },
  );
}
export const requireSession = cache(async () => {
  if (!authConfigured()) redirect("/sign-in");
  const client = await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/sign-in");
  // Only use the session's raw token after verifying the user with the provider.
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) redirect("/sign-in");
  return { user, token: session.access_token };
});
