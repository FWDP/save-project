import { CURRENCIES, minorToDecimal } from "@/lib/currency";
import { api, ApiError } from "@/lib/api";
import { filters } from "@/lib/format";
import type { TransactionPage, Workspace, ConvertedReport } from "@/lib/types";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspace = await api<Workspace>(
    `/workspaces/${encodeURIComponent(id)}`,
  );
  const query = filters(
    Object.fromEntries(new URL(request.url).searchParams),
    workspace.timezone,
  );
  query.delete("page");
  const target =
    new URL(request.url).searchParams.get("target") || workspace.currency;
  if (!(CURRENCIES as readonly string[]).includes(target))
    return new Response("Unsupported currency", { status: 400 });
  let data: Pick<TransactionPage, "summary" | "categories" | "total">;
  let quote: ConvertedReport["quote"] | undefined;
  try {
    if (target !== workspace.currency) {
      query.set("target", target);
      const converted = await api<ConvertedReport>(
        `/workspaces/${encodeURIComponent(id)}/reports/converted?${query}`,
      );
      data = converted;
      quote = converted.quote;
    } else {
      data = await api<TransactionPage>(
        `/workspaces/${encodeURIComponent(id)}/transactions?${query}`,
      );
    }
  } catch (error) {
    if (error instanceof ApiError)
      return new Response(error.message, {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      });
    throw error;
  }
  const escape = (value: unknown) => {
    const text = String(value);
    return `"${(/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Metric", `Amount (${target})`, "Record count"],
    ["Income", minorToDecimal(data.summary.incomeMinor, target), ""],
    ["Expenses", minorToDecimal(data.summary.expenseMinor, target), ""],
    [
      "Net balance",
      minorToDecimal(data.summary.balanceMinor, target),
      data.total,
    ],
    ["Top spending categories (up to 8)", "", ""],
    ...data.categories.map((c) => [
      c.name,
      minorToDecimal(c.amountMinor, target),
      c.count,
    ]),
  ];
  if (quote)
    rows.push(
      [
        "Conversion",
        `${quote.base} to ${quote.target}`,
        "Current-rate estimate; excludes bank fees",
      ],
      ["Rate", String(quote.rate), ""],
      ["Rate timestamp", quote.asOf, ""],
      ["Provider", quote.provider, ""],
      [
        "Rounding",
        "Currency minor units; category rounding may differ from totals",
        "",
      ],
    );
  return new Response(
    rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="save-summary-${query.get("month")}-${target}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
