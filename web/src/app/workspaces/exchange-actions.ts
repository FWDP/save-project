"use server";
import { unstable_rethrow } from "next/navigation";
import { api } from "@/lib/api";
import { filters } from "@/lib/format";
import { CURRENCIES } from "@/lib/currency";
import type { ConvertedReport } from "@/lib/types";
export async function convertedReport(
  workspaceId: string,
  target: string,
  search: string,
): Promise<{ data?: ConvertedReport; error?: string }> {
  try {
    if (
      !/^[a-f0-9]{24}$/i.test(workspaceId) ||
      !(CURRENCIES as readonly string[]).includes(target)
    )
      throw new Error("Choose a supported currency and workspace.");
    const query = filters(Object.fromEntries(new URLSearchParams(search)));
    query.set("target", target);
    query.delete("page");
    return {
      data: await api<ConvertedReport>(
        `/workspaces/${workspaceId}/reports/converted?${query}`,
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
