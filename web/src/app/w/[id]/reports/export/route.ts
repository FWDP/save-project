import { api } from "@/lib/api";
import { filters } from "@/lib/format";
import type { TransactionPage, Workspace } from "@/lib/types";
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
  const data = await api<TransactionPage>(
    `/workspaces/${encodeURIComponent(id)}/transactions?${query}`,
  );
  const escape = (value: unknown) => {
    const text = String(value);
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Metric", "Amount (PHP)", "Record count"],
    ["Income", (data.summary.incomeMinor / 100).toFixed(2), ""],
    ["Expenses", (data.summary.expenseMinor / 100).toFixed(2), ""],
    ["Net balance", (data.summary.balanceMinor / 100).toFixed(2), data.total],
    ["Top spending categories (up to 8)", "", ""],
    ...data.categories.map((c) => [
      c.name,
      (c.amountMinor / 100).toFixed(2),
      c.count,
    ]),
  ];
  return new Response(
    rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="save-summary-${query.get("month")}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
