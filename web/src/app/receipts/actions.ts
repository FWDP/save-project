"use server";
import { requireSession } from "@/lib/supabase";

export type ParsedReceipt = {
  merchant: string;
  amount: number;
  currency?: string;
  date: string;
  category?: string;
  tin?: string;
  tax?: number;
  notes?: string;
  confidence?: number;
};

export type ScanResult =
  | { ok: true; data: ParsedReceipt }
  | { ok: false; error: string };

export async function scanReceipt(form: FormData): Promise<ScanResult> {
  let token: string;
  try {
    const session = await requireSession();
    token = session.token;
  } catch {
    return { ok: false, error: "You must be signed in to scan receipts." };
  }

  const base = (process.env.SAVE_API_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  // Relay the file as multipart to the NestJS receipt endpoint
  const relayForm = new FormData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return { ok: false, error: "No image file was provided." };
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'Choose a non-empty JPEG, PNG or WebP image up to 5 MB.' };
  }
  relayForm.append("file", file);

  // Pass categories if the caller included them
  const categories = form.get("categories");
  if (typeof categories === "string" && categories) {
    relayForm.append("categories", categories);
  }

  let response: Response;
  try {
    response = await fetch(`${base}/receipts/scan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: relayForm,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach the AI scanning service. Please try again.",
    };
  }

  if (!response.ok) {
    let message = `Scan failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (body?.message) {
        message = Array.isArray(body.message)
          ? body.message.join(" ")
          : String(body.message);
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }

  try {
    const data = (await response.json()) as ParsedReceipt;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "AI returned an unreadable response." };
  }
}
