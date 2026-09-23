import { NextResponse } from "next/server";
import { supabase, siteUrl } from "@/lib/supabase";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const failure = (reason: string) => {
    const response = NextResponse.redirect(
      `${siteUrl()}/sign-in?error=${reason}`,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  if (params.has("error"))
    return failure(
      params.get("error") === "access_denied" ? "cancelled" : "provider",
    );
  const code = params.get("code");
  if (code) {
    try {
      const { data, error } = await (
        await supabase()
      ).auth.exchangeCodeForSession(code);
      if (!error && data.session) {
        const recovery =
          ("redirectType" in data && data.redirectType === "recovery") ||
          params.get("next") === "reset-password";
        const response = NextResponse.redirect(
          `${siteUrl()}${recovery ? "/reset-password" : "/"}`,
        );
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    } catch {
      /* Render the recoverable error on the sign-in page. */
    }
  }
  return failure("link");
}
