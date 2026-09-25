export function siteUrl() {
  return new URL(process.env.SAVE_WEB_URL || "http://localhost:3002").origin;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: siteUrl().startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
  };
}
