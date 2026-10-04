"use server";
import { unstable_rethrow } from "next/navigation";
import { api } from "@/lib/api";
import { filters } from "@/lib/format";
import { CURRENCIES } from "@/lib/currency";
import type { ConvertedReport } from "@/lib/types";
export async function convertedReport(
  target: string,
  search: string,
): Promise<{ data?: ConvertedReport; error?: string }> {
  try {
    if (
      !(CURRENCIES as readonly string[]).includes(target)
    )
      throw new Error("Choose a supported currency.");
    const query = filters(Object.fromEntries(new URLSearchParams(search)));
    query.set("target", target);
    query.delete("page");
    return {
      data: await api<ConvertedReport>(
        `/ledger/reports/converted?${query}`,
      ),
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Conversion is unavailable. Please retry.",
    };
  }
}
