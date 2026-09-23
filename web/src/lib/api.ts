import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "./supabase";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { token } = await requireSession();
  const base = (process.env.SAVE_API_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("SAVE could not reach the API. Please try again.", 503);
  }
  if (response.status === 401) redirect("/sign-in");
  if (response.status === 404) notFound();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message;
    throw new ApiError(
      message || "The request could not be completed.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
