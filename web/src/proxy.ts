import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, siteUrl } from "./lib/auth-config";
export async function proxy(request: NextRequest) {
  const canonical = new URL(siteUrl());
  // PKCE initiation and callback must share a browser cookie host.
  if (
    request.method === "GET" &&
    ["/sign-in", "/sign-up", "/reset-password"].includes(request.nextUrl.pathname) &&
    (request.headers.get("host") !== canonical.host ||
      request.nextUrl.protocol !== canonical.protocol)
  ) {
    const response = NextResponse.redirect(
      new URL(request.nextUrl.pathname + request.nextUrl.search, canonical),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  let response = NextResponse.next({ request });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)
    return response;
  const client = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)",
  ],
};
